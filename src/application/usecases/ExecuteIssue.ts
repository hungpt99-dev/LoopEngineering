import { injectable, inject } from 'tsyringe';
import { randomUUID } from 'node:crypto';
import type { IssueRepository } from '../../domain/interfaces/IssueRepository.js';
import { ISSUE_REPOSITORY } from '../../domain/interfaces/IssueRepository.js';
import type { CodingAgentProvider } from '../../domain/interfaces/CodingAgentProvider.js';
import type { GitRepository } from '../../domain/interfaces/GitRepository.js';
import { GIT_REPOSITORY } from '../../domain/interfaces/GitRepository.js';
import type { TestRunner } from '../../domain/interfaces/TestRunner.js';
import { TEST_RUNNER } from '../../domain/interfaces/TestRunner.js';
import type { PlannerService, AgentInfo } from '../../domain/interfaces/PlannerService.js';
import { PLANNER_SERVICE } from '../../domain/interfaces/PlannerService.js';
import type { ReviewerService } from '../../domain/interfaces/ReviewerService.js';
import { REVIEWER_SERVICE } from '../../domain/interfaces/ReviewerService.js';
import type { ExecutionStore } from '../../domain/interfaces/ExecutionStore.js';
import { EXECUTION_STORE } from '../../domain/interfaces/ExecutionStore.js';
import type { Logger } from '../../domain/interfaces/Logger.js';
import { LOGGER } from '../../domain/interfaces/Logger.js';
import type { AppConfig } from '../../domain/interfaces/AppConfig.js';
import { APP_CONFIG } from '../../domain/interfaces/AppConfig.js';
import type { ContextBuilder } from '../../domain/interfaces/ContextBuilder.js';
import { CONTEXT_BUILDER } from '../../domain/interfaces/ContextBuilder.js';
import { AgentRegistry, AGENT_REGISTRY } from '../../infrastructure/agents/AgentRegistry.js';
import { ExecutionHistory } from '../../domain/entities/ExecutionHistory.js';
import { AgentTask } from '../../domain/entities/AgentTask.js';
import { IssueStatus } from '../../domain/value-objects/IssueStatus.js';

@injectable()
export class ExecuteIssue {
  constructor(
    @inject(ISSUE_REPOSITORY) private readonly issueRepo: IssueRepository,
    @inject(AGENT_REGISTRY) private readonly agentRegistry: AgentRegistry,
    @inject(GIT_REPOSITORY) private readonly git: GitRepository,
    @inject(TEST_RUNNER) private readonly testRunner: TestRunner,
    @inject(PLANNER_SERVICE) private readonly planner: PlannerService,
    @inject(REVIEWER_SERVICE) private readonly reviewer: ReviewerService,
    @inject(EXECUTION_STORE) private readonly store: ExecutionStore,
    @inject(LOGGER) private readonly logger: Logger,
    @inject(APP_CONFIG) private readonly config: AppConfig,
    @inject(CONTEXT_BUILDER) private readonly contextBuilder: ContextBuilder,
  ) {}

