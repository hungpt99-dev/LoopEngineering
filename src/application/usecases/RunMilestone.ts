import { injectable, inject } from 'tsyringe';
import type { IssueRepository } from '../../domain/interfaces/IssueRepository.js';
import { ISSUE_REPOSITORY } from '../../domain/interfaces/IssueRepository.js';
import type { Logger } from '../../domain/interfaces/Logger.js';
import { LOGGER } from '../../domain/interfaces/Logger.js';
import type { AppConfig } from '../../domain/interfaces/AppConfig.js';
import { APP_CONFIG } from '../../domain/interfaces/AppConfig.js';
import type { ExecutionHistory } from '../../domain/entities/ExecutionHistory.js';
import { IssueStatus } from '../../domain/value-objects/IssueStatus.js';
import { ExecuteIssue } from './ExecuteIssue.js';

@injectable()
export class RunMilestone {
  constructor(
    @inject(ISSUE_REPOSITORY) private readonly issueRepo: IssueRepository,
    @inject(ExecuteIssue) private readonly executeIssue: ExecuteIssue,
    @inject(LOGGER) private readonly logger: Logger,
    @inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async run(milestoneName: string, projectName?: string): Promise<ExecutionHistory[]> {
    const projectId = await this.resolveProjectId(milestoneName, projectName);
    const milestone = await this.issueRepo.findMilestoneByName(projectId, milestoneName);
    if (!milestone) {
      throw new Error(
        `Milestone not found: ${milestoneName}${projectName ? ` in project ${projectName}` : ''}`,
      );
    }

    const allIssues = await this.issueRepo.findByMilestoneId(milestone.id);
    const pendingIssues = allIssues.filter(
      (issue) => issue.status !== IssueStatus.COMPLETED,
    );

    this.logger.info('Starting milestone execution', {
      milestone: milestoneName,
      milestoneId: milestone.id,
      totalIssues: allIssues.length,
      pendingIssues: pendingIssues.length,
      dryRun: this.config.execution.dryRun,
    });

    if (this.config.execution.dryRun) {
      for (const issue of pendingIssues) {
        this.logger.info('[DRY RUN] Would execute issue', {
          issueId: issue.id,
          title: issue.title,
          status: issue.status,
        });
      }
      return [];
    }

    const results: ExecutionHistory[] = [];
    for (const issue of pendingIssues) {
      this.logger.info('Executing issue in milestone', {
        issueId: issue.id,
        title: issue.title,
        milestone: milestoneName,
      });
      const result = await this.executeIssue.execute(issue.id);
      results.push(result);
    }

    this.logger.info('Milestone execution complete', {
      milestone: milestoneName,
      completedCount: results.length,
    });

    return results;
  }

  private async resolveProjectId(milestoneName: string, projectName?: string): Promise<string> {
    if (projectName) {
      const project = await this.issueRepo.findProjectByName(projectName);
      if (!project) {
        throw new Error(`Project not found: ${projectName}`);
      }
      return project.id;
    }

    const allProjects = await this.issueRepo.findAllProjects();
    for (const project of allProjects) {
      const milestone = await this.issueRepo.findMilestoneByName(project.id, milestoneName);
      if (milestone) {
        this.logger.info('Resolved milestone to project', {
          milestone: milestoneName,
          projectId: project.id,
          projectName: project.name,
        });
        return project.id;
      }
    }

    throw new Error(
      `Milestone "${milestoneName}" not found in any project. Specify a --project to narrow the search.`,
    );
  }
}
