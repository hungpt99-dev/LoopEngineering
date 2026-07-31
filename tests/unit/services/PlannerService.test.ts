import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlannerServiceImpl } from '../../../src/application/services/PlannerService.js';
import { Issue } from '../../../src/domain/entities/Issue.js';
import {
  Complexity,
  IssueStatus,
  Priority,
} from '../../../src/domain/value-objects/IssueStatus.js';
import { ExecutionPlan } from '../../../src/domain/entities/ExecutionPlan.js';
import { AgentInfo } from '../../../src/domain/interfaces/PlannerService.js';

function createIssue(
  overrides: Partial<{
    title: string;
    description: string;
    estimate?: number;
    blockedByIssues: string[];
    labelIds: string[];
    labelNames: string[];
    parentId?: string;
    dueDate?: Date;
  }> = {},
) {
  return Issue.create({
    id: 'issue-1',
    title: overrides.title ?? 'Test issue',
    description: overrides.description ?? 'Default description',
    status: IssueStatus.CREATED,
    priority: Priority.MEDIUM,
    labelIds: overrides.labelIds ?? [],
    labelNames: overrides.labelNames ?? [],
    blockedByIssues: overrides.blockedByIssues ?? [],
    blockingIssues: [],
    estimate: overrides.estimate,
    parentId: overrides.parentId,
    dueDate: overrides.dueDate,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function mockIssueRepo() {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByIds: vi.fn().mockResolvedValue([]),
    findNextIssue: vi.fn().mockResolvedValue(null),
    findByProjectId: vi.fn().mockResolvedValue([]),
    findByMilestoneId: vi.fn().mockResolvedValue([]),
    findAll: vi.fn().mockResolvedValue([]),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    addComment: vi.fn().mockResolvedValue(undefined),
    createIssue: vi.fn().mockResolvedValue(null),
    findProjectByName: vi.fn().mockResolvedValue(null),
    findProjectById: vi.fn().mockResolvedValue(null),
    findAllProjects: vi.fn().mockResolvedValue([]),
    findMilestoneByName: vi.fn().mockResolvedValue(null),
    findMilestoneById: vi.fn().mockResolvedValue(null),
    findAllMilestones: vi.fn().mockResolvedValue([]),
    createBlocker: vi.fn().mockResolvedValue(undefined),
  };
}

function mockContextBuilder() {
  return {
    buildIssueContext: vi.fn().mockResolvedValue('issue context'),
    buildProjectContext: vi.fn().mockResolvedValue('project context'),
    buildMilestoneContext: vi.fn().mockResolvedValue('milestone context'),
    buildFullContext: vi.fn().mockResolvedValue('full context'),
    detectDependencies: vi.fn().mockReturnValue(['lodash', 'express']),
    identifyFiles: vi.fn().mockReturnValue(['src/index.ts', 'src/app.ts']),
  };
}

function mockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };
}

