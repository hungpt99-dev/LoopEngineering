import { z } from 'zod';

export interface ProjectProps {
  id: string;
  name: string;
  description: string;
  state: string;
  progress: number;
  startDate?: Date;
  targetDate?: Date;
  teamId: string;
  milestoneIds: string[];
}

export const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  state: z.string(),
  progress: z.number().min(0).max(1),
  startDate: z.date().optional(),
  targetDate: z.date().optional(),
  teamId: z.string(),
  milestoneIds: z.array(z.string()),
});

export class Project {
  private constructor(private readonly props: ProjectProps) {}

  static create(props: ProjectProps): Project {
    ProjectSchema.parse(props);
    return new Project(props);
  }

  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get description(): string { return this.props.description; }
  get state(): string { return this.props.state; }
  get progress(): number { return this.props.progress; }
  get startDate(): Date | undefined { return this.props.startDate; }
  get targetDate(): Date | undefined { return this.props.targetDate; }
  get teamId(): string { return this.props.teamId; }
  get milestoneIds(): string[] { return this.props.milestoneIds; }

  toJSON(): ProjectProps {
    return { ...this.props };
  }
}
