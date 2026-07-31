import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowEngine } from '../../../src/application/services/WorkflowEngine.js';
import { IssueStatus } from '../../../src/domain/value-objects/IssueStatus.js';

function mockIssueRepo() {
  return {
    findNextIssue: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(null),
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

function mockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };
}

function mockConfig() {
  return {
    agents: {},
    execution: {
      maxRetries: 3,
      autoCommit: true,
      autoPush: false,
      dryRun: false,
      parallel: false,
    },
    review: {
      autoApproveTestsPassing: true,
      createIssuesForChanges: false,
    },
    workspace: {
      defaultBranch: 'main',
      branchPrefix: 'ai/',
    },
  };
}

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;
  let issueRepo: ReturnType<typeof mockIssueRepo>;
  let logger: ReturnType<typeof mockLogger>;
  let config: ReturnType<typeof mockConfig>;

  beforeEach(() => {
    issueRepo = mockIssueRepo();
    logger = mockLogger();
    config = mockConfig();
    engine = new WorkflowEngine(issueRepo as any, logger as any, config as any);
  });

  describe('validateTransition', () => {
    it('should return true for valid transition CREATED → ANALYZING', () => {
      const result = engine.validateTransition('issue-1', 'CREATED', 'ANALYZING');
      expect(result).toBe(true);
    });

    it('should return true for ANALYZING → PLANNING', () => {
      const result = engine.validateTransition('issue-2', 'ANALYZING', 'PLANNING');
      expect(result).toBe(true);
    });

    it('should return true for PLANNING → CODING', () => {
      const result = engine.validateTransition('issue-3', 'PLANNING', 'CODING');
      expect(result).toBe(true);
    });

    it('should return true for CODING → TESTING', () => {
      const result = engine.validateTransition('issue-4', 'CODING', 'TESTING');
      expect(result).toBe(true);
    });

    it('should return true for TESTING → REVIEWING', () => {
      const result = engine.validateTransition('issue-5', 'TESTING', 'REVIEWING');
      expect(result).toBe(true);
    });

    it('should return true for REVIEWING → COMPLETED', () => {
      const result = engine.validateTransition('issue-6', 'REVIEWING', 'COMPLETED');
      expect(result).toBe(true);
    });

    it('should return false for invalid transition CREATED → CODING', () => {
      const result = engine.validateTransition('issue-7', 'CREATED', 'CODING');
      expect(result).toBe(false);
    });

    it('should return false for COMPLETED → any state', () => {
      const result = engine.validateTransition('issue-8', 'COMPLETED', 'ANALYZING');
      expect(result).toBe(false);
    });

    it('should return false for unknown source state', () => {
      const result = engine.validateTransition('issue-9', 'NONEXISTENT', 'CREATED');
      expect(result).toBe(false);
    });

    it('should log warning for invalid transition', () => {
      engine.validateTransition('issue-10', 'CREATED', 'COMPLETED');
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('advanceState', () => {
    it('should call issueRepository.updateStatus with correct params', async () => {
      await engine.advanceState('issue-1', IssueStatus.ANALYZING);
      expect(issueRepo.updateStatus).toHaveBeenCalledWith('issue-1', IssueStatus.ANALYZING);
    });

    it('should log the state advancement', async () => {
      await engine.advanceState('issue-2', IssueStatus.PLANNING);
      expect(logger.info).toHaveBeenCalledWith('Advancing state', {
        issueId: 'issue-2',
        to: IssueStatus.PLANNING,
      });
    });
  });

  describe('markFailed', () => {
    it('should update status to FAILED', async () => {
      await engine.markFailed('issue-1', 'Build error');
      expect(issueRepo.updateStatus).toHaveBeenCalledWith('issue-1', IssueStatus.FAILED);
    });

    it('should add a comment with the error', async () => {
      await engine.markFailed('issue-2', 'Test failure: expected true got false');
      expect(issueRepo.addComment).toHaveBeenCalled();
      const commentCall = issueRepo.addComment.mock.calls[0];
      expect(commentCall[0]).toBe('issue-2');
      expect(commentCall[1]).toContain('Test failure: expected true got false');
      expect(commentCall[1]).toContain('Execution Failed');
    });

    it('should log the error', async () => {
      await engine.markFailed('issue-3', 'Something went wrong');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('setExecutor', () => {
    it('should set an executor without error', () => {
      const executor = { execute: vi.fn().mockResolvedValue(undefined) };
      expect(() => engine.setExecutor(executor)).not.toThrow();
    });
  });

  describe('stop', () => {
    it('should stop without error', () => {
      expect(engine.stop()).toBeUndefined();
    });
  });

  describe('runAutonomous', () => {
    it('should throw when no executor configured', async () => {
      await expect(engine.runAutonomous()).rejects.toThrow('No executor configured');
    });
  });
});
