import { z } from 'zod';

export interface AgentExecutionResultProps {
  taskId: string;
  agentName: string;
  success: boolean;
  output: string;
  error?: string;
  filesChanged: string[];
  commitSha?: string;
  duration: number;
  tokenUsage?: number;
}

export const AgentExecutionResultSchema = z.object({
  taskId: z.string(),
  agentName: z.string(),
  success: z.boolean(),
  output: z.string(),
  error: z.string().optional(),
  filesChanged: z.array(z.string()),
  commitSha: z.string().optional(),
  duration: z.number(),
  tokenUsage: z.number().optional(),
});

export class AgentExecutionResult {
  private constructor(private readonly props: AgentExecutionResultProps) {}

  static create(props: AgentExecutionResultProps): AgentExecutionResult {
    AgentExecutionResultSchema.parse(props);
    return new AgentExecutionResult(props);
  }

  get taskId(): string {
    return this.props.taskId;
  }
  get agentName(): string {
    return this.props.agentName;
  }
  get success(): boolean {
    return this.props.success;
  }
  get output(): string {
    return this.props.output;
  }
  get error(): string | undefined {
    return this.props.error;
  }
  get filesChanged(): string[] {
    return this.props.filesChanged;
  }
  get commitSha(): string | undefined {
    return this.props.commitSha;
  }
  get duration(): number {
    return this.props.duration;
  }
  get tokenUsage(): number | undefined {
    return this.props.tokenUsage;
  }

  toJSON(): AgentExecutionResultProps {
    return { ...this.props };
  }
}
