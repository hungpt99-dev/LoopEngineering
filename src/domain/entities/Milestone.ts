import { z } from 'zod';

export interface MilestoneProps {
  id: string;
  name: string;
  description: string;
  projectId: string;
  targetDate?: Date;
  progress: number;
}

export const MilestoneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  projectId: z.string(),
  targetDate: z.date().optional(),
  progress: z.number().min(0).max(1),
});

export class Milestone {
  private constructor(private readonly props: MilestoneProps) {}

  static create(props: MilestoneProps): Milestone {
    MilestoneSchema.parse(props);
    return new Milestone(props);
  }

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get description(): string {
    return this.props.description;
  }
  get projectId(): string {
    return this.props.projectId;
  }
  get targetDate(): Date | undefined {
    return this.props.targetDate;
  }
  get progress(): number {
    return this.props.progress;
  }

  toJSON(): MilestoneProps {
    return { ...this.props };
  }
}
