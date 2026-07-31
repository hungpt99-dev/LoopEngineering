import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentRouter } from '../../../src/application/services/AgentRouter.js';
import { Issue } from '../../../src/domain/entities/Issue.js';
import { ExecutionPlan } from '../../../src/domain/entities/ExecutionPlan.js';
import {
  IssueStatus,
  Priority,
  Complexity,
} from '../../../src/domain/value-objects/IssueStatus.js';
import { AgentInfo } from '../../../src/domain/interfaces/PlannerService.js';

function createIssue(overrides: Partial<{ title: string; description: string }> = {}) {
  return Issue.create({
    id: 'issue-1',
    title: overrides.title ?? 'Default issue',
    description: overrides.description ?? 'Default description',
    status: IssueStatus.CREATED,
    priority: Priority.MEDIUM,
    labelIds: [],
    labelNames: [],
    blockedByIssues: [],
    blockingIssues: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function createPlan(overrides: Partial<{ complexity: Complexity; recommendedAgent: string }> = {}) {
  return ExecutionPlan.create({
    issueId: 'issue-1',
    issueTitle: 'Test issue',
    complexity: overrides.complexity ?? Complexity.LOW,
    recommendedAgent: overrides.recommendedAgent ?? 'codex',
    confidence: 0.9,
    implementationSteps: ['step 1'],
    filesToInspect: [],
    risks: [],
    dependencies: [],
    estimatedDuration: 15,
    requiresArchitectureReview: false,
  });
}

const defaultAgents: AgentInfo[] = [
  { name: 'codex', capabilities: ['simple-bug', 'quick-fix'], enabled: true, priority: 20 },
  {
    name: 'opencode',
    capabilities: ['full-stack', 'refactoring', 'architecture'],
    enabled: true,
    priority: 15,
  },
  { name: 'claude', capabilities: ['frontend', 'react', 'design'], enabled: true, priority: 10 },
];

function mockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };
}

describe('AgentRouter', () => {
  let router: AgentRouter;
  let logger: ReturnType<typeof mockLogger>;

  beforeEach(() => {
    logger = mockLogger();
    router = new AgentRouter(logger as any);
  });

  describe('route', () => {
    it('should prefer codex for bug keywords', () => {
      const issue = createIssue({
        title: 'Fix login bug',
        description: 'There is a bug in the login flow',
      });
      const plan = createPlan();
      const result = router.route(issue, plan, defaultAgents);
      expect(result.name).toBe('codex');
    });

    it('should prefer opencode for refactor keywords', () => {
      const issue = createIssue({
        title: 'Refactor auth module',
        description: 'Major refactor of authentication',
      });
      const plan = createPlan();
      const result = router.route(issue, plan, defaultAgents);
      expect(result.name).toBe('opencode');
    });

    it('should prefer claude for UI/frontend keywords', () => {
      const issue = createIssue({
        title: 'Update component styles',
        description: 'Refactor the UI component layout and styles',
      });
      const plan = createPlan();
      const result = router.route(issue, plan, defaultAgents);
      expect(result.name).toBe('claude');
    });

    it('should prefer opencode for high complexity', () => {
      const issue = createIssue({ title: 'Generic task', description: 'Do something' });
      const plan = createPlan({ complexity: Complexity.HIGH });
      const result = router.route(issue, plan, defaultAgents);
      expect(result.name).toBe('opencode');
    });

    it('should prefer opencode for very_high complexity', () => {
      const issue = createIssue({ title: 'Generic task', description: 'Do something' });
      const plan = createPlan({ complexity: Complexity.VERY_HIGH });
      const result = router.route(issue, plan, defaultAgents);
      expect(result.name).toBe('opencode');
    });

    it('should pick highest priority enabled agent when no keyword matches', () => {
      const issue = createIssue({
        title: 'Generic task',
        description: 'Some generic description with no special keywords',
      });
      const plan = createPlan({ recommendedAgent: '' });
      const result = router.route(issue, plan, defaultAgents);
      expect(result.name).toBe('codex');
    });

    it('should follow plan recommendation when no keyword matches', () => {
      const agents: AgentInfo[] = [
        { name: 'opencode', capabilities: ['full-stack'], enabled: true, priority: 30 },
        { name: 'claude', capabilities: ['frontend'], enabled: true, priority: 10 },
      ];
      const issue = createIssue({ title: 'Generic', description: 'No special keywords here' });
      const plan = createPlan({ recommendedAgent: 'claude' });
      const result = router.route(issue, plan, agents);
      expect(result.name).toBe('claude');
    });

    it('should throw when no enabled agents', () => {
      const agents: AgentInfo[] = [
        { name: 'codex', capabilities: [], enabled: false, priority: 1 },
      ];
      const issue = createIssue();
      const plan = createPlan();
      expect(() => router.route(issue, plan, agents)).toThrow(
        'No enabled agents available for routing',
      );
    });

    it('should prefer codex for bug fix without conflicting keyword patterns', () => {
      const issue = createIssue({
        title: 'Fix the minor bug in parser',
        description: 'There is a hotfix needed for the patch',
      });
      const plan = createPlan();
      const result = router.route(issue, plan, defaultAgents);
      expect(result.name).toBe('codex');
    });

    it('should select agent with matching capability when no name preference matches', () => {
      const agents: AgentInfo[] = [
        { name: 'agent-a', capabilities: ['backend'], enabled: true, priority: 5 },
        { name: 'agent-b', capabilities: ['simple-bug'], enabled: true, priority: 6 },
      ];
      const issue = createIssue({ title: 'Fix bug', description: 'bug fix needed' });
      const plan = createPlan();
      const result = router.route(issue, plan, agents);
      expect(result.name).toBe('agent-b');
    });
  });
});
