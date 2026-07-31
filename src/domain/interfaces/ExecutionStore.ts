import type { ExecutionHistory } from '../entities/ExecutionHistory.js';

export interface CreateExecutionRecordInput {
  issueId: string;
  issueTitle: string;
  projectId?: string;
  milestoneId?: string;
  agentUsed: string;
  status: string;
  duration?: number;
  tokenUsage?: number;
  result?: string;
  error?: string;
  branch?: string;
  commit?: string;
  retries: Array<{ attempt: number; status: string; error?: string; duration?: number }>;
}

export interface UpdateExecutionRecordInput {
  issueTitle?: string;
  projectId?: string;
  milestoneId?: string;
  agentUsed?: string;
  status?: string;
  duration?: number;
  tokenUsage?: number;
  result?: string;
  error?: string;
  branch?: string;
  commit?: string;
}

export interface ExecutionStore {
  save(record: CreateExecutionRecordInput): Promise<ExecutionHistory>;
  findById(id: string): Promise<ExecutionHistory | null>;
  findByIssueId(issueId: string): Promise<ExecutionHistory[]>;
  findByStatus(status: string): Promise<ExecutionHistory[]>;
  findAll(limit?: number): Promise<ExecutionHistory[]>;
  update(id: string, data: UpdateExecutionRecordInput): Promise<ExecutionHistory>;
  addRetry(
    recordId: string,
    retry: { attempt: number; status: string; error?: string; duration?: number },
  ): Promise<void>;
}

export const EXECUTION_STORE = Symbol('ExecutionStore');
