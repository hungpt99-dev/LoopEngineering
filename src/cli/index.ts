import 'reflect-metadata';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
dotenv.config({ path: join(projectRoot, '.env') });
dotenv.config();

import { Command } from 'commander';
import { createAuditCommand } from './commands/audit.js';
import { createNextCommand } from './commands/next.js';
import { createExecuteCommand } from './commands/execute.js';
import { createRunCommand } from './commands/run.js';
import { createProjectCommand } from './commands/project.js';
import { createMilestoneCommand } from './commands/milestone.js';
import { createAgentsCommand } from './commands/agents.js';
import { createHistoryCommand } from './commands/history.js';
import { createPlanCommand } from './commands/plan.js';
import { validateEnv } from '../config/env.js';
import { getContainer } from '../config/container.js';

validateEnv();

getContainer();

const program = new Command();

program
  .name('ai-dev')
  .description('AI Software Development Orchestrator')
  .version('1.0.0');

program.addCommand(createAuditCommand());
program.addCommand(createNextCommand());
program.addCommand(createExecuteCommand());
program.addCommand(createRunCommand());
program.addCommand(createProjectCommand());
program.addCommand(createMilestoneCommand());
program.addCommand(createAgentsCommand());
program.addCommand(createHistoryCommand());
program.addCommand(createPlanCommand());

program
  .option('--config <path>', 'path to config file')
  .option('--verbose', 'enable verbose logging');

program.parse(process.argv);

export default program;
