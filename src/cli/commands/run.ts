import { Command } from 'commander';
import chalk from 'chalk';
import { container } from 'tsyringe';
import { WorkflowEngine } from '../../application/services/WorkflowEngine.js';
import { ExecuteIssue } from '../../application/usecases/ExecuteIssue.js';

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

      try {
        const engine = container.resolve(WorkflowEngine);
        const executeIssue = container.resolve(ExecuteIssue);

        engine.setExecutor({
          async execute(issueId: string) {
            return executeIssue.execute(issueId);
          },
        });

        console.log(chalk.gray('Starting workflow engine...'));
        console.log(chalk.gray('Press Ctrl+C to stop'));
        console.log('');

        await engine.runAutonomous();

        console.log(chalk.green.bold('\n🏁 Workflow engine finished'));
        console.log('');
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
