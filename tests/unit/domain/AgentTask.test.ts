import { describe, it, expect } from 'vitest';
import { AgentTask } from '../../../src/domain/entities/AgentTask.js';
import { Complexity } from '../../../src/domain/value-objects/IssueStatus.js';

const baseProps = {
  id: 'task-1',
  issueId: 'issue-1',
  issueTitle: 'Add user authentication',
  issueDescription: 'Implement JWT-based authentication with refresh tokens.',
  projectContext: 'This is a Node.js project using Express.',
  milestoneContext: 'Q3 Authentication milestone.',
  dependencies: ['jsonwebtoken', 'bcrypt'],
  filesToInspect: ['src/auth/login.ts', 'src/auth/register.ts'],
  implementationSteps: ['Set up JWT utility', 'Create login endpoint', 'Add middleware'],
  complexity: Complexity.MEDIUM,
  branchName: 'feat/auth',
  environment: { NODE_ENV: 'test' },
};

describe('AgentTask', () => {
  describe('creation', () => {
    it('should create an AgentTask with valid props', () => {
      const task = AgentTask.create(baseProps);
      expect(task).toBeInstanceOf(AgentTask);
      expect(task.id).toBe('task-1');
    });

    it('should throw on invalid id', () => {
      expect(() => AgentTask.create({ ...baseProps, id: '' })).toThrow();
    });

    it('should throw when required fields are invalid', () => {
      expect(() => AgentTask.create({ ...baseProps, id: '' })).toThrow();
    });
  });

  describe('properties', () => {
    it('should expose all getters correctly', () => {
      const task = AgentTask.create(baseProps);
      expect(task.id).toBe('task-1');
      expect(task.issueId).toBe('issue-1');
      expect(task.issueTitle).toBe('Add user authentication');
      expect(task.issueDescription).toBe('Implement JWT-based authentication with refresh tokens.');
      expect(task.projectContext).toBe('This is a Node.js project using Express.');
      expect(task.milestoneContext).toBe('Q3 Authentication milestone.');
      expect(task.dependencies).toEqual(['jsonwebtoken', 'bcrypt']);
      expect(task.filesToInspect).toEqual(['src/auth/login.ts', 'src/auth/register.ts']);
      expect(task.implementationSteps).toEqual([
        'Set up JWT utility',
        'Create login endpoint',
        'Add middleware',
      ]);
      expect(task.complexity).toBe(Complexity.MEDIUM);
      expect(task.branchName).toBe('feat/auth');
      expect(task.environment).toEqual({ NODE_ENV: 'test' });
    });

    it('should handle optional fields as undefined', () => {
      const task = AgentTask.create({
        ...baseProps,
        projectContext: undefined,
        milestoneContext: undefined,
      });
      expect(task.projectContext).toBeUndefined();
      expect(task.milestoneContext).toBeUndefined();
    });
  });

  describe('fullContext', () => {
    it('should include all sections when everything is provided', () => {
      const task = AgentTask.create(baseProps);
      const context = task.fullContext;

      expect(context).toContain('## Project Context');
      expect(context).toContain('This is a Node.js project using Express.');
      expect(context).toContain('## Milestone Context');
      expect(context).toContain('Q3 Authentication milestone.');
      expect(context).toContain('## Issue');
      expect(context).toContain('Add user authentication');
      expect(context).toContain('Implement JWT-based authentication with refresh tokens.');
      expect(context).toContain('## Implementation Plan');
      expect(context).toContain('1. Set up JWT utility');
      expect(context).toContain('2. Create login endpoint');
      expect(context).toContain('3. Add middleware');
      expect(context).toContain('## Relevant Files');
      expect(context).toContain('src/auth/login.ts');
      expect(context).toContain('src/auth/register.ts');
      expect(context).toContain('## Dependencies');
      expect(context).toContain('jsonwebtoken');
      expect(context).toContain('bcrypt');
    });

    it('should omit projectContext section when undefined', () => {
      const task = AgentTask.create({ ...baseProps, projectContext: undefined });
      const context = task.fullContext;
      expect(context).not.toContain('## Project Context');
    });

    it('should omit milestoneContext section when undefined', () => {
      const task = AgentTask.create({ ...baseProps, milestoneContext: undefined });
      const context = task.fullContext;
      expect(context).not.toContain('## Milestone Context');
    });

    it('should omit Implementation Plan when steps empty', () => {
      const task = AgentTask.create({ ...baseProps, implementationSteps: [] });
      const context = task.fullContext;
      expect(context).not.toContain('## Implementation Plan');
    });

    it('should omit Relevant Files when empty', () => {
      const task = AgentTask.create({ ...baseProps, filesToInspect: [] });
      const context = task.fullContext;
      expect(context).not.toContain('## Relevant Files');
    });

    it('should omit Dependencies when empty', () => {
      const task = AgentTask.create({ ...baseProps, dependencies: [] });
      const context = task.fullContext;
      expect(context).not.toContain('## Dependencies');
    });

    it('should always include Issue section', () => {
      const task = AgentTask.create(baseProps);
      const context = task.fullContext;
      expect(context).toContain('## Issue');
      expect(context).toContain(baseProps.issueTitle);
      expect(context).toContain(baseProps.issueDescription);
    });
  });

  describe('toJSON', () => {
    it('should return all props as a plain object', () => {
      const task = AgentTask.create(baseProps);
      const json = task.toJSON();
      expect(json).toEqual(baseProps);
    });

    it('should return a distinct copy', () => {
      const task = AgentTask.create(baseProps);
      const json = task.toJSON();
      json.issueTitle = 'changed';
      expect(task.issueTitle).toBe('Add user authentication');
    });
  });
});
