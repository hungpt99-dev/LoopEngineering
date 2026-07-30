import 'reflect-metadata';
import { container } from 'tsyringe';

import { LOGGER } from '../domain/interfaces/Logger.js';
import { ISSUE_REPOSITORY } from '../domain/interfaces/IssueRepository.js';
import { CODING_AGENT_PROVIDER } from '../domain/interfaces/CodingAgentProvider.js';
import { GIT_REPOSITORY } from '../domain/interfaces/GitRepository.js';
import { TEST_RUNNER } from '../domain/interfaces/TestRunner.js';
import { PLANNER_SERVICE } from '../domain/interfaces/PlannerService.js';
import { CONTEXT_BUILDER } from '../domain/interfaces/ContextBuilder.js';
import { REVIEWER_SERVICE } from '../domain/interfaces/ReviewerService.js';
import { EXECUTION_STORE } from '../domain/interfaces/ExecutionStore.js';
import { APP_CONFIG } from '../domain/interfaces/AppConfig.js';
import { AGENT_REGISTRY } from '../infrastructure/agents/AgentRegistry.js';
import { LINEAR_CLIENT_FACTORY } from '../infrastructure/linear/LinearClient.js';

import { PinoLogger } from '../infrastructure/logging/PinoLogger.js';
import { LinearClientFactory } from '../infrastructure/linear/LinearClient.js';
import { LinearIssueRepository } from '../infrastructure/linear/LinearIssueRepository.js';
import { GitManager } from '../infrastructure/git/GitManager.js';
import { TestExecutor } from '../infrastructure/testing/TestExecutor.js';
import { PlannerServiceImpl } from '../application/services/PlannerService.js';
import { ContextBuilderImpl } from '../application/services/ContextBuilder.js';
import { ReviewServiceImpl } from '../application/services/ReviewService.js';
import { SQLiteExecutionStore } from '../infrastructure/persistence/SQLiteExecutionStore.js';
import { ConfigLoader } from '../infrastructure/config/ConfigLoader.js';
import { AgentRegistry } from '../infrastructure/agents/AgentRegistry.js';
import { OpenCodeProvider } from '../infrastructure/agents/opencode/OpenCodeProvider.js';
import { CodexProvider } from '../infrastructure/agents/codex/CodexProvider.js';
import { ClaudeCodeProvider } from '../infrastructure/agents/claude/ClaudeCodeProvider.js';
import { CustomProvider } from '../infrastructure/agents/custom/CustomProvider.js';
import { ExecuteIssue } from '../application/usecases/ExecuteIssue.js';
import { SelectNextIssue } from '../application/usecases/SelectNextIssue.js';
import { RunProject } from '../application/usecases/RunProject.js';
import { RunMilestone } from '../application/usecases/RunMilestone.js';
import { AuditWorkspace } from '../application/usecases/AuditWorkspace.js';
import { WorkflowEngine } from '../application/services/WorkflowEngine.js';

function setupContainer(): typeof container {
  container.register(LOGGER, { useClass: PinoLogger });
  container.register(LINEAR_CLIENT_FACTORY, { useClass: LinearClientFactory });
  container.register(ISSUE_REPOSITORY, { useClass: LinearIssueRepository });
  container.register(GIT_REPOSITORY, { useClass: GitManager });
  container.register(TEST_RUNNER, { useClass: TestExecutor });
  container.register(EXECUTION_STORE, { useClass: SQLiteExecutionStore });

  container.register(PLANNER_SERVICE, { useClass: PlannerServiceImpl });
  container.register(CONTEXT_BUILDER, { useClass: ContextBuilderImpl });
  container.register(REVIEWER_SERVICE, { useClass: ReviewServiceImpl });

  container.register(ConfigLoader, { useClass: ConfigLoader });
  const configLoader = container.resolve(ConfigLoader);
  container.registerInstance(APP_CONFIG, configLoader.load());

  container.register(CODING_AGENT_PROVIDER, { useClass: CustomProvider });
  container.register(CODING_AGENT_PROVIDER, { useClass: ClaudeCodeProvider });
  container.register(CODING_AGENT_PROVIDER, { useClass: CodexProvider });
  container.register(CODING_AGENT_PROVIDER, { useClass: OpenCodeProvider });

  container.register(AGENT_REGISTRY, { useClass: AgentRegistry });

  container.register(ExecuteIssue, { useClass: ExecuteIssue });
  container.register(SelectNextIssue, { useClass: SelectNextIssue });
  container.register(RunProject, { useClass: RunProject });
  container.register(RunMilestone, { useClass: RunMilestone });
  container.register(AuditWorkspace, { useClass: AuditWorkspace });
  container.register(WorkflowEngine, { useClass: WorkflowEngine });

  return container;
}

export function getContainer(): typeof container {
  return setupContainer();
}

export default container;
