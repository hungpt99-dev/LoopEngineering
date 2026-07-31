import { Command } from 'commander';
import chalk from 'chalk';
import { container } from 'tsyringe';
import { RunProject } from '../../application/usecases/RunProject.js';
import { IssueStatus } from '../../domain/value-objects/IssueStatus.js';

export function createProjectCommand(): Command {
  const command = new Command('project')
    .description('Execute all issues in a project')
    .argument('<name>', 'project name')
    .option('--dry-run', 'plan only, do not execute')
    .action(async (name: string, options: { dryRun?: boolean }) => {
      console.log(chalk.bold.cyan(`\n📦 Project: ${chalk.whiteBright(name)}`));

      if (options.dryRun) {
        console.log(chalk.yellow('⚠️  DRY RUN — no changes will be made'));
      }

      console.log('');

      try {
        const runProject = container.resolve(RunProject);
        const startTime = Date.now();

        const results = await runProject.run(name);

        const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

        if (results.length === 0 && !options.dryRun) {
          console.log(chalk.green('No pending issues in this project.'));
          console.log('');
          return;
        }

        const completed = results.filter((r) => r.status === IssueStatus.COMPLETED).length;
        const failed = results.filter((r) => r.status === IssueStatus.FAILED).length;

        console.log(chalk.gray('─'.repeat(50)));
        console.log(chalk.green.bold(`\n✅ Project "${name}" complete in ${durationSeconds}s`));
        console.log(chalk.white(`   Total processed: ${results.length}`));
        console.log(chalk.green(`   Succeeded: ${completed}`));
        if (failed > 0) {
          console.log(chalk.red(`   Failed: ${failed}`));
        }
        console.log('');
      } catch (error) {
        console.error(
          chalk.red('\n❌ Project execution failed:'),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });

  return command;
}
