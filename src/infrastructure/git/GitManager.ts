import { execa } from 'execa';
import { inject, injectable } from 'tsyringe';
import type { AppConfig } from '../../domain/interfaces/AppConfig.js';
import { APP_CONFIG } from '../../domain/interfaces/AppConfig.js';
import type { GitRepository } from '../../domain/interfaces/GitRepository.js';
import type { Logger } from '../../domain/interfaces/Logger.js';
import { LOGGER } from '../../domain/interfaces/Logger.js';

@injectable()
export class GitManager implements GitRepository {
  constructor(
    @inject(LOGGER) private readonly logger: Logger,
    @inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private sanitizeBranchName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-/, '')
      .replace(/-$/, '')
      .slice(0, 100);
  }

  async createBranch(branchName: string): Promise<void> {
    const sanitized = this.sanitizeBranchName(branchName);
    const fullName = `${this.config.workspace.branchPrefix}${sanitized}`;

    try {
      await execa('git', ['checkout', '-b', fullName]);
      this.logger.info(`Created branch: ${fullName}`);
    } catch (error) {
      this.logger.error(`Failed to create branch: ${fullName}`, error as Error);
      throw error;
    }
  }

  async checkoutBranch(branchName: string): Promise<void> {
    try {
      await execa('git', ['checkout', branchName]);
      this.logger.info(`Checked out branch: ${branchName}`);
    } catch (error) {
      this.logger.error(`Failed to checkout branch: ${branchName}`, error as Error);
      throw error;
    }
  }

  async stageAll(): Promise<void> {
    try {
      await execa('git', ['add', '.']);
      this.logger.debug('Staged all changes');
    } catch (error) {
      this.logger.error('Failed to stage changes', error as Error);
      throw error;
    }
  }

  async commit(message: string): Promise<string> {
    try {
      await execa('git', ['commit', '-m', message]);
      const sha = await this.getLatestCommitSha();
      this.logger.info(`Committed: ${sha}`);
      return sha;
    } catch (error) {
      this.logger.error('Failed to commit', error as Error);
      throw error;
    }
  }

  async push(): Promise<void> {
    if (!this.config.execution.autoPush) {
      this.logger.info('Auto push disabled, skipping');
      return;
    }

    try {
      const branch = await this.getCurrentBranch();
      await execa('git', ['push', '--set-upstream', 'origin', branch]);
      this.logger.info(`Pushed branch: ${branch}`);
    } catch (error) {
      this.logger.error('Failed to push', error as Error);
      throw error;
    }
  }

  async getCurrentBranch(): Promise<string> {
    try {
      const result = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
      return result.stdout.trim();
    } catch (error) {
      this.logger.error('Failed to get current branch', error as Error);
      throw error;
    }
  }

  async hasUncommittedChanges(): Promise<boolean> {
    try {
      const result = await execa('git', ['status', '--porcelain']);
      return result.stdout.trim().length > 0;
    } catch (error) {
      this.logger.error('Failed to check for uncommitted changes', error as Error);
      throw error;
    }
  }

  async getChangedFiles(): Promise<string[]> {
    try {
      const result = await execa('git', ['diff', '--name-only', 'HEAD']);
      const files = result.stdout.trim().split('\n').filter(Boolean);
      return files;
    } catch (error) {
      this.logger.error('Failed to get changed files', error as Error);
      throw error;
    }
  }

  async getLatestCommitSha(): Promise<string> {
    try {
      const result = await execa('git', ['rev-parse', 'HEAD']);
      return result.stdout.trim();
    } catch (error) {
      this.logger.error('Failed to get latest commit SHA', error as Error);
      throw error;
    }
  }

  async revertToClean(): Promise<void> {
    try {
      await execa('git', ['reset', '--hard', 'HEAD']);
      await execa('git', ['clean', '-fd']);
      this.logger.info('Reverted working directory to clean state');
    } catch (error) {
      this.logger.error('Failed to revert to clean state', error as Error);
      throw error;
    }
  }

  async deleteBranch(branchName: string): Promise<void> {
    try {
      await execa('git', ['branch', '-d', branchName]);
      this.logger.info(`Deleted branch: ${branchName}`);
    } catch (error) {
      this.logger.error(`Failed to delete branch: ${branchName}`, error as Error);
      throw error;
    }
  }

  async branchExists(branchName: string): Promise<boolean> {
    try {
      await execa('git', ['rev-parse', '--verify', branchName]);
      return true;
    } catch {
      return false;
    }
  }

  async mergeToDefaultBranch(branchName: string): Promise<void> {
    const defaultBranch = this.config.workspace.defaultBranch;

    try {
      const currentBranch = await this.getCurrentBranch();
      await this.checkoutBranch(defaultBranch);
      await execa('git', ['merge', '--no-ff', branchName, '-m', `Merge branch '${branchName}'`]);
      this.logger.info(`Merged ${branchName} into ${defaultBranch}`);

      if (currentBranch !== defaultBranch) {
        await this.checkoutBranch(currentBranch);
      }
    } catch (error) {
      this.logger.error(`Failed to merge ${branchName} into ${defaultBranch}`, error as Error);
      throw error;
    }
  }
}
