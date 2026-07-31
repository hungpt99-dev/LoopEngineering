import { Command } from 'commander';
import chalk from 'chalk';
import { container } from 'tsyringe';
import { ExecuteIssue } from '../../application/usecases/ExecuteIssue.js';
import { IssueStatus } from '../../domain/value-objects/IssueStatus.js';

export function createExecuteCommand(): Command {
  const command = new Command('execute')
    .description('Execute a single Linear issue')
    .argument('<issue-id>', 'Linear issue ID to execute (e.g. ENG-123)')
    .option('--dry-run', 'plan but do not execute')
    .option('--agent <name>', 'specific agent override')
    .action(async (issueId: string, options: { dryRun?: boolean; agent?: string }) => {
      const header = `Issue ${chalk.whiteBright(issueId)}`;
      console.log(chalk.bold.cyan(`\n🚀 Executing ${header}`));

      if (options.agent) {
        console.log(chalk.blue(`   Agent override: ${options.agent}`));
      }

      if (options.dryRun) {
        console.log(chalk.yellow('⚠️  DRY RUN — no changes will be made'));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(chalk.gray('  • Analyze issue and plan implementation'));
        console.log(chalk.gray('  • Select best agent for this issue'));
        console.log(chalk.gray('  • Generate implementation steps'));
        console.log(chalk.gray('  • (Execution skipped in dry-run mode)'));
        console.log('');
        return;
      }

      try {
        const executeIssue = container.resolve(ExecuteIssue);
        const startTime = Date.now();

        console.log(chalk.gray('\n⚙️  Executing...\n'));

        const result = await executeIssue.execute(issueId);

        const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log(chalk.gray('─'.repeat(50)));

        if (result.status === IssueStatus.COMPLETED) {
          console.log(chalk.green.bold(`\n✅ Issue ${issueId} completed in ${durationSeconds}s`));
          console.log(chalk.gray(`   Agent: ${result.agentUsed}`));
          if (result.branch) {
            console.log(chalk.gray(`   Branch: ${result.branch}`));
          }
          if (result.commit) {
            console.log(chalk.gray(`   Commit: ${result.commit.slice(0, 7)}`));
          }
          if (result.tokenUsage) {
            console.log(chalk.gray(`   Tokens: ${result.tokenUsage}`));
          }
        } else {
          console.log(chalk.red.bold(`\n❌ Issue ${issueId} failed`));
          console.log(chalk.gray(`   Status: ${result.status}`));
          console.log(chalk.gray(`   Agent: ${result.agentUsed}`));
          if (result.error) {
            console.log(chalk.red(`   Error: ${result.error}`));
          }
          if (result.retries.length > 0) {
            console.log(chalk.yellow(`   Retries: ${result.retries.length}`));
          }
        }

        console.log('');
      } catch (error) {
        console.error(
          chalk.red(`\n❌ Failed to execute ${issueId}:`),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });

  return command;
}
