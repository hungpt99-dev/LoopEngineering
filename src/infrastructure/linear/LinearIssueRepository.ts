import type {
  Issue as SdkIssue,
  LinearClient,
  Project as SdkProject,
  ProjectMilestone as SdkMilestone,
  WorkflowState,
} from '@linear/sdk';
import { LinearDocument } from '@linear/sdk';
import { inject, injectable } from 'tsyringe';
import { Issue } from '../../domain/entities/Issue.js';
import { Milestone } from '../../domain/entities/Milestone.js';
import { Project } from '../../domain/entities/Project.js';
import type {
  CreateIssueInput,
  IssueRepository,
} from '../../domain/interfaces/IssueRepository.js';
import type { Logger } from '../../domain/interfaces/Logger.js';
import { LOGGER } from '../../domain/interfaces/Logger.js';
import { IssueStatus, Priority } from '../../domain/value-objects/IssueStatus.js';
import type { LinearClientFactory } from './LinearClient.js';
import { LINEAR_CLIENT_FACTORY } from './LinearClient.js';

const { PaginationSortOrder, IssueRelationType } = LinearDocument;

const STATUS_TO_LINEAR_STATE: Record<string, string> = {
  [IssueStatus.CREATED]: 'Backlog',
  [IssueStatus.ANALYZING]: 'In Progress',
  [IssueStatus.PLANNING]: 'In Progress',
  [IssueStatus.CODING]: 'In Progress',
  [IssueStatus.TESTING]: 'In Progress',
  [IssueStatus.REVIEWING]: 'In Progress',
  [IssueStatus.COMPLETED]: 'Done',
  [IssueStatus.FAILED]: 'Canceled',
  [IssueStatus.RETRY]: 'In Progress',
};

const LINEAR_STATE_TYPE_TO_STATUS: Record<string, IssueStatus> = {
  backlog: IssueStatus.CREATED,
  unstarted: IssueStatus.CREATED,
  started: IssueStatus.ANALYZING,
  completed: IssueStatus.COMPLETED,
  canceled: IssueStatus.FAILED,
};

@injectable()
export class LinearIssueRepository implements IssueRepository {
  constructor(
    @inject(LINEAR_CLIENT_FACTORY) private readonly clientFactory: LinearClientFactory,
    @inject(LOGGER) private readonly logger: Logger,
  ) {}

  private get client(): LinearClient {
    return this.clientFactory.getClient();
  }

