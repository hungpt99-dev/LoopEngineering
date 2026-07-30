import { Command } from 'commander';
import chalk from 'chalk';
import { container } from 'tsyringe';
import { AuditWorkspace } from '../../application/usecases/AuditWorkspace.js';

export function createAuditCommand(): Command {
  const command = new Command('audit')
    .description('Analyze Linear workspace')
    .action(async () => {
      try {
        const auditWorkspace = container.resolve(AuditWorkspace);
        const result = await auditWorkspace.audit();

        console.log(chalk.bold.cyan('\n🔍 Workspace Audit'));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(chalk.white(`Projects:     ${chalk.bold(result.projects)}`));
        console.log(chalk.white(`Milestones:   ${chalk.bold(result.milestones)}`));
        console.log(chalk.white(`Total Issues: ${chalk.bold(result.issues.total)}`));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(chalk.green(`  Completed:  ${result.issues.completed}`));
        console.log(chalk.yellow(`  In Progress: ${result.issues.inProgress}`));
        console.log(chalk.magenta(`  Blocked:    ${result.issues.blocked}`));
        console.log(chalk.red(`  Failed:     ${result.issues.failed}`));

        if (result.projectBreakdown.length > 0) {
          console.log(chalk.bold.cyan('\n📊 Project Breakdown'));
          console.log(chalk.gray('─'.repeat(50)));
          for (const project of result.projectBreakdown) {
            const pct = project.issues > 0
              ? Math.round((project.completed / project.issues) * 100)
              : 0;
            const progressBar = buildProgressBar(pct, 20);
            console.log(
              chalk.white(`  ${project.name.padEnd(25)} `) +
              chalk.gray(`${String(project.completed).padStart(2)}/${String(project.issues).padStart(2)} `) +
              progressBar +
              chalk.gray(` ${pct}%`),
            );
          }
        }

        console.log('');
      } catch (error) {
        console.error(
          chalk.red('Audit failed:'),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });

  return command;
}

function buildProgressBar(pct: number, width: number): string {
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  const color = pct >= 80 ? chalk.green : pct >= 50 ? chalk.yellow : chalk.red;
  return color('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}
