import { Command } from 'commander';
import chalk from 'chalk';
import { container } from 'tsyringe';
import {
  ExecutionStore,
  EXECUTION_STORE,
} from '../../domain/interfaces/ExecutionStore.js';
import { IssueStatus } from '../../domain/value-objects/IssueStatus.js';

type ChalkFn = (text: string) => string;

const STATUS_COLORS: Record<string, ChalkFn> = {
  [IssueStatus.COMPLETED]: chalk.green,
  [IssueStatus.FAILED]: chalk.red,
  [IssueStatus.CODING]: chalk.blue,
  [IssueStatus.TESTING]: chalk.yellow,
  [IssueStatus.REVIEWING]: chalk.magenta,
  [IssueStatus.ANALYZING]: chalk.cyan,
  [IssueStatus.PLANNING]: chalk.cyanBright,
  [IssueStatus.CREATED]: chalk.gray,
  [IssueStatus.RETRY]: chalk.yellow,
};

export function createHistoryCommand(): Command {
  const command = new Command('history')
    .description('Show execution history')
    .option('--limit <n>', 'number of records to show', '20')
    .option('--issue <id>', 'filter by issue ID')
    .action(
      async (options: { limit: string; issue?: string }) => {
        const limit = parseInt(options.limit, 10) || 20;

        try {
          const store = container.resolve<ExecutionStore>(EXECUTION_STORE);

          console.log(chalk.bold.cyan('\n📜 Execution History'));

          let records;
          if (options.issue) {
            records = await store.findByIssueId(options.issue);
            console.log(chalk.gray(`Filtered by issue: ${options.issue}`));
          } else {
            records = await store.findAll(limit);
          }

          console.log(chalk.gray('─'.repeat(85)));

          if (records.length === 0) {
            console.log(chalk.yellow('  No execution records found.'));
            console.log('');
            return;
          }

          const colDefs = {
            time: { width: 10, header: 'Time' },
            issue: { width: 13, header: 'Issue' },
            title: { width: 25, header: 'Title' },
            status: { width: 10, header: 'Status' },
            agent: { width: 12, header: 'Agent' },
            duration: { width: 9, header: 'Duration' },
          };

          const headers = Object.values(colDefs)
            .map((c) => c.header.padEnd(c.width))
            .join(' ');

          console.log(chalk.gray(headers));
          console.log(chalk.gray('─'.repeat(85)));

          for (const record of records) {
            const time = record.createdAt.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }).padEnd(colDefs.time.width);

            const issue = record.issueId
              .slice(0, colDefs.issue.width - 1)
              .padEnd(colDefs.issue.width);

            const title = record.issueTitle
              .slice(0, colDefs.title.width - 1)
              .padEnd(colDefs.title.width);

            const statusColor =
              STATUS_COLORS[record.status] ?? chalk.white;
            const status = statusColor(
              record.status.padEnd(colDefs.status.width),
            );

            const agent = record.agentUsed
              .slice(0, colDefs.agent.width - 1)
              .padEnd(colDefs.agent.width);

            const duration = record.duration
              ? `${(record.duration / 1000).toFixed(1)}s`.padEnd(
                  colDefs.duration.width,
                )
              : '—'.padEnd(colDefs.duration.width);

            console.log(
              `${time} ${issue} ${title} ${status} ${agent} ${duration}`,
            );
          }

          const suffix = options.issue
            ? `for issue ${options.issue}`
            : `of ${limit}`;
          console.log(
            chalk.gray(`\nShowing ${records.length} record(s) ${suffix}`),
          );
          console.log('');
        } catch (error) {
          console.error(
            chalk.red('Failed to fetch history:'),
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      },
    );

  return command;
}
