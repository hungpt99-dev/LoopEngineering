# AI Software Development Orchestrator

Production-grade AI engineering platform that autonomously manages software development using Linear as project management, multiple AI coding agents, Git, automated testing, and code review.

## Features

- **Autonomous issue execution** from Linear — picks up unassigned issues and runs them through the full pipeline
- **Multiple AI coding agent support** — OpenCode, Claude Code, Codex, and Custom provider via CLI integration
- **Intelligent agent routing** — keyword-based classification + complexity scoring to select the best agent per issue
- **Automated testing** — runs project test suite, parses results, retries on failure up to `maxRetries`
- **Automated code review** — security checks, anti-pattern detection, test coverage analysis, requirement verification
- **Linear status updates** — comments and state transitions posted to Linear at each pipeline stage
- **Git branch management** — creates feature branches, conventional commits (`feat:`, `fix:`), optional auto-push
- **Full execution history** — SQLite persistence with retry tracking, token usage, duration metrics
- **Observability** — structured logging via Pino with pretty-print in development
- **Clean Architecture** — 4-layer architecture with dependency injection via tsyringe

## Quick Start

```bash
npm install
cp .env.example .env  # Set LINEAR_API_KEY
npx prisma generate
npm run build
./bin/ai-dev --help
```

## Prerequisites

