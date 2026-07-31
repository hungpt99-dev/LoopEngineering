import { Command } from 'commander';
import chalk from 'chalk';
import readline from 'node:readline';
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
      let engine: WorkflowEngine | null = null;
      const wasRaw = process.stdin.isTTY;

      const cleanup = () => {
        if (wasRaw && process.stdin.isTTY) {
          try { process.stdin.setRawMode(false); } catch { /* not a TTY */ }
          try { process.stdin.pause(); } catch { /* ignore */ }
        }
      };

      const shutdown = async (target: WorkflowEngine) => {
        if (forceStop) {
          console.log(chalk.red('\n🛑 Force stopping...'));
          OpenCodeProvider.killActiveProcess();
          cleanup();
          process.exit(1);
        }
        console.log(chalk.yellow('\n⏸️  Stopping after current issue... (press Ctrl+C again to force stop)'));
        OpenCodeProvider.killActiveProcess();
        await target.stop();
        forceStop = true;
      };

      const onSigint = () => {
        if (engine) shutdown(engine);
      };
      const onSigterm = () => {
        if (engine) shutdown(engine);
      };

      try {
        engine = container.resolve(WorkflowEngine);
        const executeIssue = container.resolve(ExecuteIssue);

        engine.setExecutor({
          async execute(issueId: string) {
            return executeIssue.execute(issueId);
          },
        });

        if (process.stdin.isTTY) {
          readline.emitKeypressEvents(process.stdin);
          process.stdin.setRawMode(true);
          process.stdin.on('keypress', (_str: string, key: readline.Key) => {
            if (key.ctrl && key.name === 'c') {
              if (engine) shutdown(engine);
            }
          });
        }

        process.on('SIGINT', onSigint);
        process.on('SIGTERM', onSigterm);

        console.log(chalk.gray('Starting workflow engine...'));
        console.log(chalk.yellow('Press Ctrl+C once to stop gracefully, twice to force exit'));
        console.log('');

        await engine.runAutonomous();

        console.log(chalk.green.bold('\n🏁 Workflow engine finished'));
        console.log('');
        cleanup();
        process.exit(0);
      } catch (error) {
        console.error(
          chalk.red('\n❌ Workflow engine failed:'),
          error instanceof Error ? error.message : String(error),
        );
        cleanup();
        process.exit(1);
      } finally {
        process.removeListener('SIGINT', onSigint);
        process.removeListener('SIGTERM', onSigterm);
        cleanup();
      }
    });

  return command;
}