  async execute(issueId: string): Promise<ExecutionHistory> {
    const issue = await this.issueRepo.findById(issueId);
    if (!issue) {
      throw new Error(`Issue not found: ${issueId}`);
    }

    const branchName = this.buildBranchName(issueId);
    let execution = await this.createInitialRecord(issue, branchName);
    let agentName = 'unknown';
    let testResultOutput = '';

    try {
      // --- ANALYZING ---
      this.logger.info('Starting analysis', { issueId, title: issue.title });
      await this.issueRepo.updateStatus(issueId, IssueStatus.ANALYZING);
      await this.issueRepo.addComment(issueId, 'Analyzing issue requirements and scope...');
      const plan = await this.planner.analyzeIssue(issue);
      execution = await this.persistStatus(execution, IssueStatus.ANALYZING);

      // --- PLANNING ---
      this.logger.info('Planning implementation', { issueId, complexity: plan.complexity });
      await this.issueRepo.updateStatus(issueId, IssueStatus.PLANNING);
      await this.issueRepo.addComment(
        issueId,
        `**Planned implementation**\n- Complexity: ${plan.complexity}\n- Estimated duration: ${plan.estimatedDuration}s\n- Steps:\n${plan.implementationSteps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}\n- Risks: ${plan.risks.length > 0 ? plan.risks.join(', ') : 'None identified'}`,
      );

      const fullContext = await this.contextBuilder.buildFullContext(issue, plan);
      const availableAgents = this.buildAgentInfoList();
      agentName = await this.planner.selectAgent(issue, plan, availableAgents);
      execution = await this.persistStatus(execution, IssueStatus.PLANNING);

      // --- CODING ---
      this.logger.info('Starting coding', { issueId, agent: agentName });
      await this.issueRepo.updateStatus(issueId, IssueStatus.CODING);
      await this.issueRepo.addComment(issueId, `Coding implementation using ${agentName}...`);

      await this.git.createBranch(branchName);
      this.logger.info('Created branch', { branch: branchName });

      const task = AgentTask.create({
        id: randomUUID(),
        issueId: issue.id,
        issueTitle: issue.title,
        issueDescription: issue.description,
        projectContext: fullContext,
        milestoneContext: undefined,
        dependencies: plan.dependencies,
        filesToInspect: plan.filesToInspect,
        implementationSteps: plan.implementationSteps,
        complexity: plan.complexity,
        branchName,
        environment: {},
      });

      const selectedAgent = await this.resolveAgent(agentName);
      this.logger.info('Selected agent for execution', {
        issueId,
        planned: agentName,
        actual: selectedAgent.name,
        available: await selectedAgent.isAvailable(),
      });

      this.logger.info(`Running agent '${selectedAgent.name}'... (this may take several minutes)`, { issueId });

      const agentResult = await selectedAgent.execute(task);
      if (!agentResult.success) {
        throw new Error(`Agent execution failed: ${agentResult.error ?? 'Unknown error'}`);
      }

      this.logger.info(`Agent execution complete`, {
        issueId,
        duration: agentResult.duration,
        filesChanged: agentResult.filesChanged.length,
      });

      if (this.config.execution.autoCommit) {
        await this.git.stageAll();
        const commitSha = await this.git.commit(`feat: ${issue.title} [${issueId}]`);
        execution = await this.store.update(execution.id, { commit: commitSha });

        if (this.config.execution.autoPush) {
          await this.git.push();
        }
      }

      await this.issueRepo.addComment(
        issueId,
        `Agent ${agentName} completed coding. Files changed: ${agentResult.filesChanged.length > 0 ? agentResult.filesChanged.join(', ') : 'none'}`,
      );
      execution = await this.persistStatus(execution, IssueStatus.CODING);

      // --- TESTING ---
      this.logger.info('Running tests', { issueId });
      await this.issueRepo.updateStatus(issueId, IssueStatus.TESTING);
      await this.issueRepo.addComment(issueId, 'Running test suite...');

      let testResult = await this.testRunner.runAll();

      for (let attempt = 1; attempt <= this.config.execution.maxRetries; attempt++) {
        if (testResult.success) {
          break;
        }

        this.logger.warn('Tests failed, retrying', { issueId, attempt, maxRetries: this.config.execution.maxRetries });

        const failedTests = testResult.errors.slice(0, 15);
        const errorSummary = failedTests.join('\n');
        const remaining = testResult.errors.length - failedTests.length;

        await this.issueRepo.addComment(
          issueId,
          `Tests failed on attempt ${attempt}/${this.config.execution.maxRetries}: ${testResult.errors.length} failures\n\n\`\`\`\n${errorSummary}${remaining > 0 ? `\n\n... and ${remaining} more` : ''}\n\`\`\`\nRetrying...`,
        );

        const retryFeedback = `Fix these test failures (attempt ${attempt}/${this.config.execution.maxRetries}):\n\n${errorSummary}${remaining > 0 ? `\n\n... and ${remaining} more failures (not shown)` : ''}`;

        const retryTask = AgentTask.create({
          id: randomUUID(),
          issueId: issue.id,
          issueTitle: `[RETRY #${attempt}] ${issue.title}`,
          issueDescription: retryFeedback,
          projectContext: task.projectContext,
          milestoneContext: undefined,
          dependencies: plan.dependencies,
          filesToInspect: agentResult.filesChanged,
          implementationSteps: [],
          complexity: plan.complexity,
          branchName,
          environment: {},
        });

        const retryResult = await selectedAgent.execute(retryTask);
        await this.store.addRetry(execution.id, {
          attempt,
          status: retryResult.success ? 'passed' : 'failed',
          error: retryResult.error,
          duration: retryResult.duration,
        });

        testResult = await this.testRunner.runAll();
      }

      testResultOutput = testResult.formattedSummary;

      if (!testResult.success) {
        await this.issueRepo.addComment(
          issueId,
          `Tests still failing after ${this.config.execution.maxRetries} retries:\n\`\`\`\n${testResultOutput}\n\`\`\``,
        );
        throw new Error(`Tests failed after ${this.config.execution.maxRetries} retries`);
      }

      await this.issueRepo.addComment(issueId, `Tests passed:\n\`\`\`\n${testResultOutput}\n\`\`\``);
      execution = await this.persistStatus(execution, IssueStatus.TESTING);

      // --- REVIEWING ---
      this.logger.info('Reviewing changes', { issueId });
      await this.issueRepo.updateStatus(issueId, IssueStatus.REVIEWING);
      await this.issueRepo.addComment(issueId, 'Reviewing code changes...');

      const changedFiles = await this.git.getChangedFiles();
      const review = await this.reviewer.reviewChanges(
        issueId,
        issue.title,
        changedFiles,
        testResultOutput,
      );

      if (review.isApproved) {
        await this.issueRepo.addComment(issueId, `Review passed (score: ${review.score}): ${review.summary}`);
      } else {
        const suggestions = await this.reviewer.suggestFixes(review.issues);
        await this.issueRepo.addComment(
          issueId,
          `Review found ${review.issues.length} issue(s) (score: ${review.score}):\n${review.issues.map((ri) => `- **[${ri.severity}] ${ri.category}**: ${ri.description}${ri.suggestion ? `\n  Suggestion: ${ri.suggestion}` : ''}`).join('\n')}\n\nSuggested fixes:\n${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}`,
        );

        if (!this.config.review.autoApproveTestsPassing) {
          throw new Error(`Review requested changes: ${review.issues.length} issue(s) found`);
        }
      }

      execution = await this.persistStatus(execution, IssueStatus.REVIEWING);

      // --- COMPLETED ---
      this.logger.info('Issue completed', { issueId });
      await this.issueRepo.updateStatus(issueId, IssueStatus.COMPLETED);

      const completionMsgParts = ['Issue completed successfully.'];

      if (this.config.execution.autoMerge) {
        try {
          this.logger.info('Merging branch', { branch: branchName });
          await this.git.mergeToDefaultBranch(branchName);
          completionMsgParts.push(`Merged \`${branchName}\` into \`${this.config.workspace.defaultBranch}\`.`);

          if (this.config.execution.deleteBranchAfterMerge) {
            try {
              await this.git.deleteBranch(branchName);
              completionMsgParts.push(`Deleted branch \`${branchName}\`.`);
            } catch (delErr) {
              this.logger.warn(`Failed to delete branch ${branchName}`, { error: String(delErr) });
            }
          }

          if (this.config.execution.autoPush) {
            await this.git.push();
            completionMsgParts.push(`Pushed to remote.`);
          }
        } catch (mergeErr) {
          const msg = mergeErr instanceof Error ? mergeErr.message : String(mergeErr);
          this.logger.error('Merge failed', mergeErr as Error, { branch: branchName });
          completionMsgParts.push(`Merge failed: ${msg}`);
          throw mergeErr;
        }
      }

      await this.issueRepo.addComment(issueId, completionMsgParts.join('\n'));

      execution = await this.store.update(execution.id, {
        status: IssueStatus.COMPLETED,
        result: `Completed: ${agentResult.output}`,
        duration: agentResult.duration,
        tokenUsage: agentResult.tokenUsage,
      });

      return execution;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Execution failed', error instanceof Error ? error : undefined, {
        issueId,
        status: execution.status,
        agentName,
      });

