import { ReviewResult, ReviewIssue } from '../entities/ReviewResult.js';

export interface ReviewerService {
  reviewChanges(
    issueId: string,
    issueTitle: string,
    filesChanged: string[],
    testResult: string,
  ): Promise<ReviewResult>;
  suggestFixes(issues: ReviewIssue[]): Promise<string[]>;
}

export const REVIEWER_SERVICE = Symbol('ReviewerService');