- **Node.js** >= 22
- **Linear API key** — from [Linear Settings > API](https://linear.app/settings/api)
- **Git**
- (Optional) OpenCode CLI, Claude Code CLI, or Codex CLI for agent execution

## Configuration

### Environment Variables (`.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LINEAR_API_KEY` | Yes | — | Linear API personal access key |
| `OPENAI_API_KEY` | No | — | API key for OpenCode/Codex agents |
| `ANTHROPIC_API_KEY` | No | — | API key for Claude Code agent |
| `DATABASE_URL` | No | `file:./loop-engineering.db` | SQLite database path |
| `LOG_LEVEL` | No | `info` | Log level: trace, debug, info, warn, error, fatal |
| `NODE_ENV` | No | `development` | Environment: development, production, test |
| `CONFIG_PATH` | No | `config/config.yaml` | Custom config file path |
| `CUSTOM_AGENT_COMMAND` | No | — | Command for custom agent provider |
| `CUSTOM_AGENT_ARGS` | No | — | Comma-separated args for custom agent |
| `EXECUTION_MAX_RETRIES` | No | `3` | Max test retry attempts |
| `EXECUTION_AUTO_COMMIT` | No | `true` | Auto-commit after coding |
| `EXECUTION_AUTO_PUSH` | No | `false` | Auto-push after commit |
| `EXECUTION_DRY_RUN` | No | `false` | Dry-run mode |
| `REVIEW_AUTO_APPROVE` | No | `false` | Auto-approve if tests pass |
| `REVIEW_CREATE_ISSUES` | No | `true` | Create issues for review findings |
| `WORKSPACE_DEFAULT_BRANCH` | No | `main` | Default Git branch |
| `WORKSPACE_BRANCH_PREFIX` | No | `ai/` | Branch name prefix |

### Config File (`config/config.yaml`)

```yaml
agents:
  opencode:
    enabled: true
    priority: 1
    capabilities:
      - full-stack
      - refactoring
      - architecture
  claude:
    enabled: true
    priority: 2
    capabilities:
      - frontend
      - react
      - design
      - architecture
  codex:
    enabled: true
    priority: 3
    capabilities:
      - simple-bug
      - quick-fix
      - documentation

execution:
  maxRetries: 3
  autoCommit: true
  autoPush: false
  dryRun: false
  parallel: false

review:
  autoApproveTestsPassing: false
  createIssuesForChanges: true

workspace:
  defaultBranch: main
  branchPrefix: ai/
```

## Commands

| Command | Description |
|---------|-------------|
| `ai-dev audit` | Analyze Linear workspace — projects, milestones, issue counts |
| `ai-dev next` | Show next recommended issues by priority |
| `ai-dev execute <id>` | Execute a single issue (e.g. `ai-dev execute ENG-123`) |
| `ai-dev run` | Autonomous execution mode — continuously processes pending issues |
| `ai-dev project <name>` | Execute all pending issues in a project |
| `ai-dev milestone <name>` | Execute all pending issues in a milestone |
| `ai-dev agents` | Show available AI coding agents and their status |
| `ai-dev history` | Show execution history with filtering |
| `ai-dev plan` | Show dry-run execution roadmap without running agents |

### Command Options

**`execute`**
- `--dry-run` — Plan but do not execute
- `--agent <name>` — Override agent selection

**`run`**
- `--dry-run` — Discover issues but don't execute
- `--limit <n>` — Maximum number of issues to process

**`next`**
- `--count <n>` — Number of issues to show (default: 5)

**`history`**
- `--limit <n>` — Number of records (default: 20)
- `--issue <id>` — Filter by issue ID

**`plan`**
- `--project <name>` — Plan by project
- `--milestone <name>` — Plan by milestone
- `--limit <n>` — Max issues to show (default: 10)

**`milestone`**
- `--project <name>` — Project containing the milestone
- `--dry-run` — Plan only, do not execute

**`project`**
- `--dry-run` — Plan only, do not execute

**Global**
- `--config <path>` — Path to config file
- `--verbose` — Enable verbose logging

## Architecture

Clean Architecture with 4 layers, dependencies point inward toward the domain:

```
┌────────────────────────────────────────┐
│  CLI (Commander)                       │
├────────────────────────────────────────┤
│  Application (Use Cases / Services)    │
├────────────────────────────────────────┤
│  Domain (Entities / Interfaces)        │
├────────────────────────────────────────┤
│  Infrastructure (SDKs, Git, DB, Log)   │
└────────────────────────────────────────┘
```

1. **Domain** (`src/domain/`) — Entities (Issue, Project, ExecutionPlan...), Value Objects (IssueStatus, Priority, Complexity, AgentCapability), Interfaces (ports). No external dependencies.
2. **Application** (`src/application/`) — Use Cases (ExecuteIssue, RunProject, AuditWorkspace...) and Services (PlannerServiceImpl, AgentRouter, WorkflowEngine, ReviewServiceImpl, ContextBuilderImpl). Orchestration logic only.
3. **Infrastructure** (`src/infrastructure/`) — Linear SDK, Git via execa, AI agent CLI wrappers, SQLite via Prisma, Pino logging, YAML config loading. Implements domain interfaces.
4. **CLI** (`src/cli/`) — Commander-based CLI with 9 subcommands.

Dependency Injection via tsyringe — all interfaces use Symbol tokens for registration.

## Workflow

```
Linear Issue → Planning Agent → Context Builder → Agent Router
                    ↓
              Coding Agent (OpenCode/Claude/Codex/Custom)
                    ↓
              Test Runner (retry on failure)
                    ↓
              Code Reviewer (security, tests, patterns)
                    ↓
              Linear Status Update (comments + state transition)
```

### State Machine

```
CREATED → ANALYZING → PLANNING → CODING → TESTING → REVIEWING → COMPLETED
                                                      ↓
                                                   FAILED → RETRY → CODING
```

## Agent Providers

| Provider | Name | Capabilities | Description |
|----------|------|--------------|-------------|
| **OpenCode** | `opencode` | full-stack, refactoring, architecture, backend, testing | Full-stack development, large refactors, architecture changes |
| **Claude Code** | `claude` | frontend, react, design, architecture, full-stack | Frontend, React, UI components, visual design |
| **Codex** | `codex` | simple-bug, quick-fix, documentation, backend, testing | Simple bugs, quick fixes, documentation |
| **Custom** | `custom` | configurable | Configurable via `CUSTOM_AGENT_COMMAND` env var |

### Agent Selection Algorithm

1. Parse issue title + description for keyword classification (bug/fix, refactor/architecture, frontend/UI)
2. Score each enabled agent: base priority + keyword match bonus (+30) + capability relevance (+5 each)
3. Select the highest-scoring agent
4. Complexity-based override: HIGH/VERY_HIGH complexity defaults to OpenCode

## Project Structure

```
loop-engineering/
├── config/
│   └── config.yaml              # Agent, execution, review, workspace config
├── prisma/
│   └── schema.prisma            # SQLite schema (ExecutionRecord, ExecutionRetry, AgentConfig)
├── src/
│   ├── domain/
│   │   ├── entities/            # Issue, Project, Milestone, AgentTask, ExecutionPlan, etc.
│   │   ├── interfaces/          # Port definitions (IssueRepository, CodingAgentProvider, etc.)
│   │   └── value-objects/       # IssueStatus, Priority, Complexity, AgentCapability
│   ├── application/
│   │   ├── usecases/            # ExecuteIssue, SelectNextIssue, RunProject, RunMilestone, AuditWorkspace
│   │   └── services/            # PlannerService, AgentRouter, ContextBuilder, ReviewService, WorkflowEngine
│   ├── infrastructure/
│   │   ├── agents/              # AgentRegistry + OpenCode/Claude/Codex/Custom providers
│   │   ├── config/              # ConfigLoader (YAML + env var merging)
│   │   ├── git/                 # GitManager (branch, commit, push via execa)
│   │   ├── linear/              # LinearClient, LinearIssueRepository, LinearService
│   │   ├── logging/             # PinoLogger
│   │   ├── persistence/         # SQLiteExecutionStore (Prisma)
│   │   └── testing/             # TestExecutor (npm test via execa)
│   ├── cli/
│   │   ├── index.ts             # Commander entry point
│   │   └── commands/            # 9 subcommand files
│   └── config/
│       ├── container.ts         # tsyringe DI container setup
│       └── env.ts               # Zod-based env validation
├── tests/
│   ├── unit/                    # Unit tests (domain + services)
│   └── integration/             # Integration tests
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Database Schema

Three SQLite tables managed via Prisma:

- **ExecutionRecord** — One row per issue execution (issueId, agentUsed, status, duration, tokenUsage, result, error, branch, commit, timestamps)
- **ExecutionRetry** — Tracks retry attempts per execution record (attempt number, status, error)
- **AgentConfig** — Persisted agent configuration (name, enabled, priority, capabilities as JSON)

## Development

```bash
npm run dev          # Watch mode (tsx --watch)
npm test             # Run tests (vitest)
npm run test:watch   # Watch tests
npm run test:coverage # Test coverage
npm run typecheck    # TypeScript type checking (tsc --noEmit)
npm run lint         # ESLint
npm run lint:fix     # Auto-fix lint issues
npm run format       # Prettier format
npm run format:check # Check formatting
npm run build        # TypeScript compilation
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run Prisma migrations
npm run db:push      # Push schema without migrations
npm run db:studio    # Open Prisma Studio GUI
```

## Docker

```bash
# Build image
docker build -t loop-engineering .

# Run commands
docker compose run --rm ai-dev audit
docker compose run --rm ai-dev run --dry-run
docker compose run --rm ai-dev execute ENG-123 --dry-run
```

## Tech Stack

| Category | Technology |
|----------|------------|
| Runtime | Node.js 22+ (ESM) |
| Language | TypeScript 5.5+ (strict mode) |
| CLI | Commander.js |
| DI | tsyringe |
| Validation | Zod |
| Database | SQLite via Prisma |
| Logging | Pino + pino-pretty |
| Config | YAML (yaml package) |
| Git | execa |
| Testing | Vitest |
| Linting | ESLint + typescript-eslint |
| Formatting | Prettier |
| Linear SDK | @linear/sdk v25 |

## License

MIT
