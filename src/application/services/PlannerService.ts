import { injectable, inject } from 'tsyringe';
import { Issue } from '../../domain/entities/Issue.js';
import { ExecutionPlan } from '../../domain/entities/ExecutionPlan.js';
import { Complexity } from '../../domain/value-objects/IssueStatus.js';
import { PlannerService, AgentInfo } from '../../domain/interfaces/PlannerService.js';
import { IssueRepository, ISSUE_REPOSITORY } from '../../domain/interfaces/IssueRepository.js';
import { ContextBuilder, CONTEXT_BUILDER } from '../../domain/interfaces/ContextBuilder.js';
import { Logger, LOGGER } from '../../domain/interfaces/Logger.js';

const REACT_KEYWORDS = /component|ui|react|vue|angular|frontend|css|style|layout|render|jsx|tsx/i;
const BUG_KEYWORDS = /\bbug\b|\bfix\b|\bpatch\b|\bhotfix\b|\berror\b|\bcrash\b|\bbroken\b/i;
const REFACTOR_KEYWORDS = /\brefactor\b|\barchitecture\b|\bredesign\b|\brestructure\b|\bmigrate\b|\boverhaul\b/i;
const STEP_DELIMITERS = /(?:\r?\n\s*(?:\d+[.)]\s*|[-*]\s))|(?:\r?\n\s*\r?\n)/;

@injectable()
export class PlannerServiceImpl implements PlannerService {
  constructor(
    @inject(ISSUE_REPOSITORY) private readonly issueRepository: IssueRepository,
    @inject(CONTEXT_BUILDER) private readonly contextBuilder: ContextBuilder,
    @inject(LOGGER) private readonly logger: Logger,
  ) {}

  async analyzeIssue(issue: Issue): Promise<ExecutionPlan> {
    this.logger.info('Analyzing issue', { issueId: issue.id, title: issue.title });

    const existing = await this.issueRepository.findById(issue.id);
    if (!existing) {
      this.logger.warn('Issue not found in repository, proceeding with provided data', { issueId: issue.id });
    }

    const [steps, dependencies, files] = await Promise.all([
      this.planImplementation(issue),
      this.contextBuilder.detectDependencies(issue),
      this.contextBuilder.identifyFiles(issue),
    ]);

    const complexity = await this.estimateComplexity(issue);
    const risks = await this.assessRisks(issue, complexity);
    const recommendedAgent = this.classifyRecommendedAgent(issue, complexity);
    const estimatedDuration = this.calculateDuration(complexity, issue.estimate ?? 0, steps.length);
    const requiresArchitectureReview = complexity === Complexity.HIGH || complexity === Complexity.VERY_HIGH;
    const confidence = this.computeConfidence(issue, dependencies.length, steps.length);

    const plan = ExecutionPlan.create({
      issueId: issue.id,
      issueTitle: issue.title,
      complexity,
      recommendedAgent,
      confidence,
      implementationSteps: steps,
      filesToInspect: files,
      risks,
      dependencies,
      estimatedDuration,
      requiresArchitectureReview,
    });

    this.logger.info('Analysis complete', { issueId: issue.id, complexity, recommendedAgent, estimatedDuration });
    return plan;
  }

