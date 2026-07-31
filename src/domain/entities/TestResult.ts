import { z } from 'zod';

export interface TestResultProps {
  success: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration: number;
  output: string;
  errors: string[];
  coverage?: number;
}

export const TestResultSchema = z.object({
  success: z.boolean(),
  totalTests: z.number().min(0),
  passedTests: z.number().min(0),
  failedTests: z.number().min(0),
  skippedTests: z.number().min(0),
  duration: z.number(),
  output: z.string(),
  errors: z.array(z.string()),
  coverage: z.number().optional(),
});

export class TestResult {
  private constructor(private readonly props: TestResultProps) {}

  static create(props: TestResultProps): TestResult {
    TestResultSchema.parse(props);
    return new TestResult(props);
  }

  static success(output: string, duration: number): TestResult {
    return new TestResult({
      success: true,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      duration,
      output,
      errors: [],
    });
  }

  static failure(errors: string[], output: string, duration: number): TestResult {
    return new TestResult({
      success: false,
      totalTests: 0,
      passedTests: 0,
      failedTests: errors.length,
      skippedTests: 0,
      duration,
      output,
      errors,
    });
  }

  get success(): boolean {
    return this.props.success;
  }
  get totalTests(): number {
    return this.props.totalTests;
  }
  get passedTests(): number {
    return this.props.passedTests;
  }
  get failedTests(): number {
    return this.props.failedTests;
  }
  get skippedTests(): number {
    return this.props.skippedTests;
  }
  get duration(): number {
    return this.props.duration;
  }
  get output(): string {
    return this.props.output;
  }
  get errors(): string[] {
    return this.props.errors;
  }
  get coverage(): number | undefined {
    return this.props.coverage;
  }

  get formattedSummary(): string {
    if (this.props.success)
      return `Tests passed${this.props.coverage ? ` (coverage: ${this.props.coverage}%)` : ''}`;
    return `Tests failed: ${this.props.failedTests}/${this.props.totalTests}${this.props.coverage ? ` (coverage: ${this.props.coverage}%)` : ''}\n${this.props.errors.map((e) => `  - ${e}`).join('\n')}`;
  }

  toJSON(): TestResultProps {
    return { ...this.props };
  }
}
