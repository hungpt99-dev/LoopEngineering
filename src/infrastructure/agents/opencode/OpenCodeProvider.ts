import { injectable, inject } from 'tsyringe';
import { execa } from 'execa';
import { CodingAgentProvider } from '../../../domain/interfaces/CodingAgentProvider.js';
import { AgentTask } from '../../../domain/entities/AgentTask.js';
import { AgentExecutionResult } from '../../../domain/entities/AgentExecutionResult.js';
import { Logger, LOGGER } from '../../../domain/interfaces/Logger.js';

@injectable()
export class OpenCodeProvider implements CodingAgentProvider {
  readonly name = 'opencode';
  readonly capabilities = [
    'full-stack',
    'refactoring',
    'architecture',
    'backend',
    'testing',
  ];

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
      const { stdout } = await execa('opencode', ['run', prompt], {
        cwd: process.cwd(),
        timeout: 3_600_000,
      });

      const duration = Math.round(performance.now() - startTime);
      const filesChanged = await this.getChangedFiles();

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
      const duration = Math.round(performance.now() - startTime);
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred';

      this.logger.error('OpenCode task failed', error instanceof Error ? error : undefined, {
        taskId: task.id,
        duration,
      });

      return AgentExecutionResult.create({
        taskId: task.id,
        agentName: this.name,
        success: false,
        output: '',
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

  async validateEnvironment(): Promise<string[]> {
    const issues: string[] = [];

    if (!process.env.OPENAI_API_KEY) {
      issues.push('OPENAI_API_KEY environment variable is not set');
    }

    try {
      const { stdout } = await execa('opencode', ['--version'], {
        reject: false,
      });
      this.logger.info(`OpenCode version: ${stdout.trim()}`);
    } catch {
      issues.push('opencode CLI version check failed');
    }

    return issues;
  }

  private async getChangedFiles(): Promise<string[]> {
    try {
      const { stdout } = await execa('git', ['diff', '--name-only', 'HEAD'], {
        reject: false,
      });
      return stdout
        .trim()
        .split('\n')
        .filter((line) => line.length > 0);
    } catch {
      return [];
    }
  }
}
