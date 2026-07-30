# Architecture

## Overview

The AI Software Development Orchestrator follows Clean Architecture (Hexagonal Architecture) principles. The system is divided into concentric layers where dependencies point inward toward the domain. External concerns (APIs, databases, CLI wrappers) are placed at the outer layer, while business entities and rules sit at the core.

## Layer Diagram

```
┌──────────────────────────────────────────────────────────┐
│  CLI Layer             (src/cli/)                        │
│  Commander.js → command registration + output formatting │
├──────────────────────────────────────────────────────────┤
│  Application Layer     (src/application/)                │
│  Use Cases + Services → orchestration, routing, engine    │
├──────────────────────────────────────────────────────────┤
│  Domain Layer          (src/domain/)                     │
│  Entities + Value Objects + Interfaces (Ports)           │
├──────────────────────────────────────────────────────────┤
│  Infrastructure Layer  (src/infrastructure/)             │
│  SDK wrappers, Git, DB, Logging, Config                  │
└──────────────────────────────────────────────────────────┘
```

Dependencies always flow inward: CLI → Application → Domain. Infrastructure implements Domain interfaces and is wired via DI.

## Layers

### Domain Layer (`src/domain/`)

The innermost layer. Contains business entities, value objects, and interface definitions (ports). Has **NO external dependencies** — only `zod` for runtime validation.

#### Entities

| Entity | File | Purpose |
|--------|------|---------|
| `Issue` | `domain/entities/Issue.ts` | Core business object representing a Linear issue. Wraps id, title, description, status, priority, project/milestone context, blocker relations, estimate, due date. Has `canTransitionTo()`, `withStatus()`, `withBranchName()` methods. |
| `Project` | `domain/entities/Project.ts` | Represents a Linear project. Contains id, name, description, state, progress (0-1), dates, team ID, milestone IDs. |
| `Milestone` | `domain/entities/Milestone.ts` | Represents a project milestone. Contains id, name, description, project ID, target date, progress. |
| `AgentTask` | `domain/entities/AgentTask.ts` | Task representation for AI agent execution. Contains issue details, project/milestone context, dependencies, files to inspect, implementation steps, complexity, branch name, environment. Has `fullContext` getter that assembles a formatted prompt string. |
| `ExecutionPlan` | `domain/entities/ExecutionPlan.ts` | AI-generated implementation plan. Contains complexity, recommended agent, confidence score (0-1), implementation steps, files to inspect, risks, dependencies, estimated duration, architecture review flag. |
| `AgentExecutionResult` | `domain/entities/AgentExecutionResult.ts` | Result from agent execution. Contains task ID, agent name, success flag, output/error text, files changed, commit SHA, duration, token usage. |
| `TestResult` | `domain/entities/TestResult.ts` | Test execution outcome. Contains success flag, test counts (total/passed/failed/skipped), duration, output, errors, optional coverage. Has factory methods `success()` and `failure()`. |
| `ReviewResult` | `domain/entities/ReviewResult.ts` | Code review findings. Contains decision (APPROVED/REQUEST_CHANGES), summary, array of ReviewIssues (severity, category, description, file, line, suggestion), score. Has factory methods `approved()` and `requestChanges()`. |
| `ExecutionHistory` | `domain/entities/ExecutionHistory.ts` | Execution record. Contains issue metadata, agent used, status, duration, token usage, result/error, branch, commit, timestamps, retries array. |

#### Value Objects (`src/domain/value-objects/`)

| Value Object | File | Values |
|-------------|------|--------|
| `IssueStatus` | `domain/value-objects/IssueStatus.ts` | `CREATED`, `ANALYZING`, `PLANNING`, `CODING`, `TESTING`, `REVIEWING`, `COMPLETED`, `FAILED`, `RETRY` |
| `Priority` | `domain/value-objects/IssueStatus.ts` | `URGENT = 1`, `HIGH = 2`, `MEDIUM = 3`, `LOW = 4`, `NONE = 0` |
| `Complexity` | `domain/value-objects/IssueStatus.ts` | `LOW`, `MEDIUM`, `HIGH`, `VERY_HIGH` |
| `AgentCapability` | `domain/value-objects/IssueStatus.ts` | `FULL_STACK`, `FRONTEND`, `BACKEND`, `REACT`, `REFACTORING`, `ARCHITECTURE`, `DESIGN`, `SIMPLE_BUG`, `QUICK_FIX`, `DOCUMENTATION`, `TESTING` |

