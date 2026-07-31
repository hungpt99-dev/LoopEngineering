import { injectable, inject } from 'tsyringe';
import { execSync } from 'node:child_process';
import { execa, type ResultPromise } from 'execa';
import { CodingAgentProvider } from '../../../domain/interfaces/CodingAgentProvider.js';
import { AgentTask } from '../../../domain/entities/AgentTask.js';
import { AgentExecutionResult } from '../../../domain/entities/AgentExecutionResult.js';
import { Logger, LOGGER } from '../../../domain/interfaces/Logger.js';
import { extractAgentError, getChangedFiles, getErrorOutput } from '../shared/git.js';

@injectable()
export class OpenCodeProvider implements CodingAgentProvider {
  readonly name = 'opencode';
  readonly capabilities = ['full-stack', 'refactoring', 'architecture', 'backend', 'testing'];

  private static activeProcess: ResultPromise | null = null;
  private static activePid: number | null = null;

  static killActiveProcess(): void {
    if (OpenCodeProvider.activePid) {
      try {
        process.kill(-OpenCodeProvider.activePid, 'SIGKILL');
      } catch {
        try {
          process.kill(OpenCodeProvider.activePid, 'SIGKILL');
        } catch {
          /* already dead */
        }
      }
      OpenCodeProvider.activePid = null;
    }
    if (OpenCodeProvider.activeProcess) {
      try {
        OpenCodeProvider.activeProcess.kill('SIGKILL');
      } catch {
        /* already dead */
      }
      OpenCodeProvider.activeProcess = null;
    }
  }

  constructor(@inject(LOGGER) private readonly logger: Logger) {}

  async execute(task: AgentTask): Promise<AgentExecutionResult> {
    const prompt = task.fullContext;
    const startTime = performance.now();

    this.logger.info('Executing OpenCode task', {
      taskId: task.id,
      issueId: task.issueId,
      complexity: task.complexity,
    });

    try {
      const timeout = parseInt(process.env.AGENT_TIMEOUT_MS ?? '600000', 10);
      const child = execa('opencode', ['run', prompt, '--print-logs'], {
        cwd: process.cwd(),
        timeout,
        stdin: 'ignore',
        stderr: 'inherit',
        env: { ...process.env, CI: 'true' },
      });

      OpenCodeProvider.activeProcess = child;
      OpenCodeProvider.activePid = child.pid ?? null;

      const { stdout } = await child;

      OpenCodeProvider.activeProcess = null;
      OpenCodeProvider.activePid = null;

      const duration = Math.round(performance.now() - startTime);
      const filesChanged = await getChangedFiles();

      this.logger.info('OpenCode task completed', {
        taskId: task.id,
        duration,
        filesChanged: filesChanged.length,
      });

      return AgentExecutionResult.create({
        taskId: task.id,
        agentName: this.name,
        success: true,
        output: stdout,
        filesChanged,
        duration,
      });
    } catch (error: unknown) {
      OpenCodeProvider.activeProcess = null;
      OpenCodeProvider.activePid = null;
      const duration = Math.round(performance.now() - startTime);

      const message = extractAgentError(error, this.name);
      const output = getErrorOutput(error);

      this.logger.error('OpenCode task failed', error instanceof Error ? error : undefined, {
        taskId: task.id,
        duration,
      });

      return AgentExecutionResult.create({
        taskId: task.id,
        agentName: this.name,
        success: false,
        output,
        error: message,
        filesChanged: [],
        duration,
      });
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execa('which', ['opencode']);
      return true;
    } catch {
      return false;
    }
  }

  validateEnvironment(): string[] {
    const issues: string[] = [];

    if (!process.env.OPENAI_API_KEY) {
      issues.push('OPENAI_API_KEY environment variable is not set');
    }

    try {
      const stdout = execSync('opencode --version', { encoding: 'utf-8' });
      this.logger.info(`OpenCode version: ${stdout.trim()}`);
    } catch {
      issues.push('opencode CLI version check failed');
    }

    return issues;
  }
}