  async findNextIssue(): Promise<Issue | null> {
    try {
      const connection = await this.client.issues({
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

      if (connection.nodes.length === 0) return null;

      return this.mapIssue(connection.nodes[0]!);
    } catch (error) {
      this.logger.error('Failed to find next issue', error as Error);
      throw error;
    }
  }

  async findById(id: string): Promise<Issue | null> {
    try {
      const raw = await this.client.issue(id);
      if (!raw) return null;
      return this.mapIssue(raw);
    } catch (error) {
      this.logger.error(`Failed to find issue by id: ${id}`, error as Error);
      throw error;
    }
  }

  async findByProjectId(projectId: string): Promise<Issue[]> {
    try {
      const connection = await this.client.issues({
        filter: { project: { id: { eq: projectId } } },
        first: 50,
      });
      const issues = await Promise.all(connection.nodes.map((n) => this.mapIssue(n)));
      return issues;
    } catch (error) {
      this.logger.error(`Failed to find issues by project: ${projectId}`, error as Error);
      throw error;
    }
  }

  async findByMilestoneId(milestoneId: string): Promise<Issue[]> {
    try {
      const connection = await this.client.issues({
        filter: { projectMilestone: { id: { eq: milestoneId } } },
        first: 50,
      });
      const issues = await Promise.all(connection.nodes.map((n) => this.mapIssue(n)));
      return issues;
    } catch (error) {
      this.logger.error(`Failed to find issues by milestone: ${milestoneId}`, error as Error);
      throw error;
    }
  }

  async findAll(assigneeId?: string): Promise<Issue[]> {
    try {
      const filter: Record<string, unknown> = {};
      if (assigneeId) {
        filter.assignee = { id: { eq: assigneeId } };
      }
      const connection = await this.client.issues({
        filter,
        first: 50,
      });
      const issues = await Promise.all(connection.nodes.map((n) => this.mapIssue(n)));
      return issues;
    } catch (error) {
      this.logger.error('Failed to find all issues', error as Error);
      throw error;
    }
  }

  async updateStatus(issueId: string, status: string): Promise<void> {
    try {
      const stateName = STATUS_TO_LINEAR_STATE[status] ?? 'In Progress';
      const issue = await this.client.issue(issueId);
      if (!issue) {
        throw new Error(`Issue not found: ${issueId}`);
      }

      const team = await issue.team;
      if (!team) {
        throw new Error(`No team found for issue: ${issueId}`);
      }

      const statesConn = await this.client.workflowStates({
        filter: { team: { id: { eq: team.id } } },
      });
      const matchedState = statesConn.nodes.find(
        (s: WorkflowState) => s.name.toLowerCase() === stateName.toLowerCase(),
      );

      if (!matchedState) {
        this.logger.warn(
          `Workflow state "${stateName}" not found for team ${team.id}. Skipping update.`,
        );
        return;
      }

      await this.client.updateIssue(issueId, { stateId: matchedState.id });
      this.logger.info(`Updated issue ${issueId} status to ${stateName}`);
    } catch (error) {
      this.logger.error(`Failed to update status for issue ${issueId}`, error as Error);
      throw error;
    }
  }

  async addComment(issueId: string, body: string): Promise<void> {
    try {
      await this.client.createComment({ issueId, body });
      this.logger.info(`Added comment to issue ${issueId}`);
    } catch (error) {
      this.logger.error(`Failed to add comment to issue ${issueId}`, error as Error);
      throw error;
    }
  }

  async createIssue(input: CreateIssueInput): Promise<Issue> {
    try {
      const createInput: Record<string, unknown> = {
        teamId: input.teamId,
        title: input.title,
        description: input.description,
      };

      if (input.projectId) createInput.projectId = input.projectId;
      if (input.milestoneId) createInput.projectMilestoneId = input.milestoneId;
      if (input.priority !== undefined) createInput.priority = input.priority;
      if (input.assigneeId) createInput.assigneeId = input.assigneeId;
      if (input.parentId) createInput.parentId = input.parentId;

      const payload = await this.client.createIssue(
        createInput as Parameters<LinearClient['createIssue']>[0],
      );
      const created = await payload.issue;
      if (!created) {
        throw new Error('Failed to create issue: no issue returned');
      }
      return this.mapIssue(created);
    } catch (error) {
      this.logger.error('Failed to create issue', error as Error);
      throw error;
    }
  }

  async findProjectByName(name: string): Promise<Project | null> {
    try {
      const connection = await this.client.projects({
        filter: { name: { eq: name } },
        first: 1,
      });
      if (connection.nodes.length === 0) return null;
      return this.mapProject(connection.nodes[0]!);
    } catch (error) {
      this.logger.error(`Failed to find project by name: ${name}`, error as Error);
      throw error;
    }
  }

  async findProjectById(id: string): Promise<Project | null> {
    try {
      const raw = await this.client.project(id);
      if (!raw) return null;
      return this.mapProject(raw);
    } catch (error) {
      this.logger.error(`Failed to find project by id: ${id}`, error as Error);
      throw error;
    }
  }

  async findAllProjects(): Promise<Project[]> {
    try {
      const connection = await this.client.projects({ first: 50 });
      const projects = await Promise.all(connection.nodes.map((n) => this.mapProject(n)));
      return projects;
    } catch (error) {
      this.logger.error('Failed to find all projects', error as Error);
      throw error;
    }
  }

  async findMilestoneByName(projectId: string, name: string): Promise<Milestone | null> {
    try {
      const project = await this.client.project(projectId);
      if (!project) return null;

      const milestonesConn = await project.projectMilestones({
        filter: { name: { eq: name } },
        first: 1,
      });
      if (milestonesConn.nodes.length === 0) return null;
      return this.mapMilestone(milestonesConn.nodes[0]!);
    } catch (error) {
      this.logger.error(`Failed to find milestone by name: ${name}`, error as Error);
      throw error;
    }
  }

  async findMilestoneById(_projectId: string, id: string): Promise<Milestone | null> {
    try {
      const raw = await this.client.projectMilestone(id);
      if (!raw) return null;
      return this.mapMilestone(raw);
    } catch (error) {
      this.logger.error(`Failed to find milestone by id: ${id}`, error as Error);
      throw error;
    }
  }

  async findAllMilestones(projectId: string): Promise<Milestone[]> {
    try {
      const project = await this.client.project(projectId);
      if (!project) return [];

      const milestonesConn = await project.projectMilestones({ first: 50 });
      const milestones = await Promise.all(
        milestonesConn.nodes.map((n) => this.mapMilestone(n)),
      );
      return milestones;
    } catch (error) {
      this.logger.error(`Failed to find milestones for project: ${projectId}`, error as Error);
      throw error;
    }
  }

  async createBlocker(issueId: string, blockerId: string): Promise<void> {
    try {
      await this.client.createIssueRelation({
        issueId,
        relatedIssueId: blockerId,
        type: IssueRelationType.Blocks,
      });
      this.logger.info(`Created blocker relation: ${blockerId} blocks ${issueId}`);
    } catch (error) {
      this.logger.error(
        `Failed to create blocker ${blockerId} for issue ${issueId}`,
        error as Error,
      );
      throw error;
    }
  }

  private async mapIssue(raw: SdkIssue): Promise<Issue> {
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

  private async mapProject(raw: SdkProject): Promise<Project> {
    const teamId = '';

    const milestonesConn = await raw.projectMilestones();
    const milestoneIds = milestonesConn?.nodes?.map((m) => m.id) ?? [];

    return Project.create({
      id: raw.id,
      name: raw.name,
      description: raw.description,
      state: raw.state,
      progress: raw.progress,
      startDate: raw.startDate ? new Date(raw.startDate) : undefined,
      targetDate: raw.targetDate ? new Date(raw.targetDate) : undefined,
      teamId,
      milestoneIds,
    });
  }

  private async mapMilestone(raw: SdkMilestone): Promise<Milestone> {
    const project = await raw.project;

    return Milestone.create({
      id: raw.id,
      name: raw.name,
      description: raw.description ?? '',
      projectId: project?.id ?? '',
      targetDate: raw.targetDate ? new Date(raw.targetDate) : undefined,
      progress: 0,
    });
  }
}