#### Interfaces (Ports)

Each interface is backed by a Symbol token for tsyringe DI registration:

| Interface | Symbol Token | Purpose |
|-----------|-------------|---------|
| `IssueRepository` | `ISSUE_REPOSITORY` | Data access for Issues, Projects, Milestones. Methods: `findNextIssue()`, `findById()`, `findByProjectId()`, `findByMilestoneId()`, `findAll()`, `updateStatus()`, `addComment()`, `createIssue()`, `findProjectByName()`, `findProjectById()`, `findAllProjects()`, `findMilestoneByName()`, `findMilestoneById()`, `findAllMilestones()`, `createBlocker()` |
| `CodingAgentProvider` | `CODING_AGENT_PROVIDER` | AI agent execution contract. Properties: `name`, `capabilities`. Methods: `execute(task)`, `isAvailable()`, `validateEnvironment()` |
| `GitRepository` | `GIT_REPOSITORY` | Version control operations. Methods: `createBranch()`, `checkoutBranch()`, `stageAll()`, `commit()`, `push()`, `getCurrentBranch()`, `hasUncommittedChanges()`, `getChangedFiles()`, `getLatestCommitSha()`, `revertToClean()`, `deleteBranch()`, `branchExists()`, `mergeToDefaultBranch()` |
| `TestRunner` | `TEST_RUNNER` | Test execution contract. Methods: `runAll()`, `runLint()`, `runBuild()`, `runTests(pattern?)`, `getCoverageReport()` |
| `PlannerService` | `PLANNER_SERVICE` | Planning/analysis. Methods: `analyzeIssue()`, `selectAgent()`, `planImplementation()`, `estimateComplexity()` |
| `ContextBuilder` | `CONTEXT_BUILDER` | Context assembly for agent prompts. Methods: `buildIssueContext()`, `buildProjectContext()`, `buildMilestoneContext()`, `buildFullContext()`, `detectDependencies()`, `identifyFiles()` |
| `ReviewerService` | `REVIEWER_SERVICE` | Code review. Methods: `reviewChanges()`, `suggestFixes()` |
| `ExecutionStore` | `EXECUTION_STORE` | Persistence for execution records. Methods: `save()`, `findById()`, `findByIssueId()`, `findByStatus()`, `findAll()`, `update()`, `addRetry()` |
| `AppConfig` | `APP_CONFIG` | Typed configuration contract. Shape: `agents`, `execution`, `review`, `workspace` |
| `Logger` | `LOGGER` | Structured logging contract. Methods: `info()`, `warn()`, `error()`, `debug()`, `child()` |

### Application Layer (`src/application/`)

Orchestrates domain objects to fulfill use cases. Contains NO infrastructure code — only logic that calls domain interfaces.

#### Use Cases (`src/application/usecases/`)

| Use Case | File | Purpose |
|----------|------|---------|
| `ExecuteIssue` | `usecases/ExecuteIssue.ts` | Full issue execution pipeline: analyze → plan → code → test (with retry) → review → complete. Handles state transitions, branch creation, agent execution, comment posting, error recovery. |
| `SelectNextIssue` | `usecases/SelectNextIssue.ts` | Intelligent issue selection. Delegates to `IssueRepository.findNextIssue()` (unassigned, unblocked, non-completed, sorted by priority). Provides preview of upcoming issues with selection rationale. |
| `RunProject` | `usecases/RunProject.ts` | Project-scoped execution. Finds project by name, iterates all non-completed issues, delegates each to `ExecuteIssue`. Supports dry-run mode. |
| `RunMilestone` | `usecases/RunMilestone.ts` | Milestone-scoped execution. Resolves milestone by name (optionally scoped to project), iterates non-completed issues. Auto-discovers project if not specified. |
| `AuditWorkspace` | `usecases/AuditWorkspace.ts` | Workspace analysis. Counts projects, milestones, issues by status (completed/in-progress/blocked/failed). Per-project breakdown with progress percentages. |

