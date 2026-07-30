import { ExecutionHistory } from '../entities/ExecutionHistory.js';

export interface ExecutionStore {
  save(record: Omit<ExecutionHistory, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExecutionHistory>;
  findById(id: string): Promise<ExecutionHistory | null>;
  findByIssueId(issueId: string): Promise<ExecutionHistory[]>;
  findByStatus(status: string): Promise<ExecutionHistory[]>;
  findAll(limit?: number): Promise<ExecutionHistory[]>;
  update(id: string, data: Partial<ExecutionHistory>): Promise<ExecutionHistory>;
  addRetry(
    recordId: string,
    retry: { attempt: number; status: string; error?: string; duration?: number },
  ): Promise<void>;
}

export const EXECUTION_STORE = Symbol('ExecutionStore');
