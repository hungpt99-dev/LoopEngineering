import { injectable, inject } from 'tsyringe';
import { execa } from 'execa';
import { CodingAgentProvider } from '../../../domain/interfaces/CodingAgentProvider.js';
import { AgentTask } from '../../../domain/entities/AgentTask.js';
import { AgentExecutionResult } from '../../../domain/entities/AgentExecutionResult.js';
import { Logger, LOGGER } from '../../../domain/interfaces/Logger.js';

@injectable()
export class ClaudeCodeProvider implements CodingAgentProvider {
  readonly name = 'claude';
  readonly capabilities = [
    'frontend',
    'react',
    'design',
    'architecture',
    'full-stack',
  ];

  constructor(@inject(LOGGER) private readonly logger: Logger) {}

  async execute(task: AgentTask): Promise<AgentExecutionResult> {
    const prompt = task.fullContext;
    const startTime = performance.now();

    this.logger.info('Executing Claude Code task', {
      taskId: task.id,
      issueId: task.issueId,
      complexity: task.complexity,
    });

    try {
      const { stdout } = await execa('claude', ['code', '--prompt', prompt], {
        timeout: 3_600_000,
      });

      const duration = Math.round(performance.now() - startTime);
      const filesChanged = await this.getChangedFiles();

      this.logger.info('Claude Code task completed', {
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

      this.logger.error('Claude Code task failed', error instanceof Error ? error : undefined, {
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
      await execa('which', ['claude']);
      return true;
    } catch {
      return false;
    }
  }

  async validateEnvironment(): Promise<string[]> {
    const issues: string[] = [];

    if (!process.env.ANTHROPIC_API_KEY) {
      issues.push('ANTHROPIC_API_KEY environment variable is not set');
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
