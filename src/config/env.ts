import { z } from 'zod';

const EnvSchema = z.object({
  LINEAR_API_KEY: z.string().min(1, 'LINEAR_API_KEY is required'),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  DATABASE_URL: z.string().default('file:./loop-engineering.db'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CONFIG_PATH: z.string().optional(),
  CUSTOM_AGENT_COMMAND: z.string().optional(),
  CUSTOM_AGENT_ARGS: z.string().optional(),
  EXECUTION_MAX_RETRIES: z.string().optional(),
  EXECUTION_AUTO_COMMIT: z.string().optional(),
  EXECUTION_AUTO_PUSH: z.string().optional(),
  EXECUTION_DRY_RUN: z.string().optional(),
  EXECUTION_PARALLEL: z.string().optional(),
  REVIEW_AUTO_APPROVE: z.string().optional(),
  REVIEW_CREATE_ISSUES: z.string().optional(),
  WORKSPACE_DEFAULT_BRANCH: z.string().optional(),
  WORKSPACE_BRANCH_PREFIX: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(): Env {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    const missingKey = result.error.issues.find(
      (issue) => issue.path.includes('LINEAR_API_KEY'),
    );

    if (missingKey) {
      throw new Error(
        'LINEAR_API_KEY environment variable is required.\n' +
          'Please set it in your .env file or environment:\n' +
          '  export LINEAR_API_KEY=your_api_key_here\n' +
          'Or create a .env file with:\n' +
          '  LINEAR_API_KEY=your_api_key_here',
      );
    }

    const messages = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');

    throw new Error(`Environment validation failed:\n${messages}`);
  }

  return result.data;
}
