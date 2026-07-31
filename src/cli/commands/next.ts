import { Command } from 'commander';
import chalk from 'chalk';
import { container } from 'tsyringe';
import { SelectNextIssue } from '../../application/usecases/SelectNextIssue.js';
import { Priority } from '../../domain/value-objects/IssueStatus.js';

export function createNextCommand(): Command {
  const command = new Command('next')
    .description('Show next recommended issue')
    .option('--count <n>', 'number of issues to show', '5')
    .action(async (options: { count: string }) => {
      try {
        const count = parseInt(options.count, 10) || 5;
        const selectNext = container.resolve(SelectNextIssue);
        const results = await selectNext.preview(count);

        console.log(
          chalk.bold.cyan(
            `\n📋 Next ${results.length} Recommended Issue${results.length !== 1 ? 's' : ''}`,
          ),
        );
        console.log(chalk.gray('─'.repeat(70)));

        if (results.length === 0) {
          console.log(chalk.yellow('  No eligible issues found.'));
          console.log('');
          return;
        }

        for (let i = 0; i < results.length; i++) {
          const { issue, reason } = results[i]!;
          const index = String(i + 1).padStart(2, ' ');

          let priorityLabel: string;
          let priorityColor: typeof chalk.white;
          switch (issue.priority) {
            case Priority.URGENT:
              priorityLabel = 'URGENT';
              priorityColor = chalk.redBright.bold;
              break;
            case Priority.HIGH:
              priorityLabel = 'HIGH';
              priorityColor = chalk.red;
              break;
            case Priority.MEDIUM:
              priorityLabel = 'MEDIUM';
              priorityColor = chalk.yellow;
              break;
            case Priority.LOW:
              priorityLabel = 'LOW';
              priorityColor = chalk.gray;
              break;
            default:
              priorityLabel = 'NONE';
              priorityColor = chalk.dim;
              break;
          }

          console.log(chalk.bold(`  ${index}. `) + chalk.whiteBright(issue.title.slice(0, 60)));
          console.log(
            chalk.gray(`     ID: ${issue.id}  `) + priorityColor(`Priority: ${priorityLabel}`),
          );
          console.log(chalk.gray(`     ${reason}`));
          console.log('');
        }
      } catch (error) {
        console.error(
          chalk.red('Failed to fetch next issues:'),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });

  return command;
}
