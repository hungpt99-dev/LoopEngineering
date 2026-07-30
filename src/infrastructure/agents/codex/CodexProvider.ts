import { injectable, inject } from 'tsyringe';
import { execa } from 'execa';
import { CodingAgentProvider } from '../../../domain/interfaces/CodingAgentProvider.js';
import { AgentTask } from '../../../domain/entities/AgentTask.js';
import { AgentExecutionResult } from '../../../domain/entities/AgentExecutionResult.js';
import { Logger, LOGGER } from '../../../domain/interfaces/Logger.js';

@injectable()
export class CodexProvider implements CodingAgentProvider {
  readonly name = 'codex';
  readonly capabilities = [
    'simple-bug',
    'quick-fix',
    'documentation',
    'backend',
    'testing',
  ];

  constructor(@inject(LOGGER) private readonly logger: Logger) {}

  async execute(task: AgentTask): Promise<AgentExecutionResult> {
    const prompt = task.fullContext;
    const startTime = performance.now();

    this.logger.info('Executing Codex task', {
      taskId: task.id,
      issueId: task.issueId,
      complexity: task.complexity,
    });

    try {
      const { stdout } = await execa('codex', ['--task', prompt], {
        timeout: 3_600_000,
      });

      const duration = Math.round(performance.now() - startTime);
      const filesChanged = await this.getChangedFiles();

      this.logger.info('Codex task completed', {
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

      this.logger.error('Codex task failed', error instanceof Error ? error : undefined, {
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
      await execa('which', ['codex']);
      return true;
    } catch {
      try {
        await execa('which', ['openai-codex']);
        return true;
      } catch {
        return false;
      }
    }
  }

  async validateEnvironment(): Promise<string[]> {
    const issues: string[] = [];

    if (!process.env.OPENAI_API_KEY) {
      issues.push('OPENAI_API_KEY environment variable is not set');
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