#### Services (`src/application/services/`)

| Service | File | Purpose |
|---------|------|---------|
| `PlannerServiceImpl` | `services/PlannerService.ts` | Complexity estimation via scoring algorithm (description length, estimate, label count, blocker count, keyword matching). Implementation plan extraction from structured issue descriptions. Agent selection via keyword-based scoring. Risk assessment including blocker analysis, deadline pressure, security sensitivity, breaking change detection. Duration estimation combining complexity, estimate, and step count. Confidence calculation based on description quality, dependency count, and step count. |
| `AgentRouter` | `services/AgentRouter.ts` | Strategy-based agent selection. Classifies issues by keyword patterns (BUG_FIX_PATTERN → codex, REFACTOR_PATTERN → opencode, FRONTEND_PATTERN → claude). Scores agents: base priority + 50 for preferred match + 20 for capability matching. Falls back to plan recommendation or default. |
| `ContextBuilderImpl` | `services/ContextBuilder.ts` | Multi-level context assembly for agent prompts. Builds issue context (metadata, parent/blocker relations, related project issues), project context (description, milestones, issue stats), milestone context (description, issue list). Detects dependencies from issue references (KEY-123), file paths, and component mentions. Identifies relevant files from file path patterns and keyword-to-path mapping. |
| `ReviewServiceImpl` | `services/ReviewService.ts` | Code review analysis across four phases: (1) Security — config file changes, auth-sensitive files, package.json/lock changes; (2) Anti-patterns — CSS modifications, entry point changes, excessive file counts (≥10 major, ≥20 critical); (3) Test coverage — missing test files, failing tests, low coverage (<70%); (4) Requirements — zero file changes, no test results. Generates category-specific fix suggestions. Score calculation: 100 minus severity-weighted deductions. |
| `WorkflowEngine` | `services/WorkflowEngine.ts` | Autonomous execution loop. Accepts an `IssueExecutor`, then continuously polls `findNextIssue()` until no issues remain. Validates state transitions against defined state machine. Handles graceful stop and per-issue error recovery (marks failed with Linear comment). |

### Infrastructure Layer (`src/infrastructure/`)

Implements domain interfaces using external libraries and services.

#### Linear Integration (`src/infrastructure/linear/`)

| Class | File | Purpose |
|-------|------|---------|
| `LinearClientFactory` | `linear/LinearClient.ts` | Singleton factory for `@linear/sdk` `LinearClient`. Lazy-initializes with `LINEAR_API_KEY` env var. Supports disposal. |
| `LinearIssueRepository` | `linear/LinearIssueRepository.ts` | Full `IssueRepository` implementation. Maps Linear SDK response types to domain entities. Handles state type mapping between Linear (backlog/unstarted/started/completed/canceled) and internal `IssueStatus` enum. Status updates resolve Linear workflow states by name via team workflow states. |
| `LinearService` | `linear/LinearService.ts` | Higher-level Linear operations: workspace info, project summaries, milestone progress tracking, orchestration-specific comment formatting. |

#### AI Agents (`src/infrastructure/agents/`)

