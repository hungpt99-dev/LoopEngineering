import { describe, it, expect } from 'vitest';
import { ExecutionPlan } from '../../../src/domain/entities/ExecutionPlan.js';
import { Complexity } from '../../../src/domain/value-objects/IssueStatus.js';

const baseProps = {
  issueId: 'issue-1',
  issueTitle: 'Add user authentication',
  complexity: Complexity.MEDIUM,
  recommendedAgent: 'opencode',
  confidence: 0.85,
  implementationSteps: ['Set up JWT utility', 'Create login endpoint'],
  filesToInspect: ['src/auth/login.ts'],
  risks: ['Tight deadline: due in 1 day(s)'],
  dependencies: ['jsonwebtoken'],
  estimatedDuration: 60,
  requiresArchitectureReview: false,
};

describe('ExecutionPlan', () => {
  describe('create', () => {
    it('should create an ExecutionPlan with valid data', () => {
      const plan = ExecutionPlan.create(baseProps);
      expect(plan).toBeInstanceOf(ExecutionPlan);
      expect(plan.issueId).toBe('issue-1');
    });

    it('should throw when estimatedDuration is negative', () => {
      expect(() =>
        ExecutionPlan.create({ ...baseProps, estimatedDuration: -5 }),
      ).toThrow();
    });

    it('should throw when confidence is out of range', () => {
      expect(() =>
        ExecutionPlan.create({ ...baseProps, confidence: 1.5 }),
      ).toThrow();
    });

    it('should throw when confidence is negative', () => {
      expect(() =>
        ExecutionPlan.create({ ...baseProps, confidence: -0.1 }),
      ).toThrow();
    });

    it('should throw when estimatedDuration is not positive', () => {
      expect(() =>
        ExecutionPlan.create({ ...baseProps, estimatedDuration: 0 }),
      ).toThrow();
    });

    it('should throw with invalid complexity', () => {
      expect(() =>
        ExecutionPlan.create({ ...baseProps, complexity: 'invalid' as Complexity }),
      ).toThrow();
    });
  });

  describe('getters', () => {
    it('should expose all getters correctly', () => {
      const plan = ExecutionPlan.create(baseProps);
      expect(plan.issueId).toBe('issue-1');
      expect(plan.issueTitle).toBe('Add user authentication');
      expect(plan.complexity).toBe(Complexity.MEDIUM);
      expect(plan.recommendedAgent).toBe('opencode');
      expect(plan.confidence).toBe(0.85);
      expect(plan.implementationSteps).toEqual(['Set up JWT utility', 'Create login endpoint']);
      expect(plan.filesToInspect).toEqual(['src/auth/login.ts']);
      expect(plan.risks).toEqual(['Tight deadline: due in 1 day(s)']);
      expect(plan.dependencies).toEqual(['jsonwebtoken']);
      expect(plan.estimatedDuration).toBe(60);
      expect(plan.requiresArchitectureReview).toBe(false);
    });

    it('should allow confidence at boundaries', () => {
      const planLow = ExecutionPlan.create({ ...baseProps, confidence: 0 });
      expect(planLow.confidence).toBe(0);

      const planHigh = ExecutionPlan.create({ ...baseProps, confidence: 1 });
      expect(planHigh.confidence).toBe(1);
    });

    it('should handle requiresArchitectureReview true', () => {
      const plan = ExecutionPlan.create({ ...baseProps, requiresArchitectureReview: true });
      expect(plan.requiresArchitectureReview).toBe(true);
    });
  });

  describe('toJSON', () => {
    it('should return all props as a plain object', () => {
      const plan = ExecutionPlan.create(baseProps);
      const json = plan.toJSON();
      expect(json).toEqual(baseProps);
    });

    it('should return a distinct copy', () => {
      const plan = ExecutionPlan.create(baseProps);
      const json = plan.toJSON();
      json.issueTitle = 'changed';
      expect(plan.issueTitle).toBe('Add user authentication');
    });
  });
});
