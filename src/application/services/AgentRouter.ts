import { injectable, inject } from 'tsyringe';
import { Issue } from '../../domain/entities/Issue.js';
import { ExecutionPlan } from '../../domain/entities/ExecutionPlan.js';
import { AgentInfo } from '../../domain/interfaces/PlannerService.js';
import { Logger, LOGGER } from '../../domain/interfaces/Logger.js';
import { Complexity } from '../../domain/value-objects/IssueStatus.js';

const BUG_FIX_PATTERN = /\bbug\b|\bfix\b|\bpatch\b|\bhotfix\b|\btypo\b|\bminor\b|\bquick\s*fix\b/i;
const REFACTOR_PATTERN =
  /\brefactor\b|\barchitecture\b|\bredesign\b|\brestructure\b|\boverhaul\b|\bmigrate\b|\brenovate\b/i;
const FRONTEND_PATTERN =
  /\bcomponent\b|\bui\b|\breact\b|\bvue\b|\bfrontend\b|\bcss\b|\bstyle\b|\blayout\b|\brespons\w+\b|\banimation\b|\bjsx\b|\btsx\b|\bmaterial[-\s]?ui\b|\btailwind\b/i;

const AGENT_DESCRIPTIONS: Record<string, string> = {
  codex:
    'OpenAI Codex - specialized in quick fixes, bug patches, and simple feature implementations',
  opencode:
    'OpenCode - full-stack agent capable of large refactors, architecture changes, and complex implementations',
  claude:
    'Anthropic Claude - excels at frontend development, UI components, and visual design work',
};

@injectable()
export class AgentRouter {
  constructor(@inject(LOGGER) private readonly logger: Logger) {}

  route(issue: Issue, plan: ExecutionPlan, agents: AgentInfo[]): AgentInfo {
    const enabled = agents.filter((a) => a.enabled);
    if (enabled.length === 0) {
      this.logger.error('No enabled agents available for routing', undefined, {
        issueId: issue.id,
      });
      throw new Error('No enabled agents available for routing');
    }

    const desc = `${issue.title} ${issue.description}`.toLowerCase();
    let preferredAgentName: string | null = null;
    let reason = '';

    if (BUG_FIX_PATTERN.test(desc)) {
      preferredAgentName = 'codex';
      reason = 'issue classified as bug fix / quick fix';
    }

    if (REFACTOR_PATTERN.test(desc)) {
      preferredAgentName = 'opencode';
      reason = 'issue classified as refactor / architecture change';
    }

    if (FRONTEND_PATTERN.test(desc)) {
      preferredAgentName = 'claude';
      reason = 'issue classified as frontend / UI work';
    }

    if (
      (plan.complexity === Complexity.HIGH || plan.complexity === Complexity.VERY_HIGH) &&
      !preferredAgentName
    ) {
      preferredAgentName = 'opencode';
      reason = `complexity is ${plan.complexity}`;
    }

    if (!preferredAgentName) {
      preferredAgentName = plan.recommendedAgent || null;
      reason = preferredAgentName
        ? `following plan recommendation: ${preferredAgentName}`
        : 'no classification match, using default';
    }

    const scores = enabled.map((agent) => {
      let score = agent.priority;

      if (agent.name === preferredAgentName) {
        score += 50;
      }

      if (this.agentMatchesIssue(agent, desc)) {
        score += 20;
      }

      return { agent, score };
    });

    scores.sort((a, b) => b.score - a.score);
    const best = scores[0];
    if (!best) {
      throw new Error('Agent scoring produced no result');
    }

    this.logger.info('Agent routed', {
      issueId: issue.id,
      selected: best.agent.name,
      score: best.score,
      reason,
      complexity: plan.complexity,
    });

    return best.agent;
  }

  describeAgent(agent: AgentInfo): string {
    const base = AGENT_DESCRIPTIONS[agent.name] ?? `${agent.name} - general-purpose coding agent`;
    const capabilities =
      agent.capabilities.length > 0 ? `\nCapabilities: ${agent.capabilities.join(', ')}` : '';
    const priority = `\nPriority: ${agent.priority}`;
    const status = agent.enabled ? 'Enabled' : 'Disabled';
    return `${base}\nStatus: ${status}${capabilities}${priority}`;
  }

  private agentMatchesIssue(agent: AgentInfo, desc: string): boolean {
    const capabilityPatterns: Record<string, RegExp> = {
      'simple-bug': /\bbug\b|\bfix\b|\bpatch\b/i,
      'quick-fix': /\bquick\b|\bminor\b|\btypo\b|\btiny\b/i,
      frontend: /\bcomponent\b|\bui\b|\breact\b|\bvue\b|\bfrontend\b|\bcss\b/i,
      react: /\breact\b|\bjsx\b|\btsx\b|\bcomponent\b/i,
      backend: /\bapi\b|\bserver\b|\bendpoint\b|\bdatabase\b|\bsql\b/i,
      architecture: /\barchitecture\b|\bdesign\s+pattern\b|\bsystem\s+design\b/i,
      refactoring: /\brefactor\b|\bcleanup\b|\bimprove\b/i,
      'full-stack': /\bfull.?stack\b|\bend.?to.?end\b/i,
      design: /\bdesign\b|\bcss\b|\bstyle\b|\blayout\b|\bresponsive\b/i,
      testing: /\btest\b|\bcoverage\b|\bassert\b|\bmock\b/i,
      documentation: /\bdoc\b|\breadme\b|\bcomment\b/i,
    };

    return agent.capabilities.some((cap) => {
      const pattern = capabilityPatterns[cap];
      return pattern ? pattern.test(desc) : false;
    });
  }
}