| Class | File | Purpose |
|-------|------|---------|
| `AgentRegistry` | `agents/AgentRegistry.ts` | Registry pattern — collects all `CodingAgentProvider` implementations via `@injectAll`. Provides `getProvider(name)`, `getAllProviders()`, `getAvailableProviders()` (filters by `isAvailable()`). |
| `OpenCodeProvider` | `agents/opencode/OpenCodeProvider.ts` | Executes `opencode --task <prompt>`. Capabilities: full-stack, refactoring, architecture, backend, testing. Validates `OPENAI_API_KEY`. Timeout: 60 minutes. |
| `ClaudeCodeProvider` | `agents/claude/ClaudeCodeProvider.ts` | Executes `claude code --prompt <prompt>`. Capabilities: frontend, react, design, architecture, full-stack. Validates `ANTHROPIC_API_KEY`. Timeout: 60 minutes. |
| `CodexProvider` | `agents/codex/CodexProvider.ts` | Executes `codex --task <prompt>` (falls back to `openai-codex`). Capabilities: simple-bug, quick-fix, documentation, backend, testing. Validates `OPENAI_API_KEY`. Timeout: 60 minutes. |
| `CustomProvider` | `agents/custom/CustomProvider.ts` | Configurable provider via `CUSTOM_AGENT_COMMAND` and `CUSTOM_AGENT_ARGS` env vars. Capabilities: custom. Returns early with error message if not configured. |

#### Git (`src/infrastructure/git/`)

| Class | File | Purpose |
|-------|------|---------|
| `GitManager` | `git/GitManager.ts` | Full `GitRepository` implementation via `execa`. Sanitizes branch names (lowercase, alphanumeric + hyphens, max 100 chars). Operations: create/checkout/delete branch, stage all, commit (returns SHA), push (respects `autoPush` config), get current branch, check uncommitted changes, get changed files (diff --name-only HEAD), get latest commit SHA, revert to clean, branch existence check, merge to default branch. |

#### Testing (`src/infrastructure/testing/`)

| Class | File | Purpose |
|-------|------|---------|
| `TestExecutor` | `testing/TestExecutor.ts` | Executes `npm test`, `npm run lint`, `npm run build`, `npm run test:coverage` via `execa`. Parses test output with multiple regex patterns to extract test counts (passed/failed/skipped). Error extraction finds FAIL lines, Error:/AssertionError: lines, and `×` markers. Coverage report via `npm run test:coverage`. |

#### Persistence (`src/infrastructure/persistence/`)

| Class | File | Purpose |
|-------|------|---------|
| `SQLiteExecutionStore` | `persistence/SQLiteExecutionStore.ts` | Prisma-based `ExecutionStore` implementation. Full CRUD for execution records with eager-loaded retries (ordered by attempt ASC). Maps between Prisma model types and domain `ExecutionHistory` entity. |

#### Logging (`src/infrastructure/logging/`)

| Class | File | Purpose |
|-------|------|---------|
| `PinoLogger` | `logging/PinoLogger.ts` | Pino-based structured logger. Pretty-prints in development (`NODE_ENV !== 'production'`), pure JSON in production. Supports child loggers with bindings. Level controlled by `LOG_LEVEL` env var. |

#### Config (`src/infrastructure/config/`)

| Class | File | Purpose |
|-------|------|---------|
| `ConfigLoader` | `config/ConfigLoader.ts` | Loads `config/config.yaml`, validates with Zod schemas, merges with defaults, then applies env var overrides for execution/review/workspace settings. Falls back to defaults on parse failure. |

### CLI Layer (`src/cli/`)

Commander-based CLI with 9 subcommands, each in its own file under `src/cli/commands/`.

**Entry point** (`src/cli/index.ts`):
- Loads `.env` via dotenv
- Validates environment (`validateEnv()`)
- Initializes DI container (`getContainer()`)
- Registers all subcommands
- Parses `process.argv`

**Commands:**

| Command | File | Description |
|---------|------|-------------|
| `audit` | `commands/audit.ts` | Workspace analysis with colored progress bars |
| `next` | `commands/next.ts` | Shows next issues with priority-colored labels |
| `execute` | `commands/execute.ts` | Single issue execution with result feedback |
| `run` | `commands/run.ts` | Autonomous mode — wires `ExecuteIssue` as executor into `WorkflowEngine` |
| `project` | `commands/project.ts` | Project-scoped batch execution |
| `milestone` | `commands/milestone.ts` | Milestone-scoped batch execution |
| `agents` | `commands/agents.ts` | Lists all agents with availability status and env validation |
| `history` | `commands/history.ts` | Tabular execution history with color-coded statuses |
| `plan` | `commands/plan.ts` | Dry-run roadmap with complexity analysis per issue |

