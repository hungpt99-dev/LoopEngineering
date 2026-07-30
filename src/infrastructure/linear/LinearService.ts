import type { Issue as SdkIssue } from '@linear/sdk';
import { LinearDocument } from '@linear/sdk';
import { inject, injectable } from 'tsyringe';
import { Issue } from '../../domain/entities/Issue.js';
import type { Milestone } from '../../domain/entities/Milestone.js';
import type { Project } from '../../domain/entities/Project.js';
import type { IssueRepository } from '../../domain/interfaces/IssueRepository.js';
import { ISSUE_REPOSITORY } from '../../domain/interfaces/IssueRepository.js';
import type { Logger } from '../../domain/interfaces/Logger.js';
import { LOGGER } from '../../domain/interfaces/Logger.js';
import { IssueStatus, Priority } from '../../domain/value-objects/IssueStatus.js';
import type { LinearClientFactory } from './LinearClient.js';
import { LINEAR_CLIENT_FACTORY } from './LinearClient.js';

const { PaginationSortOrder } = LinearDocument;

export interface WorkspaceInfo {
  id: string;
  name: string;
  key: string;
}

export interface ProjectSummary {
  project: Project;
  issues: Issue[];
  milestones: Milestone[];
  issueCount: number;
  completedCount: number;
}

export interface MilestoneProgress {
  milestone: Milestone;
  totalIssues: number;
  completedIssues: number;
  inProgressIssues: number;
  progress: number;
}

export interface ExecutionResult {
  success: boolean;
  duration: number;
  branch?: string;
  commit?: string;
  error?: string;
  testResults?: string;
}

const LINEAR_STATE_TYPE_TO_STATUS: Record<string, IssueStatus> = {
  backlog: IssueStatus.CREATED,
  unstarted: IssueStatus.CREATED,
  started: IssueStatus.ANALYZING,
  completed: IssueStatus.COMPLETED,
  canceled: IssueStatus.FAILED,
};

async function mapSdkIssue(raw: SdkIssue): Promise<Issue> {
  const state = await raw.state;
  const stateType = state?.type ?? 'backlog';
  const mappedStatus = LINEAR_STATE_TYPE_TO_STATUS[stateType] ?? IssueStatus.CREATED;

  const project = await raw.project;
  const milestone = await raw.projectMilestone;
  const assignee = await raw.assignee;
  const parent = await raw.parent;

  const [relations, inverseRelations] = await Promise.all([
    raw.relations(),
    raw.inverseRelations(),
  ]);

  const blockedByIds = await Promise.all(
    (inverseRelations?.nodes ?? [])
      .filter((r) => r.type === 'blocks')
      .map(async (r) => {
        const relatedIssue = await r.issue;
        return relatedIssue?.id ?? '';
      }),
  );

  const blockingIds = await Promise.all(
    (relations?.nodes ?? [])
      .filter((r) => r.type === 'blocks')
      .map(async (r) => {
        const relatedIssue = await r.relatedIssue;
        return relatedIssue?.id ?? '';
      }),
  );

  return Issue.create({
    id: raw.id,
    title: raw.title,
    description: raw.description ?? '',
    status: mappedStatus,
    priority: raw.priority as Priority,
    projectId: project?.id,
    projectName: project?.name,
    milestoneId: milestone?.id,
    milestoneName: milestone?.name,
    assigneeId: assignee?.id,
    labelIds: raw.labelIds,
    labelNames: [],
    parentId: parent?.id,
    blockedByIssues: blockedByIds.filter(Boolean),
    blockingIssues: blockingIds.filter(Boolean),
    estimate: raw.estimate,
    dueDate: raw.dueDate ? new Date(raw.dueDate) : undefined,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    branchName: raw.branchName,
  });
}

@injectable()
export class LinearService {
  constructor(
    @inject(LINEAR_CLIENT_FACTORY) private readonly clientFactory: LinearClientFactory,
    @inject(ISSUE_REPOSITORY) private readonly issueRepo: IssueRepository,
    @inject(LOGGER) private readonly logger: Logger,
  ) {}

