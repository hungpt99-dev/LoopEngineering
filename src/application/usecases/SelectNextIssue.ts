import { injectable, inject } from 'tsyringe';
import type { IssueRepository } from '../../domain/interfaces/IssueRepository.js';
import { ISSUE_REPOSITORY } from '../../domain/interfaces/IssueRepository.js';
import type { Logger } from '../../domain/interfaces/Logger.js';
import { LOGGER } from '../../domain/interfaces/Logger.js';
import type { Issue } from '../../domain/entities/Issue.js';
import { IssueStatus } from '../../domain/value-objects/IssueStatus.js';

@injectable()
export class SelectNextIssue {
  constructor(
    @inject(ISSUE_REPOSITORY) private readonly issueRepo: IssueRepository,
    @inject(LOGGER) private readonly logger: Logger,
  ) {}

  async select(): Promise<Issue | null> {
    const nextIssue = await this.issueRepo.findNextIssue();
    if (!nextIssue) {
      this.logger.info('No next issue available');
      return null;
    }

    this.logger.info('Selected next issue', {
      issueId: nextIssue.id,
      title: nextIssue.title,
      status: nextIssue.status,
      priority: nextIssue.priority,
      isBlocked: nextIssue.isBlocked,
    });

    return nextIssue;
  }

  async preview(count: number): Promise<Array<{ issue: Issue; reason: string }>> {
    const results: Array<{ issue: Issue; reason: string }> = [];
    const allIssues = await this.issueRepo.findAll();

    const eligible = allIssues
      .filter((issue) => issue.status === IssueStatus.CREATED && !issue.isBlocked)
      .sort((a, b) => a.priority - b.priority);

    const previewCount = Math.min(count, eligible.length);
    for (let i = 0; i < previewCount; i++) {
      const issue = eligible[i]!;
      const reason = this.buildReason(issue);
      results.push({ issue, reason });
    }

    this.logger.info('Previewed next issues', {
      count: results.length,
      totalEligible: eligible.length,
    });
    return results;
  }

  private buildReason(issue: Issue): string {
    const parts: string[] = [];
    parts.push(`Priority: ${issue.priority}`);

    if (issue.estimate !== undefined) {
      parts.push(`Estimate: ${issue.estimate}`);
    }

    if (issue.projectName) {
      parts.push(`Project: ${issue.projectName}`);
    }

    if (issue.labelIds.length > 0) {
      const names = issue.labelNames.length > 0 ? issue.labelNames : issue.labelIds;
      parts.push(`Labels: ${names.join(', ')}`);
    }

    if (issue.isBlocked) {
      parts.push(`Blocked by: ${issue.blockedByIssues.join(', ')}`);
    }

    return parts.join(' | ');
  }
}