### Configuration Layer (`src/config/`)

| File | Purpose |
|------|---------|
| `env.ts` | Zod-based environment variable validation. Throws descriptive error for missing `LINEAR_API_KEY`. |
| `container.ts` | tsyringe DI container setup. Registers all interface→implementation mappings with appropriate lifetimes (singleton for most infrastructure, transient for use cases). Uses Symbol-based tokens for all registrations. |

## Design Patterns Applied

| Pattern | Usage | Location |
|---------|-------|----------|
| **Repository** | `IssueRepository` abstracts Linear data access | `domain/interfaces/IssueRepository.ts` → `infrastructure/linear/LinearIssueRepository.ts` |
| **Provider / Strategy** | `CodingAgentProvider` allows swapping AI agents; `AgentRouter` selects the best one | `domain/interfaces/CodingAgentProvider.ts` → 4 providers in `infrastructure/agents/` |
| **State Machine** | `IssueStatus` manages issue lifecycle transitions with `canTransitionTo()` and `VALID_TRANSITIONS` | `domain/entities/Issue.ts`, `application/services/WorkflowEngine.ts` |
| **Dependency Injection** | tsyringe wires all dependencies via Symbol tokens | `config/container.ts` |
| **Factory** | `LinearClientFactory` creates and caches SDK client; `TestResult.success()` / `TestResult.failure()` are static factories | `infrastructure/linear/LinearClient.ts`, `domain/entities/TestResult.ts` |
| **Singleton** | `LinearClientFactory`, `PinoLogger`, most infrastructure services | Registered with `@singleton()` or default |
| **Registry** | `AgentRegistry` collects and exposes all agent providers | `infrastructure/agents/AgentRegistry.ts` |
| **Observer** | WorkflowEngine polls for new issues and delegates to executor | `application/services/WorkflowEngine.ts` |
| **Builder** | `ContextBuilderImpl` assembles multi-level context strings | `application/services/ContextBuilder.ts` |

## Data Flow

### Execute Issue Pipeline

```
1. CLI command parses issue ID
2. Container resolves ExecuteIssue use case
3. IssueRepository.findById(issueId) → fetches Issue entity from Linear API
4. PlannerService.analyzeIssue(issue) → returns ExecutionPlan (complexity, steps, agent, risks)
5. ContextBuilder.buildFullContext(issue, plan) → assembles rich prompt string
6. PlannerService.selectAgent(issue, plan, availableAgents) → scores and picks best agent
7. GitRepository.createBranch(branchName) → creates feature branch
8. AgentTask.create({...}) → builds task entity with full context
9. CodingAgentProvider.execute(task) → runs AI agent CLI with full context as prompt
10. GitRepository.commit(message) → auto-commits changes (conventional commit format)
11. TestRunner.runAll() → runs test suite, retries up to maxRetries if failing
12. GitRepository.getChangedFiles() → gets diff for review
13. ReviewerService.reviewChanges(issueId, title, files, testResult) → analyzes code
14. IssueRepository.updateStatus(issueId, COMPLETED) → updates Linear state to Done
15. IssueRepository.addComment(issueId, body) → posts execution summary to Linear
16. ExecutionStore.save(record) → persists execution history to SQLite
```

### Autonomous Loop

```
WorkflowEngine.runAutonomous()
  → loop:
    → IssueRepository.findNextIssue()
    → if null: break (no more issues)
    → processIssue(issueId):
      → advanceState(issueId, ANALYZING)
      → executor.execute(issueId)  // ExecuteIssue
    → on error: markFailed(issueId, message)
    → repeat
```

## State Machine

