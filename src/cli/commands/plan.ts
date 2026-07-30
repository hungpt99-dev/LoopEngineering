import { Command } from 'commander';
import chalk from 'chalk';
import { container } from 'tsyringe';
import {
  IssueRepository,
  ISSUE_REPOSITORY,
} from '../../domain/interfaces/IssueRepository.js';
import { SelectNextIssue } from '../../application/usecases/SelectNextIssue.js';
import { PlannerService, PLANNER_SERVICE } from '../../domain/interfaces/PlannerService.js';
import { IssueStatus, Complexity } from '../../domain/value-objects/IssueStatus.js';

type ChalkFn = (text: string) => string;

const COMPLEXITY_COLOR: Record<string, ChalkFn> = {
  [Complexity.LOW]: chalk.green,
  [Complexity.MEDIUM]: chalk.yellow,
  [Complexity.HIGH]: chalk.red,
  [Complexity.VERY_HIGH]: chalk.redBright.bold,
};

export function createPlanCommand(): Command {
  const command = new Command('plan')
    .description('Show execution plan without running agents (dry run)')
    .option('--project <name>', 'plan by project name')
    .option('--milestone <name>', 'plan by milestone name')
    .option('--limit <n>', 'maximum issues to show', '10')
    .action(
      async (options: {
        project?: string;
        milestone?: string;
        limit: string;
      }) => {
        try {
          const limit = parseInt(options.limit, 10) || 10;

          console.log(chalk.bold.cyan('\n📋 Execution Plan'));
          console.log(
            chalk.yellow('⚠️  DRY RUN — this shows the plan, no agents run'),
          );
          console.log(chalk.gray('─'.repeat(70)));

          if (options.project) {
            await showProjectPlan(options.project, limit);
          } else if (options.milestone) {
            console.log(chalk.bold(`Milestone: ${chalk.whiteBright(options.milestone)}`));
            console.log(
              chalk.yellow(
                '  Provide --project <name> to resolve milestone plans in detail.',
              ),
            );
          } else {
            await showGlobalPlan(limit);
          }

          console.log('');
        } catch (error) {
          console.error(
            chalk.red('Failed to generate plan:'),
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      },
    );

  return command;
}

async function showProjectPlan(projectName: string, limit: number): Promise<void> {
  const issueRepo = container.resolve<IssueRepository>(ISSUE_REPOSITORY);
  const planner = container.resolve<PlannerService>(PLANNER_SERVICE);

  const project = await issueRepo.findProjectByName(projectName);
  if (!project) {
    console.log(chalk.red(`  Project not found: ${projectName}`));
    return;
  }

  const issues = await issueRepo.findByProjectId(project.id);
  const pending = issues.filter(
    (i) => i.status !== IssueStatus.COMPLETED && i.status !== IssueStatus.FAILED,
  );
  const completed = issues.filter(
    (i) => i.status === IssueStatus.COMPLETED,
  ).length;

  console.log(chalk.bold(`Project: ${chalk.whiteBright(projectName)}`));
  console.log(chalk.white(`  Total: ${issues.length} issues`));
  console.log(chalk.green(`  Completed: ${completed}`));
  console.log(chalk.yellow(`  Pending: ${pending.length}`));

  if (pending.length === 0) {
    console.log(chalk.green('\n  All issues complete.'));
    return;
  }

  console.log(chalk.bold('\n  Execution Order:'));
  console.log('');

  const shown = pending.slice(0, limit);
  for (let i = 0; i < shown.length; i++) {
    const issue = shown[i]!;
    let complexity = '—';
    let agent = '—';

    try {
      const plan = await planner.analyzeIssue(issue);
      complexity = plan.complexity;
      agent = plan.recommendedAgent;
    } catch {
      // planner analysis is best-effort in dry-run mode
    }

    const complexityColor = COMPLEXITY_COLOR[complexity] ?? chalk.gray;
    const step = `${i + 1}.`.padEnd(3);

    console.log(
      chalk.bold(`  ${step} `) +
        chalk.whiteBright(issue.title.slice(0, 55)),
    );
    console.log(
      chalk.gray(
        `       ${issue.id}  `,
      ) +
        complexityColor(`Complexity: ${complexity}`) +
        chalk.gray(`  Agent: ${agent}`),
    );
  }

  if (pending.length > limit) {
    console.log(
      chalk.gray(`\n  ... and ${pending.length - limit} more pending issues`),
    );
  }
}

async function showGlobalPlan(limit: number): Promise<void> {
  const selectNext = container.resolve(SelectNextIssue);
  const preview = await selectNext.preview(limit);

  console.log(chalk.bold('Global Pending Issues:'));
  console.log('');

  if (preview.length === 0) {
    console.log(chalk.green('  No pending issues found.'));
    return;
  }

  for (let i = 0; i < preview.length; i++) {
    const { issue, reason } = preview[i]!;
    const step = `${i + 1}.`.padEnd(3);

    console.log(
      chalk.bold(`  ${step} `) +
        chalk.whiteBright(issue.title.slice(0, 55)),
    );
    console.log(chalk.gray(`       ${reason}`));
    console.log('');
  }
}
