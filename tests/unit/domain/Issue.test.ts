import { describe, it, expect } from 'vitest';
import { Issue } from '../../../src/domain/entities/Issue.js';
import { IssueStatus, Priority } from '../../../src/domain/value-objects/IssueStatus.js';

const baseProps = {
  id: 'issue-1',
  title: 'Fix login bug',
  description: 'The login page crashes when submitting invalid credentials.',
  status: IssueStatus.CREATED,
  priority: Priority.HIGH,
  projectId: 'proj-1',
  projectName: 'My Project',
  milestoneId: 'ms-1',
  milestoneName: 'Sprint 1',
  assigneeId: 'user-1',
  labelIds: ['bug', 'high-priority'],
  labelNames: ['Bug', 'High Priority'],
  parentId: undefined,
  blockedByIssues: [],
  blockingIssues: [],
  estimate: 3,
  dueDate: undefined,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  branchName: undefined,
};

describe('Issue', () => {
  describe('creation', () => {
    it('should create an Issue with valid props', () => {
      const issue = Issue.create(baseProps);
      expect(issue).toBeInstanceOf(Issue);
      expect(issue.id).toBe('issue-1');
      expect(issue.title).toBe('Fix login bug');
    });

    it('should throw on invalid props', () => {
      expect(() => Issue.create({ ...baseProps, id: '' })).toThrow();
    });

    it('should throw with empty title', () => {
      expect(() => Issue.create({ ...baseProps, title: '' })).toThrow();
    });
  });

  describe('properties', () => {
    it('should expose all getters correctly', () => {
      const issue = Issue.create(baseProps);
      expect(issue.id).toBe('issue-1');
      expect(issue.title).toBe('Fix login bug');
      expect(issue.description).toBe('The login page crashes when submitting invalid credentials.');
      expect(issue.status).toBe(IssueStatus.CREATED);
      expect(issue.priority).toBe(Priority.HIGH);
      expect(issue.projectId).toBe('proj-1');
      expect(issue.projectName).toBe('My Project');
      expect(issue.milestoneId).toBe('ms-1');
      expect(issue.milestoneName).toBe('Sprint 1');
      expect(issue.assigneeId).toBe('user-1');
      expect(issue.labelIds).toEqual(['bug', 'high-priority']);
      expect(issue.labelNames).toEqual(['Bug', 'High Priority']);
      expect(issue.parentId).toBeUndefined();
      expect(issue.blockedByIssues).toEqual([]);
      expect(issue.blockingIssues).toEqual([]);
      expect(issue.estimate).toBe(3);
      expect(issue.dueDate).toBeUndefined();
      expect(issue.createdAt).toEqual(new Date('2024-01-01'));
      expect(issue.updatedAt).toEqual(new Date('2024-01-01'));
      expect(issue.branchName).toBeUndefined();
    });
  });

  describe('isBlocked', () => {
    it('should return false when no blockedByIssues', () => {
      const issue = Issue.create(baseProps);
      expect(issue.isBlocked).toBe(false);
    });

    it('should return true when there are blockedByIssues', () => {
      const issue = Issue.create({ ...baseProps, blockedByIssues: ['issue-2'] });
      expect(issue.isBlocked).toBe(true);
    });
  });

  describe('isInProgress', () => {
    it.each([
      IssueStatus.ANALYZING,
      IssueStatus.PLANNING,
      IssueStatus.CODING,
      IssueStatus.TESTING,
      IssueStatus.REVIEWING,
      IssueStatus.RETRY,
    ])('should return true for active status %s', (status) => {
      const issue = Issue.create({ ...baseProps, status });
      expect(issue.isInProgress).toBe(true);
    });

    it('should return false for CREATED', () => {
      const issue = Issue.create({ ...baseProps, status: IssueStatus.CREATED });
      expect(issue.isInProgress).toBe(false);
    });

    it('should return false for COMPLETED', () => {
      const issue = Issue.create({ ...baseProps, status: IssueStatus.COMPLETED });
      expect(issue.isInProgress).toBe(false);
    });

    it('should return false for FAILED', () => {
      const issue = Issue.create({ ...baseProps, status: IssueStatus.FAILED });
      expect(issue.isInProgress).toBe(false);
    });
  });

  describe('isCompleted', () => {
    it('should return true when status is COMPLETED', () => {
      const issue = Issue.create({ ...baseProps, status: IssueStatus.COMPLETED });
      expect(issue.isCompleted).toBe(true);
    });

    it('should return false for non-COMPLETED statuses', () => {
      const issue = Issue.create({ ...baseProps, status: IssueStatus.CREATED });
      expect(issue.isCompleted).toBe(false);
    });
  });

  describe('canTransitionTo', () => {
    it('CREATED → ANALYZING should be valid', () => {
      const issue = Issue.create({ ...baseProps, status: IssueStatus.CREATED });
      expect(issue.canTransitionTo(IssueStatus.ANALYZING)).toBe(true);
    });

    it('CREATED → PLANNING should be invalid', () => {
      const issue = Issue.create({ ...baseProps, status: IssueStatus.CREATED });
      expect(issue.canTransitionTo(IssueStatus.PLANNING)).toBe(false);
    });

    it('ANALYZING → PLANNING should be valid', () => {
      const issue = Issue.create({ ...baseProps, status: IssueStatus.ANALYZING });
      expect(issue.canTransitionTo(IssueStatus.PLANNING)).toBe(true);
    });

    it('ANALYZING → FAILED should be valid', () => {
      const issue = Issue.create({ ...baseProps, status: IssueStatus.ANALYZING });
      expect(issue.canTransitionTo(IssueStatus.FAILED)).toBe(true);
    });

    it('ANALYZING → CODING should be invalid', () => {
      const issue = Issue.create({ ...baseProps, status: IssueStatus.ANALYZING });
      expect(issue.canTransitionTo(IssueStatus.CODING)).toBe(false);
    });

    it('PLANNING → CODING should be valid', () => {
      const issue = Issue.create({ ...baseProps, status: IssueStatus.PLANNING });
      expect(issue.canTransitionTo(IssueStatus.CODING)).toBe(true);
    });

    it('PLANNING → FAILED should be valid', () => {
      const issue = Issue.create({ ...baseProps, status: IssueStatus.PLANNING });
      expect(issue.canTransitionTo(IssueStatus.FAILED)).toBe(true);
    });

    it('PLANNING → TESTING should be invalid', () => {
      const issue = Issue.create({ ...baseProps, status: IssueStatus.PLANNING });
      expect(issue.canTransitionTo(IssueStatus.TESTING)).toBe(false);
    });

    it('CODING → TESTING should be valid', () => {
      const issue = Issue.create({ ...baseProps, status: IssueStatus.CODING });
      expect(issue.canTransitionTo(IssueStatus.TESTING)).toBe(true);
    });

    it('CODING → FAILED should be valid', () => {
      const issue = Issue.create({ ...baseProps, status: IssueStatus.CODING });
      expect(issue.canTransitionTo(IssueStatus.FAILED)).toBe(true);
    });

    it('CODING → REVIEWING should be invalid', () => {
      const issue = Issue.create({ ...baseProps, status: IssueStatus.CODING });
      expect(issue.canTransitionTo(IssueStatus.REVIEWING)).toBe(false);
    });

    it('TESTING → REVIEWING should be valid', () => {
      const issue = Issue.create({ ...baseProps, status: IssueStatus.TESTING });
      expect(issue.canTransitionTo(IssueStatus.REVIEWING)).toBe(true);
    });

    it('TESTING → RETRY should be valid', () => {
      const issue = Issue.create({ ...baseProps, status: IssueStatus.TESTING });
      expect(issue.canTransitionTo(IssueStatus.RETRY)).toBe(true);
    });

    it('TESTING → FAILED should be valid', () => {
      const issue = Issue.create({ ...baseProps, status: IssueStatus.TESTING });
      expect(issue.canTransitionTo(IssueStatus.FAILED)).toBe(true);
    });

    it('REVIEWING → COMPLETED should be valid', () => {
      const issue = Issue.create({ ...baseProps, status: IssueStatus.REVIEWING });
      expect(issue.canTransitionTo(IssueStatus.COMPLETED)).toBe(true);
    });

    it('REVIEWING → RETRY should be valid', () => {
      const issue = Issue.create({ ...baseProps, status: IssueStatus.REVIEWING });
      expect(issue.canTransitionTo(IssueStatus.RETRY)).toBe(true);
    });

    it('REVIEWING → FAILED should be valid', () => {
      const issue = Issue.create({ ...baseProps, status: IssueStatus.REVIEWING });
      expect(issue.canTransitionTo(IssueStatus.FAILED)).toBe(true);
    });

    it('FAILED → RETRY should be valid', () => {
      const issue = Issue.create({ ...baseProps, status: IssueStatus.FAILED });
      expect(issue.canTransitionTo(IssueStatus.RETRY)).toBe(true);
    });

    it('FAILED → CREATED should be invalid', () => {
      const issue = Issue.create({ ...baseProps, status: IssueStatus.FAILED });
      expect(issue.canTransitionTo(IssueStatus.CREATED)).toBe(false);
    });

    it('RETRY → CODING should be valid', () => {
      const issue = Issue.create({ ...baseProps, status: IssueStatus.RETRY });
      expect(issue.canTransitionTo(IssueStatus.CODING)).toBe(true);
    });

    it('RETRY → PLANNING should be invalid', () => {
      const issue = Issue.create({ ...baseProps, status: IssueStatus.RETRY });
      expect(issue.canTransitionTo(IssueStatus.PLANNING)).toBe(false);
    });

    it('COMPLETED → any status should be invalid', () => {
      const issue = Issue.create({ ...baseProps, status: IssueStatus.COMPLETED });
      const allStatuses = Object.values(IssueStatus);
      for (const status of allStatuses) {
        expect(issue.canTransitionTo(status)).toBe(false);
      }
    });

    it('CREATED → COMPLETED should be invalid (skip all steps)', () => {
      const issue = Issue.create({ ...baseProps, status: IssueStatus.CREATED });
      expect(issue.canTransitionTo(IssueStatus.COMPLETED)).toBe(false);
    });
  });

  describe('withStatus', () => {
    it('should return a new Issue with updated status', () => {
      const issue = Issue.create(baseProps);
      const updated = issue.withStatus(IssueStatus.ANALYZING);
      expect(updated.status).toBe(IssueStatus.ANALYZING);
      expect(issue.status).toBe(IssueStatus.CREATED);
      expect(updated.id).toBe(issue.id);
    });
  });

  describe('withBranchName', () => {
    it('should return a new Issue with updated branchName', () => {
      const issue = Issue.create(baseProps);
      const updated = issue.withBranchName('feat/issue-1');
      expect(updated.branchName).toBe('feat/issue-1');
      expect(issue.branchName).toBeUndefined();
      expect(updated.id).toBe(issue.id);
    });
  });

  describe('toJSON', () => {
    it('should return all props as a plain object', () => {
      const issue = Issue.create(baseProps);
      const json = issue.toJSON();
      expect(json).toEqual(baseProps);
    });

    it('should return a distinct copy', () => {
      const issue = Issue.create(baseProps);
      const json = issue.toJSON();
      json.id = 'modified';
      expect(issue.id).toBe('issue-1');
    });
  });
});
