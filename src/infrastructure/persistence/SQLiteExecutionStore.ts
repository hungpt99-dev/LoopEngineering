import { PrismaClient } from '@prisma/client';
import { inject, injectable } from 'tsyringe';
import { ExecutionHistory } from '../../domain/entities/ExecutionHistory.js';
import type { ExecutionRetryProps } from '../../domain/entities/ExecutionHistory.js';
import type {
  CreateExecutionRecordInput,
  ExecutionStore,
  UpdateExecutionRecordInput,
} from '../../domain/interfaces/ExecutionStore.js';
import type { Logger } from '../../domain/interfaces/Logger.js';
import { LOGGER } from '../../domain/interfaces/Logger.js';
import { IssueStatus } from '../../domain/value-objects/IssueStatus.js';

@injectable()
export class SQLiteExecutionStore implements ExecutionStore {
  private prisma: PrismaClient;

  constructor(@inject(LOGGER) private readonly logger: Logger) {
    this.prisma = new PrismaClient();
    this.logger.info('SQLiteExecutionStore initialized');
  }

  async save(record: CreateExecutionRecordInput): Promise<ExecutionHistory> {
    try {
      const created = await this.prisma.executionRecord.create({
        data: {
          issueId: record.issueId,
          issueTitle: record.issueTitle,
          projectId: record.projectId,
          milestoneId: record.milestoneId,
          agentUsed: record.agentUsed,
          status: record.status,
          duration: record.duration,
          tokenUsage: record.tokenUsage,
          result: record.result,
          error: record.error,
          branch: record.branch,
          commit: record.commit,
        },
      });

      this.logger.info(`Saved execution record: ${created.id}`);
      return this.mapToDomain(created, []);
    } catch (error) {
      this.logger.error('Failed to save execution record', error as Error);
      throw error;
    }
  }

  async findById(id: string): Promise<ExecutionHistory | null> {
    try {
      const record = await this.prisma.executionRecord.findUnique({
        where: { id },
        include: { retries: { orderBy: { attempt: 'asc' } } },
      });

      if (!record) return null;

      return this.mapToDomain(record, record.retries);
    } catch (error) {
      this.logger.error(`Failed to find execution record by id: ${id}`, error as Error);
      throw error;
    }
  }

  async findByIssueId(issueId: string): Promise<ExecutionHistory[]> {
    try {
      const records = await this.prisma.executionRecord.findMany({
        where: { issueId },
        include: { retries: { orderBy: { attempt: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      });

      return records.map((r) => this.mapToDomain(r, r.retries));
    } catch (error) {
      this.logger.error(`Failed to find execution records by issue: ${issueId}`, error as Error);
      throw error;
    }
  }

  async findByStatus(status: string): Promise<ExecutionHistory[]> {
    try {
      const records = await this.prisma.executionRecord.findMany({
        where: { status },
        include: { retries: { orderBy: { attempt: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      });

      return records.map((r) => this.mapToDomain(r, r.retries));
    } catch (error) {
      this.logger.error(`Failed to find execution records by status: ${status}`, error as Error);
      throw error;
    }
  }

  async findAll(limit = 50): Promise<ExecutionHistory[]> {
    try {
      const records = await this.prisma.executionRecord.findMany({
        include: { retries: { orderBy: { attempt: 'asc' } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return records.map((r) => this.mapToDomain(r, r.retries));
    } catch (error) {
      this.logger.error('Failed to find all execution records', error as Error);
      throw error;
    }
  }

  async update(id: string, data: UpdateExecutionRecordInput): Promise<ExecutionHistory> {
    try {
      const updateData: Record<string, unknown> = {};

      if (data.issueTitle !== undefined) updateData.issueTitle = data.issueTitle;
      if (data.projectId !== undefined) updateData.projectId = data.projectId;
      if (data.milestoneId !== undefined) updateData.milestoneId = data.milestoneId;
      if (data.agentUsed !== undefined) updateData.agentUsed = data.agentUsed;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.duration !== undefined) updateData.duration = data.duration;
      if (data.tokenUsage !== undefined) updateData.tokenUsage = data.tokenUsage;
      if (data.result !== undefined) updateData.result = data.result;
      if (data.error !== undefined) updateData.error = data.error;
      if (data.branch !== undefined) updateData.branch = data.branch;
      if (data.commit !== undefined) updateData.commit = data.commit;

      const updated = await this.prisma.executionRecord.update({
        where: { id },
        data: updateData,
        include: { retries: { orderBy: { attempt: 'asc' } } },
      });

      this.logger.info(`Updated execution record: ${id}`);
      return this.mapToDomain(updated, updated.retries);
    } catch (error) {
      this.logger.error(`Failed to update execution record: ${id}`, error as Error);
      throw error;
    }
  }

  async addRetry(
    recordId: string,
    retry: { attempt: number; status: string; error?: string; duration?: number },
  ): Promise<void> {
    try {
      await this.prisma.executionRetry.create({
        data: {
          recordId,
          attempt: retry.attempt,
          status: retry.status,
          error: retry.error,
          duration: retry.duration,
        },
      });

      this.logger.info(`Added retry attempt ${retry.attempt} to record ${recordId}`);
    } catch (error) {
      this.logger.error(`Failed to add retry to record: ${recordId}`, error as Error);
      throw error;
    }
  }

  private mapToDomain(
    record: {
      id: string;
      issueId: string;
      issueTitle: string;
      projectId: string | null;
      milestoneId: string | null;
      agentUsed: string;
      status: string;
      duration: number | null;
      tokenUsage: number | null;
      result: string | null;
      error: string | null;
      branch: string | null;
      commit: string | null;
      createdAt: Date;
      updatedAt: Date;
    },
    retries: {
      id: string;
      attempt: number;
      status: string;
      duration: number | null;
      error: string | null;
      createdAt: Date;
    }[],
  ): ExecutionHistory {
    const mappedStatus =
      Object.values(IssueStatus).find((s) => (s as string) === record.status) ??
      IssueStatus.CREATED;

    const mappedRetries: ExecutionRetryProps[] = retries.map((r) => ({
      id: r.id,
      attempt: r.attempt,
      status: r.status,
      duration: r.duration ?? undefined,
      error: r.error ?? undefined,
      createdAt: r.createdAt,
    }));

    return ExecutionHistory.create({
      id: record.id,
      issueId: record.issueId,
      issueTitle: record.issueTitle,
      projectId: record.projectId ?? undefined,
      milestoneId: record.milestoneId ?? undefined,
      agentUsed: record.agentUsed,
      status: mappedStatus,
      duration: record.duration ?? undefined,
      tokenUsage: record.tokenUsage ?? undefined,
      result: record.result ?? undefined,
      error: record.error ?? undefined,
      branch: record.branch ?? undefined,
      commit: record.commit ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      retries: mappedRetries,
    });
  }
}
