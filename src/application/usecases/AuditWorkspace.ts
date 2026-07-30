import { injectable, inject } from 'tsyringe';
import type { IssueRepository } from '../../domain/interfaces/IssueRepository.js';
import { ISSUE_REPOSITORY } from '../../domain/interfaces/IssueRepository.js';
import type { Logger } from '../../domain/interfaces/Logger.js';
import { LOGGER } from '../../domain/interfaces/Logger.js';
import { IssueStatus } from '../../domain/value-objects/IssueStatus.js';

export interface WorkspaceAudit {
  projects: number;
  milestones: number;
  issues: {
    total: number;
    completed: number;
    inProgress: number;
    blocked: number;
    failed: number;
  };
  projectBreakdown: Array<{ name: string; issues: number; completed: number }>;
}

@injectable()
export class AuditWorkspace {
  constructor(
    @inject(ISSUE_REPOSITORY) private readonly issueRepo: IssueRepository,
    @inject(LOGGER) private readonly logger: Logger,
  ) {}

  async audit(): Promise<WorkspaceAudit> {
    this.logger.info('Starting workspace audit');

    const [projects, allIssues] = await Promise.all([
      this.issueRepo.findAllProjects(),
      this.issueRepo.findAll(),
    ]);

    let totalMilestones = 0;
    const milestonesByProject = await Promise.all(
      projects.map(async (project) => {
        const milestones = await this.issueRepo.findAllMilestones(project.id);
        totalMilestones += milestones.length;
        return { projectId: project.id, milestones };
      }),
    );
    void milestonesByProject;

    const issueCounts = this.countIssues(allIssues);

    const projectBreakdown = projects.map((project) => {
      const projectIssues = allIssues.filter((issue) => issue.projectId === project.id);
      const completedCount = projectIssues.filter(
        (issue) => issue.status === IssueStatus.COMPLETED,
      ).length;

      return {
        name: project.name,
        issues: projectIssues.length,
        completed: completedCount,
      };
    });

    const audit: WorkspaceAudit = {
      projects: projects.length,
      milestones: totalMilestones,
      issues: issueCounts,
      projectBreakdown,
    };

    this.logger.info('Workspace audit complete', {
      projects: audit.projects,
      milestones: audit.milestones,
      totalIssues: audit.issues.total,
      completed: audit.issues.completed,
      inProgress: audit.issues.inProgress,
      blocked: audit.issues.blocked,
      failed: audit.issues.failed,
    });

    return audit;
  }

  private countIssues(
    issues: Array<{ status: IssueStatus; isBlocked: boolean }>,
  ): WorkspaceAudit['issues'] {
    const result: WorkspaceAudit['issues'] = {
      total: issues.length,
      completed: 0,
      inProgress: 0,
      blocked: 0,
      failed: 0,
    };

    for (const issue of issues) {
      switch (issue.status) {
        case IssueStatus.COMPLETED:
          result.completed++;
          break;
        case IssueStatus.FAILED:
          result.failed++;
          break;
        case IssueStatus.CREATED:
          if (issue.isBlocked) {
            result.blocked++;
          }
          break;
        default:
          result.inProgress++;
          break;
      }
    }

    return result;
  }
}
