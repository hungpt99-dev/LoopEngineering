import { Issue } from '../entities/Issue.js';
import { ExecutionPlan } from '../entities/ExecutionPlan.js';
import { Complexity } from '../value-objects/IssueStatus.js';

export interface PlannerService {
  analyzeIssue(issue: Issue): Promise<ExecutionPlan>;
  selectAgent(
    issue: Issue,
    plan: ExecutionPlan,
    availableAgents: AgentInfo[],
  ): Promise<string>;
  planImplementation(issue: Issue): Promise<string[]>;
  estimateComplexity(issue: Issue): Promise<Complexity>;
}

export interface AgentInfo {
  name: string;
  capabilities: string[];
  enabled: boolean;
  priority: number;
}

export const PLANNER_SERVICE = Symbol('PlannerService');
