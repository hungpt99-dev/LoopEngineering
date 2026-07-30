import { Issue } from '../entities/Issue.js';
import { ExecutionPlan } from '../entities/ExecutionPlan.js';

export interface ContextBuilder {
  buildIssueContext(issue: Issue): Promise<string>;
  buildProjectContext(projectId: string): Promise<string>;
  buildMilestoneContext(projectId: string, milestoneId: string): Promise<string>;
  buildFullContext(issue: Issue, plan: ExecutionPlan): Promise<string>;
  detectDependencies(issue: Issue): Promise<string[]>;
  identifyFiles(issue: Issue): Promise<string[]>;
}

export const CONTEXT_BUILDER = Symbol('ContextBuilder');