  async getWorkspace(): Promise<WorkspaceInfo> {
    return {
      id: 'workspace',
      name: 'Linear Workspace',
      key: 'LIN',
    };
  }

  async getIssuesByStatus(status: string): Promise<Issue[]> {
    const client = this.clientFactory.getClient();
    const connection = await client.issues({
      filter: {
        state: { name: { eq: status } },
      },
      first: 50,
    });
    return Promise.all(connection.nodes.map((raw) => mapSdkIssue(raw)));
  }

  async getNextRecommendedIssue(): Promise<Issue | null> {
    this.logger.info('Finding next recommended issue');
    const client = this.clientFactory.getClient();

    const connection = await client.issues({
      filter: {
        and: [
          { assignee: { null: true } },
          { state: { type: { neq: 'completed' } } },
          { state: { type: { neq: 'canceled' } } },
          { hasBlockedByRelations: { eq: false } },
        ],
      },
      sort: [{ priority: { order: PaginationSortOrder.Ascending, noPriorityFirst: false } }],
      first: 10,
    });

    if (connection.nodes.length === 0) {
      this.logger.info('No unblocked, unassigned issues found');
      return null;
    }

    const issue = await mapSdkIssue(connection.nodes[0]!);
    this.logger.info(`Recommended issue: ${issue.id} - ${issue.title}`);
    return issue;
  }

  async createOrchestratorComment(issueId: string, message: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const formattedMessage = `> **AI Orchestrator** _${timestamp}_

${message}`;
    await this.issueRepo.addComment(issueId, formattedMessage);
  }

  async updateIssueWithExecutionResult(
    issueId: string,
    result: ExecutionResult,
  ): Promise<void> {
    const lines = [
      `### Execution Result`,
      `- **Status**: ${result.success ? 'Success' : 'Failed'}`,
      `- **Duration**: ${result.duration}ms`,
    ];

    if (result.branch) lines.push(`- **Branch**: \`${result.branch}\``);
    if (result.commit) lines.push(`- **Commit**: \`${result.commit}\``);
    if (result.error) lines.push(`- **Error**: ${result.error}`);
    if (result.testResults) lines.push(`\n${result.testResults}`);

    await this.issueRepo.addComment(issueId, lines.join('\n'));
  }

  async getProjectSummary(projectName: string): Promise<ProjectSummary> {
    const project = await this.issueRepo.findProjectByName(projectName);

    if (!project) {
      throw new Error(`Project not found: ${projectName}`);
    }

    const issues = await this.issueRepo.findByProjectId(project.id);
    const milestones = await this.issueRepo.findAllMilestones(project.id);
    const completedCount = issues.filter((i) => i.status === IssueStatus.COMPLETED).length;

    this.logger.info(
      `Project summary for ${projectName}: ${issues.length} issues, ${milestones.length} milestones`,
    );

    return {
      project,
      issues,
      milestones,
      issueCount: issues.length,
      completedCount,
    };
  }

  async getMilestoneProgress(
    milestoneName: string,
    projectName: string,
  ): Promise<MilestoneProgress> {
    const project = await this.issueRepo.findProjectByName(projectName);

    if (!project) {
      throw new Error(`Project not found: ${projectName}`);
    }

    const milestone = await this.issueRepo.findMilestoneByName(project.id, milestoneName);

    if (!milestone) {
      throw new Error(`Milestone not found: ${milestoneName} in project ${projectName}`);
    }

    const issues = await this.issueRepo.findByMilestoneId(milestone.id);
    const totalIssues = issues.length;
    const completedIssues = issues.filter((i) => i.status === IssueStatus.COMPLETED).length;
    const inProgressIssues = issues.filter(
      (i) =>
        i.status !== IssueStatus.COMPLETED &&
        i.status !== IssueStatus.FAILED &&
        i.status !== IssueStatus.CREATED,
    ).length;

    const progress = totalIssues > 0 ? completedIssues / totalIssues : 0;

    this.logger.info(
      `Milestone ${milestoneName}: ${completedIssues}/${totalIssues} completed`,
    );

    return {
      milestone,
      totalIssues,
      completedIssues,
      inProgressIssues,
      progress,
    };
  }
}
