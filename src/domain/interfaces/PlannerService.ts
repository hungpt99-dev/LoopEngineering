import { Issue } from '../entities/Issue.js';
import { ExecutionPlan } from '../entities/ExecutionPlan.js';
import { Complexity } from '../value-objects/IssueStatus.js';

export interface PlannerService {
  analyzeIssue(issue: Issue): Promise<ExecutionPlan>;
  selectAgent(issue: Issue, plan: ExecutionPlan, availableAgents: AgentInfo[]): string;
  planImplementation(issue: Issue): string[];
  estimateComplexity(issue: Issue): Complexity;
}

export interface AgentInfo {
  name: string;
  capabilities: string[];
  enabled: boolean;
  priority: number;
}

export const PLANNER_SERVICE = Symbol('PlannerService');
