import { injectable, inject } from 'tsyringe';
import { execa } from 'execa';
import { CodingAgentProvider } from '../../../domain/interfaces/CodingAgentProvider.js';
import { AgentTask } from '../../../domain/entities/AgentTask.js';
import { AgentExecutionResult } from '../../../domain/entities/AgentExecutionResult.js';
import { Logger, LOGGER } from '../../../domain/interfaces/Logger.js';
import { getChangedFiles } from '../shared/git.js';

@injectable()
export class CustomProvider implements CodingAgentProvider {
  readonly name = 'custom';
  readonly capabilities: string[] = ['custom'];

  private readonly command: string;
  private readonly args: string[];

  constructor(@inject(LOGGER) private readonly logger: Logger) {
    this.command = process.env.CUSTOM_AGENT_COMMAND ?? '';
    this.args = process.env.CUSTOM_AGENT_ARGS
      ? process.env.CUSTOM_AGENT_ARGS.split(',')
          .map((a) => a.trim())
          .filter((a) => a.length > 0)
      : [];
  }

  async execute(task: AgentTask): Promise<AgentExecutionResult> {
    if (!this.command) {
      return AgentExecutionResult.create({
        taskId: task.id,
        agentName: this.name,
        success: false,
        output: '',
        error: 'Custom agent command is not configured. Set CUSTOM_AGENT_COMMAND or pass options.',
        filesChanged: [],
        duration: 0,
      });
    }

    const prompt = task.fullContext;
    const startTime = performance.now();

    this.logger.info('Executing Custom agent task', {
      taskId: task.id,
      issueId: task.issueId,
      command: this.command,
      complexity: task.complexity,
    });

    try {
      const { stdout } = await execa(this.command, [...this.args, prompt], {
        timeout: 3_600_000,
      });

      const duration = Math.round(performance.now() - startTime);
      const filesChanged = await getChangedFiles();

      this.logger.info('Custom agent task completed', {
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
      const message = error instanceof Error ? error.message : 'Unknown error occurred';

      this.logger.error('Custom agent task failed', error instanceof Error ? error : undefined, {
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
    if (!this.command) {
      return false;
    }

    try {
      await execa('which', [this.command]);
      return true;
    } catch {
      return false;
    }
  }

  validateEnvironment(): string[] {
    const issues: string[] = [];

    if (!this.command) {
      issues.push('CUSTOM_AGENT_COMMAND is not set and no command option was provided');
    }

    return issues;
  }
}