  async selectAgent(issue: Issue, _plan: ExecutionPlan, availableAgents: AgentInfo[]): Promise<string> {
    const enabledAgents = availableAgents.filter((a) => a.enabled);
    if (enabledAgents.length === 0) {
      this.logger.error('No enabled agents available', undefined, { issueId: issue.id });
      throw new Error('No enabled agents available');
    }

    const desc = issue.description.toLowerCase();
    const title = issue.title.toLowerCase();
    const combined = `${title} ${desc}`;

    const complexity = await this.estimateComplexity(issue);

    const scores = enabledAgents.map((agent) => {
      let score = agent.priority;

      if (this.matchesKeywords(combined, BUG_KEYWORDS)) {
        if (this.agentHasCapability(agent, 'simple-bug', 'quick-fix')) {
          score += 30;
        }
      }

      if (this.matchesKeywords(combined, REFACTOR_KEYWORDS) || complexity === Complexity.HIGH || complexity === Complexity.VERY_HIGH) {
        if (this.agentHasCapability(agent, 'architecture', 'refactoring', 'full-stack')) {
          score += 30;
        }
      }

      if (this.matchesKeywords(combined, REACT_KEYWORDS)) {
        if (this.agentHasCapability(agent, 'frontend', 'react', 'design')) {
          score += 30;
        }
      }

      const capabilityMatchCount = agent.capabilities.filter((c) => this.isCapabilityRelevant(c, combined)).length;
      score += capabilityMatchCount * 5;

      return { agent, score };
    });

    scores.sort((a, b) => b.score - a.score);
    const best = scores[0];
    if (!best) {
      throw new Error('No suitable agent found');
    }

    this.logger.info('Agent selected', { issueId: issue.id, agent: best.agent.name, score: best.score });
    return best.agent.name;
  }

  async planImplementation(issue: Issue): Promise<string[]> {
    const desc = issue.description.trim();
    if (!desc) {
      return [`Implement: ${issue.title}`];
    }

    const lines = desc.split('\n').map((l) => l.trim()).filter(Boolean);

    let hasStructuredSteps = false;
    for (const line of lines) {
      const stripped = line.replace(/^[\d]+[.)]\s*/, '').replace(/^[-*]\s*/, '');
      if (stripped !== line) {
        hasStructuredSteps = true;
        break;
      }
    }

