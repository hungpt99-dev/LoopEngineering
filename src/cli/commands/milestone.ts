import { Command } from 'commander';
import chalk from 'chalk';
import { container } from 'tsyringe';
import { RunMilestone } from '../../application/usecases/RunMilestone.js';
import { IssueStatus } from '../../domain/value-objects/IssueStatus.js';

export function createMilestoneCommand(): Command {
  const command = new Command('milestone')
    .description('Execute all issues in a milestone')
    .argument('<name>', 'milestone name')
    .option('--project <projectName>', 'project containing the milestone')
    .option('--dry-run', 'plan only, do not execute')
    .action(async (name: string, options: { project?: string; dryRun?: boolean }) => {
      console.log(chalk.bold.cyan(`\n🏁 Milestone: ${chalk.whiteBright(name)}`));

      if (options.project) {
        console.log(chalk.blue(`   Project: ${options.project}`));
      }

      if (options.dryRun) {
        console.log(chalk.yellow('⚠️  DRY RUN — no changes will be made'));
      }

      console.log('');

      try {
        const runMilestone = container.resolve(RunMilestone);
        const startTime = Date.now();

        const results = await runMilestone.run(name, options.project);

        const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

        if (results.length === 0 && !options.dryRun) {
          console.log(chalk.green('No pending issues in this milestone.'));
          console.log('');
          return;
        }

        const completed = results.filter((r) => r.status === IssueStatus.COMPLETED).length;
        const failed = results.filter((r) => r.status === IssueStatus.FAILED).length;

        console.log(chalk.gray('─'.repeat(50)));
        console.log(chalk.green.bold(`\n✅ Milestone "${name}" complete in ${durationSeconds}s`));
        console.log(chalk.white(`   Total processed: ${results.length}`));
        console.log(chalk.green(`   Succeeded: ${completed}`));
        if (failed > 0) {
          console.log(chalk.red(`   Failed: ${failed}`));
        }
        console.log('');
      } catch (error) {
        console.error(
          chalk.red('\n❌ Milestone execution failed:'),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });

  return command;
}
