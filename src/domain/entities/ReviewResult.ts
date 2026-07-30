export enum ReviewDecision {
  APPROVED = 'APPROVED',
  REQUEST_CHANGES = 'REQUEST_CHANGES',
}

export interface ReviewResultProps {
  decision: ReviewDecision;
  summary: string;
  issues: ReviewIssue[];
  suggestions: string[];
  score: number;
}

export interface ReviewIssue {
  severity: 'critical' | 'major' | 'minor' | 'info';
  category: 'correctness' | 'architecture' | 'security' | 'performance' | 'maintainability' | 'tests';
  description: string;
  file?: string;
  line?: number;
  suggestion?: string;
}

export class ReviewResult {
  private constructor(private readonly props: ReviewResultProps) {}

  static create(props: ReviewResultProps): ReviewResult {
    return new ReviewResult(props);
  }

  static approved(summary: string, score: number): ReviewResult {
    return new ReviewResult({
      decision: ReviewDecision.APPROVED,
      summary,
      issues: [],
      suggestions: [],
      score,
    });
  }

  static requestChanges(
    issues: ReviewIssue[],
    suggestions: string[],
    score: number,
  ): ReviewResult {
    return new ReviewResult({
      decision: ReviewDecision.REQUEST_CHANGES,
      summary: `Requested changes: ${issues.length} issue(s) found`,
      issues,
      suggestions,
      score,
    });
  }

  get decision(): ReviewDecision { return this.props.decision; }
  get summary(): string { return this.props.summary; }
  get issues(): ReviewIssue[] { return this.props.issues; }
  get suggestions(): string[] { return this.props.suggestions; }
  get score(): number { return this.props.score; }
  get isApproved(): boolean { return this.props.decision === ReviewDecision.APPROVED; }

  get criticalIssues(): ReviewIssue[] {
    return this.props.issues.filter((i) => i.severity === 'critical');
  }

  toJSON(): ReviewResultProps {
    return { ...this.props };
  }
}
