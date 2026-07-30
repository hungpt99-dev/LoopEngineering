import { Command } from 'commander';
import chalk from 'chalk';
import { container } from 'tsyringe';
import { WorkflowEngine } from '../../application/services/WorkflowEngine.js';
import { ExecuteIssue } from '../../application/usecases/ExecuteIssue.js';
import { OpenCodeProvider } from '../../infrastructure/agents/opencode/OpenCodeProvider.js';

export function createRunCommand(): Command {
  const command = new Command('run')
    .description('Autonomous execution mode — runs all pending issues')
    .option('--dry-run', 'plan only, do not execute')
    .option('--limit <n>', 'maximum number of issues to process')
    .action(async (options: { dryRun?: boolean; limit?: string }) => {
      console.log(chalk.bold.cyan('\n🤖 Autonomous Execution Mode'));

      if (options.dryRun) {
        console.log(chalk.yellow('⚠️  DRY RUN — issues will be discovered but not executed'));
      }

      if (options.limit) {
        console.log(chalk.gray(`   Limit: ${options.limit} issues`));
      }

      console.log('');

      let forceStop = false;

      const shutdown = async (engine: WorkflowEngine) => {
        if (forceStop) {
          console.log(chalk.red('\n\n🛑 Force stopping...'));
          OpenCodeProvider.killActiveProcess();
          process.exit(1);
        }
        console.log(chalk.yellow('\n\n⏸️  Stopping after current issue... (press Ctrl+C again to force stop)'));
        OpenCodeProvider.killActiveProcess();
        await engine.stop();
        forceStop = true;
      };

      try {
        const engine = container.resolve(WorkflowEngine);
        const executeIssue = container.resolve(ExecuteIssue);

        engine.setExecutor({
          async execute(issueId: string) {
            return executeIssue.execute(issueId);
          },
        });

        process.on('SIGINT', () => shutdown(engine));
        process.on('SIGTERM', () => shutdown(engine));

        console.log(chalk.gray('Starting workflow engine...'));
        console.log(chalk.yellow('Press Ctrl+C once to stop gracefully, twice to force exit'));
        console.log('');

        await engine.runAutonomous();

        console.log(chalk.green.bold('\n🏁 Workflow engine finished'));
        console.log('');
        process.exit(0);
      } catch (error) {
        console.error(
          chalk.red('\n❌ Workflow engine failed:'),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });

  return command;
}
