import { z } from 'zod';
import { Complexity } from '../value-objects/IssueStatus.js';

export interface ExecutionPlanProps {
  issueId: string;
  issueTitle: string;
  complexity: Complexity;
  recommendedAgent: string;
  confidence: number;
  implementationSteps: string[];
  filesToInspect: string[];
  risks: string[];
  dependencies: string[];
  estimatedDuration: number;
  requiresArchitectureReview: boolean;
}

export const ExecutionPlanSchema = z.object({
  issueId: z.string(),
  issueTitle: z.string(),
  complexity: z.nativeEnum(Complexity),
  recommendedAgent: z.string(),
  confidence: z.number().min(0).max(1),
  implementationSteps: z.array(z.string()),
  filesToInspect: z.array(z.string()),
  risks: z.array(z.string()),
  dependencies: z.array(z.string()),
  estimatedDuration: z.number().positive(),
  requiresArchitectureReview: z.boolean(),
});

export class ExecutionPlan {
  private constructor(private readonly props: ExecutionPlanProps) {}

  static create(props: ExecutionPlanProps): ExecutionPlan {
    ExecutionPlanSchema.parse(props);
    return new ExecutionPlan(props);
  }

  get issueId(): string {
    return this.props.issueId;
  }
  get issueTitle(): string {
    return this.props.issueTitle;
  }
  get complexity(): Complexity {
    return this.props.complexity;
  }
  get recommendedAgent(): string {
    return this.props.recommendedAgent;
  }
  get confidence(): number {
    return this.props.confidence;
  }
  get implementationSteps(): string[] {
    return this.props.implementationSteps;
  }
  get filesToInspect(): string[] {
    return this.props.filesToInspect;
  }
  get risks(): string[] {
    return this.props.risks;
  }
  get dependencies(): string[] {
    return this.props.dependencies;
  }
  get estimatedDuration(): number {
    return this.props.estimatedDuration;
  }
  get requiresArchitectureReview(): boolean {
    return this.props.requiresArchitectureReview;
  }

  toJSON(): ExecutionPlanProps {
    return { ...this.props };
  }
}
