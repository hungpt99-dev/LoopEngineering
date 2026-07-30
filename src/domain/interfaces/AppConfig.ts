export interface AppConfig {
  agents: Record<
    string,
    {
      enabled: boolean;
      priority: number;
      capabilities: string[];
    }
  >;
  execution: {
    maxRetries: number;
    autoCommit: boolean;
    autoPush: boolean;
    dryRun: boolean;
    parallel: boolean;
  };
  review: {
    autoApproveTestsPassing: boolean;
    createIssuesForChanges: boolean;
  };
  workspace: {
    defaultBranch: string;
    branchPrefix: string;
  };
}

export const APP_CONFIG = Symbol('AppConfig');