      await this.issueRepo.updateStatus(issueId, IssueStatus.FAILED);
      await this.issueRepo.addComment(issueId, `Execution failed: ${message}${stack ? `\n\`\`\`\n${stack}\n\`\`\`` : ''}`);

      execution = await this.store.update(execution.id, {
        status: IssueStatus.FAILED,
        error: message,
        result: `Failed at ${execution.status}: ${message}`,
      });

      return execution;
    }
  }

  private async resolveAgent(preferredName: string): Promise<CodingAgentProvider> {
    const provider = this.agentRegistry.getProvider(preferredName);

    if (provider && (await provider.isAvailable())) {
      return provider;
    }

    if (provider) {
      this.logger.warn(`Preferred agent '${preferredName}' is not available, falling back`, { preferredName });
    } else {
      this.logger.warn(`Preferred agent '${preferredName}' not found, falling back`, { preferredName });
    }

    const available = await this.agentRegistry.getAvailableProviders();
    if (available.length > 0) {
      this.logger.info(`Falling back to available agent`, { agent: available[0]!.name });
      return available[0]!;
    }

    throw new Error(`No coding agents available. Tried '${preferredName}' but no fallback found.`);
  }

  private buildBranchName(issueId: string): string {
    const sanitized = issueId.replace(/[^a-zA-Z0-9\-_]/g, '-');
    return sanitized;
  }

  private buildAgentInfoList(): AgentInfo[] {
    return Object.entries(this.config.agents)
      .filter(([, cfg]) => cfg.enabled)
      .map(([name, cfg]) => ({
        name,
        capabilities: cfg.capabilities,
        enabled: cfg.enabled,
        priority: cfg.priority,
      }));
  }

  private async createInitialRecord(
    issue: { id: string; title: string; projectId?: string; milestoneId?: string },
    branchName: string,
  ): Promise<ExecutionHistory> {
    return this.store.save({
      issueId: issue.id,
      issueTitle: issue.title,
      projectId: issue.projectId,
      milestoneId: issue.milestoneId,
      agentUsed: 'pending',
      status: IssueStatus.ANALYZING,
      duration: undefined,
      tokenUsage: undefined,
      result: undefined,
      error: undefined,
      commit: undefined,
      branch: branchName,
      retries: [],
      toJSON() {
        return {
          id: '',
          issueId: this.issueId,
          issueTitle: this.issueTitle,
          projectId: this.projectId,
          milestoneId: this.milestoneId,
          agentUsed: this.agentUsed,
          status: this.status,
          duration: this.duration,
          tokenUsage: this.tokenUsage,
          result: this.result,
          error: this.error,
          commit: this.commit,
          branch: this.branch,
          createdAt: new Date(),
          updatedAt: new Date(),
          retries: this.retries,
        };
      },
    });
  }

  private async persistStatus(
    current: ExecutionHistory,
    status: IssueStatus,
  ): Promise<ExecutionHistory> {
    return this.store.update(current.id, { status });
  }
}