describe('PlannerServiceImpl', () => {
  let service: PlannerServiceImpl;
  let issueRepo: ReturnType<typeof mockIssueRepo>;
  let contextBuilder: ReturnType<typeof mockContextBuilder>;
  let logger: ReturnType<typeof mockLogger>;

  beforeEach(() => {
    issueRepo = mockIssueRepo();
    contextBuilder = mockContextBuilder();
    logger = mockLogger();
    service = new PlannerServiceImpl(issueRepo as any, contextBuilder as any, logger as any);
  });

  describe('estimateComplexity', () => {
    it('should return LOW for short description', () => {
      const issue = createIssue({ description: 'Brief desc' });
      const result = service.estimateComplexity(issue);
      expect(result).toBe(Complexity.LOW);
    });

    it('should return MEDIUM for medium description', () => {
      const issue = createIssue({
        description: 'A'.repeat(300),
        estimate: 3,
        labelIds: ['label1', 'label2'],
      });
      const result = service.estimateComplexity(issue);
      expect(result).toBe(Complexity.MEDIUM);
    });

    it('should return HIGH for long description with high estimate', () => {
      const issue = createIssue({
        description: 'A'.repeat(600),
        estimate: 5,
        labelIds: ['a', 'b', 'c', 'd'],
      });
      const result = service.estimateComplexity(issue);
      expect(result).toBe(Complexity.HIGH);
    });

    it('should return VERY_HIGH with blockers and refactoring keywords', () => {
      const issue = createIssue({
        description: 'This is a refactor of the architecture module with many changes needed',
        estimate: 8,
        labelIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
        blockedByIssues: ['issue-2', 'issue-3'],
      });
      const result = service.estimateComplexity(issue);
      expect(result).toBe(Complexity.VERY_HIGH);
    });

    it('should increase complexity with parent issue', () => {
      const issue = createIssue({
        description: 'Some description',
        parentId: 'parent-1',
        labelIds: ['label1'],
      });
      const result = service.estimateComplexity(issue);
      expect(result).toBe(Complexity.MEDIUM);
    });
  });

  describe('planImplementation', () => {
    it('should return default step when description is empty', () => {
      const issue = createIssue({ title: 'My issue', description: '' });
      const steps = service.planImplementation(issue);
      expect(steps).toEqual(['Implement: My issue']);
    });

    it('should parse numbered steps', () => {
      const issue = createIssue({
        title: 'Setup auth',
        description: '1. Install JWT\n2. Create middleware\n3. Add routes',
      });
      const steps = service.planImplementation(issue);
      expect(steps).toEqual(['Install JWT', 'Create middleware', 'Add routes']);
    });

    it('should parse bullet point steps', () => {
      const issue = createIssue({
        title: 'Refactor module',
        description: '- Extract helper\n- Rename variables\n- Add tests',
      });
      const steps = service.planImplementation(issue);
      expect(steps).toEqual(['Extract helper', 'Rename variables', 'Add tests']);
    });

    it('should parse mixed numbered and bullet steps', () => {
      const issue = createIssue({
        title: 'Fix things',
        description: '1. First thing\n- Second thing\n2) Third thing',
      });
      const steps = service.planImplementation(issue);
      expect(steps).toContain('First thing');
      expect(steps).toContain('Second thing');
      expect(steps).toContain('Third thing');
    });

    it('should split plain text by sentences', () => {
      const issue = createIssue({
        title: 'Feature',
        description:
          'First we need to set up the database. Then we should create the API endpoints. Finally we add the frontend components.',
      });
      const steps = service.planImplementation(issue);
      expect(steps.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle whitespace-only description', () => {
      const issue = createIssue({ title: 'Cleanup', description: '   \n  \n' });
      const steps = service.planImplementation(issue);
      expect(steps.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeIssue', () => {
    it('should return ExecutionPlan with correct properties', async () => {
      const issue = createIssue({
        title: 'Add auth',
        description: 'Implement JWT-based authentication with secure token handling.',
        estimate: 3,
        labelIds: ['backend'],
      });

      const plan = await service.analyzeIssue(issue);

      expect(plan).toBeInstanceOf(ExecutionPlan);
      expect(plan.issueId).toBe('issue-1');
      expect(plan.issueTitle).toBe('Add auth');
      expect(plan.implementationSteps.length).toBeGreaterThan(0);
      expect(plan.filesToInspect).toEqual(['src/index.ts', 'src/app.ts']);
      expect(plan.dependencies).toEqual(['lodash', 'express']);
      expect(typeof plan.complexity).toBe('string');
      expect(typeof plan.recommendedAgent).toBe('string');
      expect(plan.confidence).toBeGreaterThan(0);
      expect(plan.confidence).toBeLessThanOrEqual(1);
      expect(plan.estimatedDuration).toBeGreaterThan(0);
    });

    it('should call detectDependencies and identifyFiles during analysis', async () => {
      const issue = createIssue();
      await service.analyzeIssue(issue);
      expect(contextBuilder.detectDependencies).toHaveBeenCalledWith(issue);
      expect(contextBuilder.identifyFiles).toHaveBeenCalledWith(issue);
    });

    it('should call issueRepository.findById during analysis', async () => {
      const issue = createIssue();
      await service.analyzeIssue(issue);
      expect(issueRepo.findById).toHaveBeenCalledWith('issue-1');
    });
  });

  describe('selectAgent', () => {
    const agents: AgentInfo[] = [
      { name: 'codex', capabilities: ['simple-bug', 'quick-fix'], enabled: true, priority: 20 },
      {
        name: 'opencode',
        capabilities: ['full-stack', 'architecture', 'refactoring'],
        enabled: true,
        priority: 15,
      },
      { name: 'claude', capabilities: ['frontend', 'react'], enabled: true, priority: 10 },
    ];

    it('should select highest scoring agent', () => {
      const issue = createIssue({ title: 'Fix bug', description: 'bug fix' });
      const plan = ExecutionPlan.create({
        issueId: 'issue-1',
        issueTitle: 'Fix bug',
        complexity: Complexity.LOW,
        recommendedAgent: 'opencode',
        confidence: 0.9,
        implementationSteps: ['step'],
        filesToInspect: [],
        risks: [],
        dependencies: [],
        estimatedDuration: 10,
        requiresArchitectureReview: false,
      });

      const result = service.selectAgent(issue, plan, agents);
      expect(typeof result).toBe('string');
      expect(['codex', 'opencode', 'claude']).toContain(result);
    });

    it('should throw when no agents are enabled', () => {
      const issue = createIssue();
      const plan = ExecutionPlan.create({
        issueId: 'issue-1',
        issueTitle: 'Test',
        complexity: Complexity.LOW,
        recommendedAgent: 'codex',
        confidence: 0.5,
        implementationSteps: [],
        filesToInspect: [],
        risks: [],
        dependencies: [],
        estimatedDuration: 10,
        requiresArchitectureReview: false,
      });
      const disabledAgents: AgentInfo[] = [
        { name: 'codex', capabilities: [], enabled: false, priority: 1 },
      ];
      expect(() => service.selectAgent(issue, plan, disabledAgents)).toThrow(
        'No enabled agents available',
      );
    });
  });
});
