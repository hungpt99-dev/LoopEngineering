import { Command } from 'commander';
import chalk from 'chalk';
import { container } from 'tsyringe';
import type { IAgentRegistry } from '../../domain/interfaces/AgentRegistry.js';
import { AGENT_REGISTRY } from '../../domain/interfaces/AgentRegistry.js';

export function createAgentsCommand(): Command {
  const command = new Command('agents')
    .description('Show available AI coding agents')
    .action(async () => {
      console.log(chalk.bold.cyan('\n🤖 Available AI Coding Agents'));
      console.log(chalk.gray('─'.repeat(70)));
      console.log('');

      try {
        const registry = container.resolve<IAgentRegistry>(AGENT_REGISTRY);
        const providers = registry.getAllProviders();

        if (providers.length === 0) {
          console.log(chalk.yellow('  No agents registered.'));
          console.log('');
          return;
        }

        const availabilityResults = await Promise.all(
          providers.map(async (provider) => ({
            provider,
            available: await provider.isAvailable(),
            envIssues: provider.validateEnvironment(),
          })),
        );

        for (const { provider, available, envIssues } of availabilityResults) {
          const statusIcon = available
            ? chalk.green.bold('🟢 Available')
            : chalk.red.dim('🔴 Unavailable');
          const nameDisplay = available
            ? chalk.bold.whiteBright(`  ${provider.name}`)
            : chalk.dim(`  ${provider.name}`);

          console.log(nameDisplay);
          console.log(chalk.gray(`     Status:       ${statusIcon}`));
          console.log(
            chalk.gray(
              `     Capabilities: ${provider.capabilities.length > 0 ? provider.capabilities.join(', ') : 'none'}`,
            ),
          );

          if (envIssues.length > 0) {
            console.log(chalk.yellow('     Environment issues:'));
            for (const issue of envIssues) {
              console.log(chalk.yellow(`       ⚠  ${issue}`));
            }
          }

          console.log('');
        }
      } catch (error) {
        console.error(
          chalk.red('Failed to list agents:'),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });

  return command;
}
