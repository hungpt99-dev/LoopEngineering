import { z } from 'zod';
import { IssueStatus, Priority } from '../value-objects/IssueStatus.js';

export interface IssueProps {
  id: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: Priority;
  projectId?: string;
  projectName?: string;
  milestoneId?: string;
  milestoneName?: string;
  assigneeId?: string;
  labelIds: string[];
  parentId?: string;
  blockedByIssues: string[];
  blockingIssues: string[];
  estimate?: number;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  branchName?: string;
}

export const IssueSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  status: z.nativeEnum(IssueStatus),
  priority: z.nativeEnum(Priority),
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  milestoneId: z.string().optional(),
  milestoneName: z.string().optional(),
  assigneeId: z.string().optional(),
  labelIds: z.array(z.string()),
  parentId: z.string().optional(),
  blockedByIssues: z.array(z.string()),
  blockingIssues: z.array(z.string()),
  estimate: z.number().optional(),
  dueDate: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  branchName: z.string().optional(),
});

export class Issue {
  private constructor(private readonly props: IssueProps) {}

  static create(props: IssueProps): Issue {
    IssueSchema.parse(props);
    return new Issue(props);
  }

  get id(): string { return this.props.id; }
  get title(): string { return this.props.title; }
  get description(): string { return this.props.description; }
  get status(): IssueStatus { return this.props.status; }
  get priority(): Priority { return this.props.priority; }
  get projectId(): string | undefined { return this.props.projectId; }
  get projectName(): string | undefined { return this.props.projectName; }
  get milestoneId(): string | undefined { return this.props.milestoneId; }
  get milestoneName(): string | undefined { return this.props.milestoneName; }
  get assigneeId(): string | undefined { return this.props.assigneeId; }
  get labelIds(): string[] { return this.props.labelIds; }
  get parentId(): string | undefined { return this.props.parentId; }
  get blockedByIssues(): string[] { return this.props.blockedByIssues; }
  get blockingIssues(): string[] { return this.props.blockingIssues; }
  get estimate(): number | undefined { return this.props.estimate; }
  get dueDate(): Date | undefined { return this.props.dueDate; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get branchName(): string | undefined { return this.props.branchName; }

  get isBlocked(): boolean {
    return this.props.blockedByIssues.length > 0;
  }

  get isInProgress(): boolean {
    const activeStates = [
      IssueStatus.ANALYZING,
      IssueStatus.PLANNING,
      IssueStatus.CODING,
      IssueStatus.TESTING,
      IssueStatus.REVIEWING,
      IssueStatus.RETRY,
    ];
    return activeStates.includes(this.props.status);
  }

  get isCompleted(): boolean {
    return this.props.status === IssueStatus.COMPLETED;
  }

  canTransitionTo(newStatus: IssueStatus): boolean {
    const validTransitions: Record<IssueStatus, IssueStatus[]> = {
      [IssueStatus.CREATED]: [IssueStatus.ANALYZING],
      [IssueStatus.ANALYZING]: [IssueStatus.PLANNING, IssueStatus.FAILED],
      [IssueStatus.PLANNING]: [IssueStatus.CODING, IssueStatus.FAILED],
      [IssueStatus.CODING]: [IssueStatus.TESTING, IssueStatus.FAILED],
      [IssueStatus.TESTING]: [IssueStatus.REVIEWING, IssueStatus.RETRY, IssueStatus.FAILED],
      [IssueStatus.REVIEWING]: [IssueStatus.COMPLETED, IssueStatus.RETRY, IssueStatus.FAILED],
      [IssueStatus.COMPLETED]: [],
      [IssueStatus.FAILED]: [IssueStatus.RETRY],
      [IssueStatus.RETRY]: [IssueStatus.CODING],
    };
    return validTransitions[this.props.status]?.includes(newStatus) ?? false;
  }

  withStatus(status: IssueStatus): Issue {
    return new Issue({ ...this.props, status });
  }

  withBranchName(branchName: string): Issue {
    return new Issue({ ...this.props, branchName });
  }

  toJSON(): IssueProps {
    return { ...this.props };
  }
}
