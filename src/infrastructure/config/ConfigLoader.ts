import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectable } from 'tsyringe';
import yaml from 'yaml';
import { z } from 'zod';
import type { AppConfig as AppConfigInterface } from '../../domain/interfaces/AppConfig.js';

export const APP_CONFIG = Symbol('AppConfig');

const AgentsConfigSchema = z.record(
  z.string(),
  z.object({
    enabled: z.boolean().default(true),
    priority: z.number().int().default(0),
    capabilities: z.array(z.string()).default([]),
  }),
);

const ExecutionConfigSchema = z.object({
  maxRetries: z.number().int().min(0).default(3),
  autoCommit: z.boolean().default(true),
  autoPush: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  parallel: z.boolean().default(false),
});

const ReviewConfigSchema = z.object({
  autoApproveTestsPassing: z.boolean().default(false),
  createIssuesForChanges: z.boolean().default(true),
});

const WorkspaceConfigSchema = z.object({
  defaultBranch: z.string().default('main'),
  branchPrefix: z.string().default('ai/'),
});

const AppConfigSchema = z.object({
  agents: AgentsConfigSchema,
  execution: ExecutionConfigSchema,
  review: ReviewConfigSchema,
  workspace: WorkspaceConfigSchema,
});

const DEFAULT_CONFIG: AppConfigInterface = {
  agents: {},
  execution: {
    maxRetries: 3,
    autoCommit: true,
    autoPush: false,
    dryRun: false,
    parallel: false,
  },
  review: {
    autoApproveTestsPassing: false,
    createIssuesForChanges: true,
  },
  workspace: {
    defaultBranch: 'main',
    branchPrefix: 'ai/',
  },
};

function mergeEnvOverrides(config: AppConfigInterface): AppConfigInterface {
  const env = process.env;

  return {
    ...config,
    execution: {
      ...config.execution,
      ...(env.EXECUTION_MAX_RETRIES !== undefined
        ? { maxRetries: parseInt(env.EXECUTION_MAX_RETRIES, 10) }
        : {}),
      ...(env.EXECUTION_AUTO_COMMIT === 'true'
        ? { autoCommit: true }
        : env.EXECUTION_AUTO_COMMIT === 'false'
          ? { autoCommit: false }
          : {}),
      ...(env.EXECUTION_AUTO_PUSH === 'true'
        ? { autoPush: true }
        : env.EXECUTION_AUTO_PUSH === 'false'
          ? { autoPush: false }
          : {}),
      ...(env.EXECUTION_DRY_RUN === 'true'
        ? { dryRun: true }
        : env.EXECUTION_DRY_RUN === 'false'
          ? { dryRun: false }
          : {}),
      ...(env.EXECUTION_PARALLEL === 'true'
        ? { parallel: true }
        : env.EXECUTION_PARALLEL === 'false'
          ? { parallel: false }
          : {}),
    },
    review: {
      ...config.review,
      ...(env.REVIEW_AUTO_APPROVE === 'true'
        ? { autoApproveTestsPassing: true }
        : env.REVIEW_AUTO_APPROVE === 'false'
          ? { autoApproveTestsPassing: false }
          : {}),
      ...(env.REVIEW_CREATE_ISSUES === 'true'
        ? { createIssuesForChanges: true }
        : env.REVIEW_CREATE_ISSUES === 'false'
          ? { createIssuesForChanges: false }
          : {}),
    },
    workspace: {
      ...config.workspace,
      ...(env.WORKSPACE_DEFAULT_BRANCH !== undefined
        ? { defaultBranch: env.WORKSPACE_DEFAULT_BRANCH }
        : {}),
      ...(env.WORKSPACE_BRANCH_PREFIX !== undefined
        ? { branchPrefix: env.WORKSPACE_BRANCH_PREFIX }
        : {}),
    },
  };
}

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

@injectable()
export class ConfigLoader {
  load(): AppConfigInterface {
    const configPath = process.env.CONFIG_PATH ?? join(PROJECT_ROOT, 'config', 'config.yaml');

    let fileConfig: Record<string, unknown> = {};

    try {
      const raw = readFileSync(configPath, 'utf-8');
      fileConfig = yaml.parse(raw) ?? {};
    } catch {
      console.warn(`Config file not found at ${configPath}, using defaults`);
    }

    const merged = { ...DEFAULT_CONFIG, ...fileConfig } as Record<string, unknown>;

    const parsed = AppConfigSchema.safeParse(merged);

    if (!parsed.success) {
      console.warn(
        'Config validation warnings:',
        parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
      );
      return mergeEnvOverrides(DEFAULT_CONFIG);
    }

    return mergeEnvOverrides(parsed.data);
  }
}
