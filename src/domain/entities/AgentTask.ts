import { z } from 'zod';
import { Complexity } from '../value-objects/IssueStatus.js';

export interface AgentTaskProps {
  id: string;
  issueId: string;
  issueTitle: string;
  issueDescription: string;
  projectContext?: string;
  milestoneContext?: string;
  dependencies: string[];
  filesToInspect: string[];
  implementationSteps: string[];
  complexity: Complexity;
  branchName: string;
  environment: Record<string, string>;
}

export const AgentTaskSchema = z.object({
  id: z.string().min(1),
  issueId: z.string(),
  issueTitle: z.string(),
  issueDescription: z.string(),
  projectContext: z.string().optional(),
  milestoneContext: z.string().optional(),
  dependencies: z.array(z.string()),
  filesToInspect: z.array(z.string()),
  implementationSteps: z.array(z.string()),
  complexity: z.nativeEnum(Complexity),
  branchName: z.string(),
  environment: z.record(z.string()),
});

export class AgentTask {
  private constructor(private readonly props: AgentTaskProps) {}

  static create(props: AgentTaskProps): AgentTask {
    AgentTaskSchema.parse(props);
    return new AgentTask(props);
  }

  get id(): string { return this.props.id; }
  get issueId(): string { return this.props.issueId; }
  get issueTitle(): string { return this.props.issueTitle; }
  get issueDescription(): string { return this.props.issueDescription; }
  get projectContext(): string | undefined { return this.props.projectContext; }
  get milestoneContext(): string | undefined { return this.props.milestoneContext; }
  get dependencies(): string[] { return this.props.dependencies; }
  get filesToInspect(): string[] { return this.props.filesToInspect; }
  get implementationSteps(): string[] { return this.props.implementationSteps; }
  get complexity(): Complexity { return this.props.complexity; }
  get branchName(): string { return this.props.branchName; }
  get environment(): Record<string, string> { return this.props.environment; }

  get fullContext(): string {
    const parts: string[] = [];
    if (this.props.projectContext) {
      parts.push(`## Project Context\n${this.props.projectContext}`);
    }
    if (this.props.milestoneContext) {
      parts.push(`## Milestone Context\n${this.props.milestoneContext}`);
    }
    parts.push(`## Issue\n${this.props.issueTitle}\n\n${this.props.issueDescription}`);
    if (this.props.implementationSteps.length > 0) {
      parts.push(`## Implementation Plan\n${this.props.implementationSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
    }
    if (this.props.filesToInspect.length > 0) {
      parts.push(`## Relevant Files\n${this.props.filesToInspect.join('\n')}`);
    }
    if (this.props.dependencies.length > 0) {
      parts.push(`## Dependencies\n${this.props.dependencies.join('\n')}`);
    }
    return parts.join('\n\n');
  }

  toJSON(): AgentTaskProps {
    return { ...this.props };
  }
}