```
CREATED ──→ ANALYZING ──→ PLANNING ──→ CODING ──→ TESTING ──→ REVIEWING ──→ COMPLETED
                  │              │           │          │             │
                  ▼              ▼           ▼          ▼             ▼
               FAILED ←──────── FAILED ←── FAILED ←── FAILED ←──── FAILED
                  │              │           │          │             │
                  └──────────────└───────────└──────────└─────────────┘
                                         │
                                         ▼
                                       RETRY ──→ CODING (back to implementation)
```

Valid transitions are enforced by both `Issue.canTransitionTo()` and `WorkflowEngine.VALID_TRANSITIONS`:

| From | To |
|------|-----|
| CREATED | ANALYZING |
| ANALYZING | PLANNING, FAILED |
| PLANNING | CODING, FAILED |
| CODING | TESTING, FAILED |
| TESTING | REVIEWING, RETRY, FAILED |
| REVIEWING | COMPLETED, RETRY, FAILED |
| COMPLETED | (terminal) |
| FAILED | RETRY |
| RETRY | CODING |

## Complexity Estimation Algorithm

The `PlannerServiceImpl.estimateComplexity()` method calculates a numeric score from issue attributes:

1. **Description length**: 0-4 points (longer = more complex)
2. **Estimate points**: 0-3 points (higher estimate = more complex, no estimate = +1)
3. **Label count**: 0-3 points (more labels = more cross-cutting)
4. **Blocker count**: +2 per blocker issue
5. **Parent issue**: +1 if sub-issue
6. **Keyword matching**: +2 for refactor/architecture keywords, +2 for migration/breaking change keywords

Score thresholds:
- ≤ 2 → `LOW`
- ≤ 5 → `MEDIUM`
- ≤ 8 → `HIGH`
- > 8 → `VERY_HIGH`

## Agent Routing Algorithm

`AgentRouter.route()` and `PlannerServiceImpl.selectAgent()` work together:

1. **Classification phase**: Check issue text against regex patterns:
   - Bug/fix/patch/hotfix keywords → preferred: `codex`
   - Refactor/architecture/redesign/overhaul keywords → preferred: `opencode`
   - Component/UI/React/frontend/CSS keywords → preferred: `claude`
   - HIGH/VERY_HIGH complexity without match → preferred: `opencode`
   - No match → use plan's `recommendedAgent`

2. **Scoring phase**: For each enabled agent:
   - Start with `agent.priority` as base score
   - +50 if agent name matches preferred agent
   - +20 if agent capabilities match issue description patterns
   - +5 per relevant capability
   - Sort descending, select highest scorer

## Review Scoring

`ReviewServiceImpl.calculateScore()` starts at 100 and deducts per issue:

| Severity | Deduction |
|----------|-----------|
| `critical` | -30 |
| `major` | -15 |
| `minor` | -5 |
| `info` | -1 |

Review decision logic:
- Any security critical/major issue → `REQUEST_CHANGES`
- Tests not passing → `REQUEST_CHANGES`
- Any non-zero issues → `REQUEST_CHANGES`
- No issues → `APPROVED` (score 100)

## Security

- All API keys read from `process.env` only — never hardcoded
- Linear API key validated at startup via Zod schema validation
- Agent CLI commands executed via `execa` with timeout (60-minute max)
- Git operations use `execa` — no shell injection risk
- SQLite database is file-based, no network exposure
- `SECURITY_SENSITIVE_PATTERNS` in ReviewService flags: hardcoded credentials, eval() usage, SQL injection risk, console.log in production, dangerouslySetInnerHTML
- Principle of least privilege — each service only receives the dependencies it needs

## Testing Strategy

```
tests/
├── unit/
│   ├── domain/          # Entity/value object unit tests
│   └── services/        # Service logic tests with mocked dependencies
└── integration/         # End-to-end pipeline tests (with mock agents)
```

The domain entities are pure TypeScript classes with Zod validation — naturally testable. Application services use DI so dependencies can be mocked. Integration tests exercise the full pipeline with mock Linear API responses and fake agent providers.
