import { injectable, inject } from 'tsyringe';
import { IssueStatus } from '../../domain/value-objects/IssueStatus.js';
import { IssueRepository, ISSUE_REPOSITORY } from '../../domain/interfaces/IssueRepository.js';
import { Logger, LOGGER } from '../../domain/interfaces/Logger.js';
import { AppConfig, APP_CONFIG } from '../../domain/interfaces/AppConfig.js';

export const EXECUTE_ISSUE = Symbol('ExecuteIssue');

export interface IssueExecutor {
  execute(issueId: string): Promise<unknown>;
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  CREATED: ['ANALYZING'],
  ANALYZING: ['PLANNING', 'FAILED'],
  PLANNING: ['CODING', 'FAILED'],
  CODING: ['TESTING', 'FAILED'],
  TESTING: ['REVIEWING', 'RETRY', 'FAILED'],
  REVIEWING: ['COMPLETED', 'RETRY', 'FAILED'],
  COMPLETED: [],
  FAILED: ['RETRY'],
  RETRY: ['CODING'],
};

@injectable()
export class WorkflowEngine {
  private executor: IssueExecutor | null = null;
  private running = false;

  constructor(
    @inject(ISSUE_REPOSITORY) private readonly issueRepository: IssueRepository,
    @inject(LOGGER) private readonly logger: Logger,
    @inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  setExecutor(executor: IssueExecutor): void {
    this.executor = executor;
  }

  async runAutonomous(): Promise<void> {
    if (this.running) {
      this.logger.warn('Workflow engine is already running');
      return;
    }

    if (!this.executor) {
      this.logger.error('No executor configured', new Error('Call setExecutor() before runAutonomous()'));
      throw new Error('No executor configured. Call setExecutor() first.');
    }

    this.running = true;
    this.logger.info('Workflow engine started', {
      maxRetries: this.config.execution.maxRetries,
      autoCommit: this.config.execution.autoCommit,
      dryRun: this.config.execution.dryRun,
    });

    try {
      let issue = await this.issueRepository.findNextIssue();

      while (issue !== null) {
        this.logger.info('Picked up issue', { issueId: issue.id, title: issue.title });

        if (!this.running) {
          this.logger.info('Workflow engine stopped');
          break;
        }

        try {
          await this.processIssue(issue.id);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          this.logger.error('Issue processing failed', err instanceof Error ? err : undefined, {
            issueId: issue.id,
          });
          await this.markFailed(issue.id, errorMessage);
        }

        issue = await this.issueRepository.findNextIssue();
      }

      this.logger.info('No more issues to process');
    } finally {
      this.running = false;
      this.logger.info('Workflow engine stopped');
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    this.logger.info('Workflow engine stop requested');
  }

  async validateTransition(issueId: string, from: string, to: string): Promise<boolean> {
    const allowed = VALID_TRANSITIONS[from];
    if (!allowed) {
      this.logger.warn('Unknown source state', { issueId, from });
      return false;
    }

    const isValid = allowed.includes(to);
    if (!isValid) {
      this.logger.warn('Invalid state transition', { issueId, from, to, allowed: allowed.join(', ') });
    }

    return isValid;
  }

  async advanceState(issueId: string, to: string): Promise<void> {
    this.logger.info('Advancing state', { issueId, to });
    await this.issueRepository.updateStatus(issueId, to);
  }

  async markFailed(issueId: string, error: string): Promise<void> {
    this.logger.error('Marking issue as failed', undefined, { issueId, error });
    await this.issueRepository.updateStatus(issueId, IssueStatus.FAILED);
    await this.issueRepository.addComment(
      issueId,
      `## Execution Failed\n\n\`\`\`\n${error}\n\`\`\`\n\nThe workflow engine will retry this issue automatically.`,
    );
  }

  private async processIssue(issueId: string): Promise<void> {
    await this.advanceState(issueId, IssueStatus.ANALYZING);

    this.logger.info('Dispatching to executor', { issueId });

    const executor = this.executor;
    if (!executor) {
      throw new Error('Executor not configured');
    }

    await executor.execute(issueId);

    this.logger.info('Executor completed', { issueId });
  }
}
