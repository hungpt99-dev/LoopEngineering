import { AgentTask } from '../entities/AgentTask.js';
import { AgentExecutionResult } from '../entities/AgentExecutionResult.js';

export interface CodingAgentProvider {
  readonly name: string;
  readonly capabilities: string[];

  execute(task: AgentTask): Promise<AgentExecutionResult>;
  isAvailable(): Promise<boolean>;
  validateEnvironment(): string[];
}

export const CODING_AGENT_PROVIDER = Symbol('CodingAgentProvider');