    if (hasStructuredSteps) {
      return lines
        .filter((l) => /^[\d]+[.)]\s/.test(l) || /^[-*]\s/.test(l))
        .map((l) => l.replace(/^[\d]+[.)]\s*/, '').replace(/^[-*]\s*/, ''))
        .filter(Boolean);
    }

    const parts = desc.split(STEP_DELIMITERS).filter((s) => s.trim().length > 0);
    if (parts.length > 1) {
      return parts.map((p) => p.trim().replace(/^\d+[.)]\s*/, '').replace(/^[-*]\s*/, ''));
    }

    const sentences = lines
      .join(' ')
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .filter((s) => s.trim().length > 10);
    if (sentences.length > 1) {
      return sentences.map((s) => s.trim());
    }

    return [`Implement: ${issue.title}`];
  }

  async estimateComplexity(issue: Issue): Promise<Complexity> {
    let score = 0;
    const descLength = issue.description.length;

    if (descLength < 100) score += 0;
    else if (descLength < 500) score += 1;
    else if (descLength < 1500) score += 2;
    else score += 4;

    if (issue.estimate !== undefined) {
      if (issue.estimate <= 1) score += 0;
      else if (issue.estimate <= 3) score += 1;
      else if (issue.estimate <= 5) score += 2;
      else score += 3;
    } else {
      score += 1;
    }

    const labelCount = issue.labelIds.length;
    if (labelCount === 0) score += 0;
    else if (labelCount <= 3) score += 1;
    else if (labelCount <= 6) score += 2;
    else score += 3;

    const blockerCount = issue.blockedByIssues.length;
    score += blockerCount * 2;

    if (issue.parentId) score += 1;

    const desc = issue.description.toLowerCase();
    if (this.matchesKeywords(desc, REFACTOR_KEYWORDS)) score += 2;
    if (this.matchesKeywords(desc, /migration|breaking change|api change|database schema/i)) score += 2;

    if (score <= 2) return Complexity.LOW;
    if (score <= 5) return Complexity.MEDIUM;
    if (score <= 8) return Complexity.HIGH;
    return Complexity.VERY_HIGH;
  }

  private classifyRecommendedAgent(issue: Issue, complexity: Complexity): string {
    const desc = `${issue.title} ${issue.description}`.toLowerCase();

    if (this.matchesKeywords(desc, BUG_KEYWORDS)) return 'codex';
    if (this.matchesKeywords(desc, REACT_KEYWORDS)) return 'claude';
    if (this.matchesKeywords(desc, REFACTOR_KEYWORDS)) return 'opencode';
    if (complexity === Complexity.HIGH || complexity === Complexity.VERY_HIGH) return 'opencode';
    return 'opencode';
  }

  private async assessRisks(issue: Issue, complexity: Complexity): Promise<string[]> {
    const risks: string[] = [];

    if (issue.blockedByIssues.length > 0) {
      risks.push(`Blocked by ${issue.blockedByIssues.length} issue(s): ${issue.blockedByIssues.join(', ')}`);
    }

    if (issue.blockingIssues.length > 0) {
      risks.push(`${issue.blockingIssues.length} other issue(s) depend on this`);
    }

    if (complexity === Complexity.VERY_HIGH) {
      risks.push('Very high complexity - likely to require multiple iterations');
    } else if (complexity === Complexity.HIGH) {
      risks.push('High complexity - may require architecture review');
    }

    if (issue.dueDate) {
      const now = new Date();
      const diffDays = Math.ceil((issue.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 2) {
        risks.push(`Tight deadline: due in ${diffDays} day(s)`);
      }
    }

    if (issue.parentId) {
      risks.push('Sub-issue: changes may propagate to parent issue');
    }

    const desc = `${issue.title} ${issue.description}`.toLowerCase();
    if (this.matchesKeywords(desc, /migration|breaking/i)) {
      risks.push('May introduce breaking changes');
    }
    if (this.matchesKeywords(desc, /database|schema|migration/i)) {
      risks.push('Database changes required - ensure rollback plan');
    }
    if (this.matchesKeywords(desc, /api|endpoint|controller/i)) {
      risks.push('API surface change - may affect consumers');
    }
    if (this.matchesKeywords(desc, /auth|login|permission|role|access control/i)) {
      risks.push('Security-sensitive area - requires careful review');
    }

    return risks;
  }

  private calculateDuration(complexity: Complexity, estimate: number, stepCount: number): number {
    const baseMinutes: Record<Complexity, number> = {
      [Complexity.LOW]: 15,
      [Complexity.MEDIUM]: 45,
      [Complexity.HIGH]: 90,
      [Complexity.VERY_HIGH]: 180,
    };

    let duration = baseMinutes[complexity];
    if (estimate > 0) {
      duration += estimate * 15;
    }
    duration += stepCount * 5;

    return Math.max(duration, 10);
  }

  private computeConfidence(issue: Issue, depCount: number, stepCount: number): number {
    let confidence = 0.8;
    if (issue.description.length < 50) confidence -= 0.2;
    else if (issue.description.length > 500) confidence += 0.1;
    confidence -= depCount * 0.05;
    if (stepCount > 5) confidence -= 0.1;
    if (issue.blockedByIssues.length > 0) confidence -= 0.1;
    return Math.max(0.1, Math.min(1.0, Math.round(confidence * 100) / 100));
  }

  private matchesKeywords(text: string, pattern: RegExp): boolean {
    return pattern.test(text);
  }

  private agentHasCapability(agent: AgentInfo, ...capabilities: string[]): boolean {
    return capabilities.some((c) => agent.capabilities.includes(c));
  }

  private isCapabilityRelevant(capability: string, combined: string): boolean {
    const map: Record<string, RegExp> = {
      frontend: /component|ui|react|vue|angular|frontend|css|style|layout|render|jsx|tsx/i,
      backend: /api|server|endpoint|database|sql|migration|orm|middleware/i,
      'full-stack': /full.?stack|end.to.end/i,
      refactoring: /refactor|clean.?up|improve|restructure|optimize/i,
      architecture: /architecture|design pattern|system design|microservice/i,
      'simple-bug': /bug|fix|patch|hotfix|typo|minor/i,
      'quick-fix': /quick|simple|minor|one.?line|trivial/i,
      design: /design|css|style|layout|responsive|ui\/ux/i,
      testing: /test|coverage|assert|mock|stub/i,
      documentation: /doc|readme|comment|jsdoc/i,
    };

    const pattern = map[capability];
    if (pattern) {
      return pattern.test(combined);
    }
    return false;
  }
}
