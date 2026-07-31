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
import { SelectNextIssue } from './SelectNextIssue.js';

@injectable()
export class RunProject {
  constructor(
    @inject(ISSUE_REPOSITORY) private readonly issueRepo: IssueRepository,
    @inject(ExecuteIssue) private readonly executeIssue: ExecuteIssue,
    @inject(SelectNextIssue) private readonly selectNextIssue: SelectNextIssue,
    @inject(LOGGER) private readonly logger: Logger,
    @inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async run(projectName: string): Promise<ExecutionHistory[]> {
    const project = await this.issueRepo.findProjectByName(projectName);
    if (!project) {
      throw new Error(`Project not found: ${projectName}`);
    }

    const allIssues = await this.issueRepo.findByProjectId(project.id);
    const pendingIssues = allIssues.filter((issue) => issue.status !== IssueStatus.COMPLETED);

    this.logger.info('Starting project execution', {
      project: projectName,
      projectId: project.id,
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

      const nextIssue = await this.selectNextIssue.select();
      if (nextIssue) {
        this.logger.info('[DRY RUN] Next issue after project would be', {
          issueId: nextIssue.id,
          title: nextIssue.title,
        });
      }

      return [];
    }

    const results: ExecutionHistory[] = [];
    for (const issue of pendingIssues) {
      this.logger.info('Executing issue in project', {
        issueId: issue.id,
        title: issue.title,
        project: projectName,
      });
      const result = await this.executeIssue.execute(issue.id);
      results.push(result);
    }

    this.logger.info('Project execution complete', {
      project: projectName,
      completedCount: results.length,
    });

    return results;
  }
}
