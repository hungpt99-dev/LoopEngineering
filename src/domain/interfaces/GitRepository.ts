export interface GitRepository {
  createBranch(branchName: string): Promise<void>;
  checkoutBranch(branchName: string): Promise<void>;
  stageAll(): Promise<void>;
  commit(message: string): Promise<string>;
  push(): Promise<void>;
  getCurrentBranch(): Promise<string>;
  hasUncommittedChanges(): Promise<boolean>;
  getChangedFiles(): Promise<string[]>;
  getLatestCommitSha(): Promise<string>;
  revertToClean(): Promise<void>;
  deleteBranch(branchName: string): Promise<void>;
  branchExists(branchName: string): Promise<boolean>;
  mergeToDefaultBranch(branchName: string): Promise<void>;
}

export const GIT_REPOSITORY = Symbol('GitRepository');
