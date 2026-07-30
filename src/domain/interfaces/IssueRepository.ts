import { Issue } from '../entities/Issue.js';
import { Project } from '../entities/Project.js';
import { Milestone } from '../entities/Milestone.js';

export interface IssueRepository {
  findNextIssue(): Promise<Issue | null>;
  findById(id: string): Promise<Issue | null>;
  findByProjectId(projectId: string): Promise<Issue[]>;
  findByMilestoneId(milestoneId: string): Promise<Issue[]>;
  findAll(assigneeId?: string): Promise<Issue[]>;
  updateStatus(issueId: string, status: string): Promise<void>;
  addComment(issueId: string, body: string): Promise<void>;
  createIssue(input: CreateIssueInput): Promise<Issue>;
  findProjectByName(name: string): Promise<Project | null>;
  findProjectById(id: string): Promise<Project | null>;
  findAllProjects(): Promise<Project[]>;
  findMilestoneByName(projectId: string, name: string): Promise<Milestone | null>;
  findMilestoneById(projectId: string, id: string): Promise<Milestone | null>;
  findAllMilestones(projectId: string): Promise<Milestone[]>;
  createBlocker(issueId: string, blockerId: string): Promise<void>;
}

export interface CreateIssueInput {
  title: string;
  description: string;
  teamId: string;
  projectId?: string;
  milestoneId?: string;
  priority?: number;
  assigneeId?: string;
  parentId?: string;
}

export const ISSUE_REPOSITORY = Symbol('IssueRepository');
