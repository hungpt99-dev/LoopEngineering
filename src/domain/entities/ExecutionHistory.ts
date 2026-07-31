import { IssueStatus } from '../value-objects/IssueStatus.js';

export interface ExecutionHistoryProps {
  id: string;
  issueId: string;
  issueTitle: string;
  projectId?: string;
  milestoneId?: string;
  agentUsed: string;
  status: IssueStatus;
  duration?: number;
  tokenUsage?: number;
  result?: string;
  error?: string;
  branch?: string;
  commit?: string;
  createdAt: Date;
  updatedAt: Date;
  retries: ExecutionRetryProps[];
}

export interface ExecutionRetryProps {
  id: string;
  attempt: number;
  status: string;
  duration?: number;
  error?: string;
  createdAt: Date;
}

export class ExecutionHistory {
  private constructor(private readonly props: ExecutionHistoryProps) {}

  static create(props: ExecutionHistoryProps): ExecutionHistory {
    return new ExecutionHistory(props);
  }

  get id(): string {
    return this.props.id;
  }
  get issueId(): string {
    return this.props.issueId;
  }
  get issueTitle(): string {
    return this.props.issueTitle;
  }
  get projectId(): string | undefined {
    return this.props.projectId;
  }
  get milestoneId(): string | undefined {
    return this.props.milestoneId;
  }
  get agentUsed(): string {
    return this.props.agentUsed;
  }
  get status(): IssueStatus {
    return this.props.status;
  }
  get duration(): number | undefined {
    return this.props.duration;
  }
  get tokenUsage(): number | undefined {
    return this.props.tokenUsage;
  }
  get result(): string | undefined {
    return this.props.result;
  }
  get error(): string | undefined {
    return this.props.error;
  }
  get branch(): string | undefined {
    return this.props.branch;
  }
  get commit(): string | undefined {
    return this.props.commit;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get retries(): ExecutionRetryProps[] {
    return this.props.retries;
  }

  toJSON(): ExecutionHistoryProps {
    return { ...this.props };
  }
}
