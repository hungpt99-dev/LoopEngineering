# API Reference

## Domain Entities

### `Issue`

Path: `src/domain/entities/Issue.ts`

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Linear issue ID (e.g. "ENG-123") |
| `title` | `string` | Issue title |
| `description` | `string` | Issue description (markdown) |
| `status` | `IssueStatus` | Current status (CREATED → COMPLETED) |
| `priority` | `Priority` | Priority level (0-4) |
| `projectId` | `string?` | Parent project ID |
| `projectName` | `string?` | Parent project name |
| `milestoneId` | `string?` | Milestone ID |
| `milestoneName` | `string?` | Milestone name |
| `assigneeId` | `string?` | Assigned user ID |
| `labelIds` | `string[]` | Label identifiers |
| `parentId` | `string?` | Parent issue ID (for sub-issues) |
| `blockedByIssues` | `string[]` | Issue IDs that block this one |
| `blockingIssues` | `string[]` | Issue IDs this one blocks |
| `estimate` | `number?` | Point estimate |
| `dueDate` | `Date?` | Due date |
| `createdAt` | `Date` | Creation timestamp |
| `updatedAt` | `Date` | Last update timestamp |
| `branchName` | `string?` | Associated git branch |

**Computed Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `isBlocked` | `boolean` | `true` if `blockedByIssues.length > 0` |
| `isInProgress` | `boolean` | `true` if status is ANALYZING through RETRY |
| `isCompleted` | `boolean` | `true` if status is COMPLETED |

**Static Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `create(props: IssueProps)` | `Issue` | Creates and validates an Issue via Zod |

**Instance Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `canTransitionTo(newStatus: IssueStatus)` | `boolean` | Validates if the state transition is allowed |
| `withStatus(status: IssueStatus)` | `Issue` | Returns a new Issue with the given status (immutable) |
| `withBranchName(branchName: string)` | `Issue` | Returns a new Issue with the given branch name (immutable) |
| `toJSON()` | `IssueProps` | Serializes to plain object |

---

### `Project`

Path: `src/domain/entities/Project.ts`

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Project ID |
| `name` | `string` | Project name |
| `description` | `string` | Project description |
| `state` | `string` | Project state |
| `progress` | `number` | Progress 0.0–1.0 |
| `startDate` | `Date?` | Start date |
| `targetDate` | `Date?` | Target completion date |
| `teamId` | `string` | Owning team ID |
| `milestoneIds` | `string[]` | Associated milestone IDs |

**Static Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `create(props: ProjectProps)` | `Project` | Creates and validates a Project via Zod |

---

### `Milestone`

Path: `src/domain/entities/Milestone.ts`

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Milestone ID |
| `name` | `string` | Milestone name |
| `description` | `string` | Milestone description |
| `projectId` | `string` | Parent project ID |
| `targetDate` | `Date?` | Target date |
| `progress` | `number` | Progress 0.0–1.0 |

**Static Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `create(props: MilestoneProps)` | `Milestone` | Creates and validates a Milestone via Zod |

---

### `AgentTask`

Path: `src/domain/entities/AgentTask.ts`

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Task unique ID (UUID) |
| `issueId` | `string` | Source issue ID |
| `issueTitle` | `string` | Issue title |
| `issueDescription` | `string` | Issue description |
| `projectContext` | `string?` | Formatted project context |
| `milestoneContext` | `string?` | Formatted milestone context |
| `dependencies` | `string[]` | Dependencies (issue refs, file paths, component names) |
| `filesToInspect` | `string[]` | Files relevant to the task |
| `implementationSteps` | `string[]` | Ordered implementation steps |
| `complexity` | `Complexity` | LOW / MEDIUM / HIGH / VERY_HIGH |
| `branchName` | `string` | Git branch for the task |
| `environment` | `Record<string, string>` | Environment variables for agent execution |

**Computed Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `fullContext` | `string` | Assembled markdown prompt: project context + milestone context + issue details + implementation plan + files to inspect + dependencies |

---

### `ExecutionPlan`

Path: `src/domain/entities/ExecutionPlan.ts`

| Property | Type | Description |
|----------|------|-------------|
| `issueId` | `string` | Source issue ID |
| `issueTitle` | `string` | Issue title |
| `complexity` | `Complexity` | Estimated complexity |
| `recommendedAgent` | `string` | Recommended agent name (opencode/claude/codex) |
| `confidence` | `number` | Confidence score 0.0–1.0 |
| `implementationSteps` | `string[]` | Ordered implementation steps |
| `filesToInspect` | `string[]` | Files relevant to the implementation |
| `risks` | `string[]` | Identified risks |
| `dependencies` | `string[]` | Extracted dependencies |
| `estimatedDuration` | `number` | Estimated duration in minutes |
| `requiresArchitectureReview` | `boolean` | Whether architecture review is recommended |

---

### `AgentExecutionResult`

Path: `src/domain/entities/AgentExecutionResult.ts`

| Property | Type | Description |
|----------|------|-------------|
| `taskId` | `string` | Source task ID |
| `agentName` | `string` | Agent that executed the task |
| `success` | `boolean` | Whether execution succeeded |
| `output` | `string` | Agent stdout |
| `error` | `string?` | Error message (on failure) |
| `filesChanged` | `string[]` | List of files modified |
| `commitSha` | `string?` | Git commit SHA |
| `duration` | `number` | Execution time in ms |
| `tokenUsage` | `number?` | Token count used |

---

### `TestResult`

Path: `src/domain/entities/TestResult.ts`

| Property | Type | Description |
|----------|------|-------------|
| `success` | `boolean` | Whether all tests passed |
| `totalTests` | `number` | Total test count |
| `passedTests` | `number` | Passed test count |
| `failedTests` | `number` | Failed test count |
| `skippedTests` | `number` | Skipped test count |
| `duration` | `number` | Execution time in ms |
| `output` | `string` | Raw test output |
| `errors` | `string[]` | Extracted error messages |
| `coverage` | `number?` | Code coverage percentage |

**Computed Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `formattedSummary` | `string` | Human-readable test summary with optional coverage |

**Static Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `create(props: TestResultProps)` | `TestResult` | Creates from full props |
| `success(output, duration)` | `TestResult` | Convenience factory for passing tests |
| `failure(errors, output, duration)` | `TestResult` | Convenience factory for failing tests |

---

### `ReviewResult`

Path: `src/domain/entities/ReviewResult.ts`

| Property | Type | Description |
|----------|------|-------------|
| `decision` | `ReviewDecision` | `APPROVED` or `REQUEST_CHANGES` |
| `summary` | `string` | Review summary |
| `issues` | `ReviewIssue[]` | Identified issues |
| `suggestions` | `string[]` | Fix suggestions |
| `score` | `number` | Overall score (0-100) |

**Computed Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `isApproved` | `boolean` | `true` if decision is APPROVED |
| `criticalIssues` | `ReviewIssue[]` | Filtered to severity = 'critical' |

**Static Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `create(props: ReviewResultProps)` | `ReviewResult` | Creates from full props |
| `approved(summary, score)` | `ReviewResult` | Convenience factory for approval |
| `requestChanges(issues, suggestions, score)` | `ReviewResult` | Convenience factory for changes requested |

#### `ReviewIssue`

| Field | Type | Description |
|-------|------|-------------|
| `severity` | `'critical' \| 'major' \| 'minor' \| 'info'` | Issue severity |
| `category` | `'correctness' \| 'architecture' \| 'security' \| 'performance' \| 'maintainability' \| 'tests'` | Issue category |
| `description` | `string` | Issue description |
| `file` | `string?` | Affected file path |
| `line` | `number?` | Affected line number |
| `suggestion` | `string?` | Fix suggestion |

---

### `ExecutionHistory`

Path: `src/domain/entities/ExecutionHistory.ts`

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Record ID |
| `issueId` | `string` | Issue ID |
| `issueTitle` | `string` | Issue title |
| `projectId` | `string?` | Project ID |
| `milestoneId` | `string?` | Milestone ID |
| `agentUsed` | `string` | Agent name used |
| `status` | `IssueStatus` | Final status |
| `duration` | `number?` | Total duration in ms |
| `tokenUsage` | `number?` | Token count used |
| `result` | `string?` | Result summary |
| `error` | `string?` | Error message |
| `branch` | `string?` | Git branch name |
| `commit` | `string?` | Git commit SHA |
| `createdAt` | `Date` | Creation timestamp |
| `updatedAt` | `Date` | Last update timestamp |
| `retries` | `ExecutionRetryProps[]` | Retry attempt records |

#### `ExecutionRetryProps`

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Retry record ID |
| `attempt` | `number` | Attempt number (1-based) |
| `status` | `string` | Outcome: 'passed' or 'failed' |
| `duration` | `number?` | Attempt duration in ms |
| `error` | `string?` | Error message |
| `createdAt` | `Date` | Attempt timestamp |

---

## Value Objects

### `IssueStatus`

Path: `src/domain/value-objects/IssueStatus.ts`

```typescript
enum IssueStatus {
  CREATED = 'CREATED',
  ANALYZING = 'ANALYZING',
  PLANNING = 'PLANNING',
  CODING = 'CODING',
  TESTING = 'TESTING',
  REVIEWING = 'REVIEWING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  RETRY = 'RETRY',
}
```

### `Priority`

```typescript
enum Priority {
  URGENT = 1,
  HIGH = 2,
  MEDIUM = 3,
  LOW = 4,
  NONE = 0,
}
```

### `Complexity`

```typescript
enum Complexity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high',
}
```

### `AgentCapability`

```typescript
enum AgentCapability {
  FULL_STACK = 'full-stack',
  FRONTEND = 'frontend',
  BACKEND = 'backend',
  REACT = 'react',
  REFACTORING = 'refactoring',
  ARCHITECTURE = 'architecture',
  DESIGN = 'design',
  SIMPLE_BUG = 'simple-bug',
  QUICK_FIX = 'quick-fix',
  DOCUMENTATION = 'documentation',
  TESTING = 'testing',
}
```

---

## Domain Interfaces

### `IssueRepository`

Path: `src/domain/interfaces/IssueRepository.ts`
Token: `ISSUE_REPOSITORY`

```typescript
interface IssueRepository {
  findNextIssue(): Promise<Issue | null>;
  findById(id: string): Promise<Issue | null>;
  findByProjectId(projectId: string): Promise<Issue[]>;
  findByMilestoneId(milestoneId: string): Promise<Issue[]>;
  findAll(assigneeId?: string): Promise<Issue[]>;
  updateStatus(issueId: string, status: string): Promise<void>;
  addComment(issueId: string, body: string): Promise<void>;
  createIssue(input: CreateIssueInput): Promise<Issue>;
  findProjectByName(name: string): Promise<Project | null>;
  findProjectById(id: string): Promise<Project | null>;
  findAllProjects(): Promise<Project[]>;
  findMilestoneByName(projectId: string, name: string): Promise<Milestone | null>;
  findMilestoneById(projectId: string, id: string): Promise<Milestone | null>;
  findAllMilestones(projectId: string): Promise<Milestone[]>;
  createBlocker(issueId: string, blockerId: string): Promise<void>;
}

interface CreateIssueInput {
  title: string;
  description: string;
  teamId: string;
  projectId?: string;
  milestoneId?: string;
  priority?: number;
  assigneeId?: string;
  parentId?: string;
}
```

**`findNextIssue()`** — Finds the highest-priority unassigned, unblocked, non-completed issue. Used by the autonomous loop.

**`updateStatus(issueId, status)`** — Maps internal `IssueStatus` string to Linear workflow state by name. Logs a warning if state is not found for the team.

**`addComment(issueId, body)`** — Posts a markdown comment to the Linear issue. Used for progress updates at each pipeline stage.

**`createIssue(input)`** — Creates a new Linear issue. Supports optional project, milestone, priority, assignee, and parent.

---

### `CodingAgentProvider`

Path: `src/domain/interfaces/CodingAgentProvider.ts`
Token: `CODING_AGENT_PROVIDER`

```typescript
interface CodingAgentProvider {
  readonly name: string;
  readonly capabilities: string[];

  execute(task: AgentTask): Promise<AgentExecutionResult>;
  isAvailable(): Promise<boolean>;
  validateEnvironment(): Promise<string[]>;
}
```

**`execute(task)`** — Runs the AI agent with the task's full context as a prompt. Must handle timeouts and return results on failure instead of throwing.

**`isAvailable()`** — Checks if the agent CLI is installed (e.g., `which opencode`).

**`validateEnvironment()`** — Returns a list of environment issues (missing API keys, CLI version mismatch).

**Multi-registration**: Multiple providers are registered under the same `CODING_AGENT_PROVIDER` token. `AgentRegistry` collects all via `@injectAll`.

---

### `GitRepository`

Path: `src/domain/interfaces/GitRepository.ts`
Token: `GIT_REPOSITORY`

```typescript
interface GitRepository {
  createBranch(branchName: string): Promise<void>;
  checkoutBranch(branchName: string): Promise<void>;
  stageAll(): Promise<void>;
  commit(message: string): Promise<string>;
  push(): Promise<void>;
  getCurrentBranch(): Promise<string>;
  hasUncommittedChanges(): Promise<boolean>;
  getChangedFiles(): Promise<string[]>;
  getLatestCommitSha(): Promise<string>;
  revertToClean(): Promise<void>;
  deleteBranch(branchName: string): Promise<void>;
  branchExists(branchName: string): Promise<boolean>;
  mergeToDefaultBranch(branchName: string): Promise<void>;
}
```

**`commit(message)`** — Returns the new commit SHA.

**`push()`** — Respects `AppConfig.execution.autoPush` — skips if disabled.

**`getChangedFiles()`** — Returns files changed vs HEAD via `git diff --name-only`.

---

### `TestRunner`

Path: `src/domain/interfaces/TestRunner.ts`
Token: `TEST_RUNNER`

```typescript
interface TestRunner {
  runAll(): Promise<TestResult>;
  runLint(): Promise<TestResult>;
  runBuild(): Promise<TestResult>;
  runTests(testPattern?: string): Promise<TestResult>;
  getCoverageReport(): Promise<string | null>;
}
```

**`runAll()`** — Runs `npm test` with 120s timeout, parses output for test counts.

**`runLint()`** — Runs `npm run lint`.

**`runBuild()`** — Runs `npm run build`.

**`getCoverageReport()`** — Runs `npm run test:coverage`, returns combined stdout+stderr.

---

### `PlannerService`

Path: `src/domain/interfaces/PlannerService.ts`
Token: `PLANNER_SERVICE`

```typescript
interface PlannerService {
  analyzeIssue(issue: Issue): Promise<ExecutionPlan>;
  selectAgent(
    issue: Issue,
    plan: ExecutionPlan,
    availableAgents: AgentInfo[],
  ): Promise<string>;
  planImplementation(issue: Issue): Promise<string[]>;
  estimateComplexity(issue: Issue): Promise<Complexity>;
}

interface AgentInfo {
  name: string;
  capabilities: string[];
  enabled: boolean;
  priority: number;
}
```

**`analyzeIssue(issue)`** — Full analysis pipeline: estimates complexity, extracts implementation steps, detects dependencies, identifies files, assesses risks, recommends agent, calculates duration and confidence. Returns a complete `ExecutionPlan`.

**`selectAgent(issue, plan, availableAgents)`** — Scores each enabled agent based on keyword matching and capability relevance. Returns the name of the best-scoring agent. Throws if no agents are enabled.

**`planImplementation(issue)`** — Extracts implementation steps from issue description using structured step detection (numbered/bulleted lists) or sentence splitting as fallback.

**`estimateComplexity(issue)`** — Returns `Complexity` enum based on scoring algorithm: description length, point estimate, label count, blocker count, parent status, keyword matching.

---

### `ContextBuilder`

Path: `src/domain/interfaces/ContextBuilder.ts`
Token: `CONTEXT_BUILDER`

```typescript
interface ContextBuilder {
  buildIssueContext(issue: Issue): Promise<string>;
  buildProjectContext(projectId: string): Promise<string>;
  buildMilestoneContext(projectId: string, milestoneId: string): Promise<string>;
  buildFullContext(issue: Issue, plan: ExecutionPlan): Promise<string>;
  detectDependencies(issue: Issue): Promise<string[]>;
  identifyFiles(issue: Issue): Promise<string[]>;
}
```

**`buildIssueContext(issue)`** — Formats issue metadata: status, priority, estimate, project, milestone, labels, parent issue, blockers, blocking issues, related project issues (up to 10).

**`buildProjectContext(projectId)`** — Formats project metadata: state, progress, description, dates, milestones with progress, issue stats (total/completed/remaining).

**`buildMilestoneContext(projectId, milestoneId)`** — Formats milestone metadata: progress, description, target date, issue list with statuses.

**`buildFullContext(issue, plan)`** — Combines issue context + project context + milestone context + implementation plan details (complexity, duration, agent, steps, files, deps, risks). This is the full prompt passed to the AI agent.

**`detectDependencies(issue)`** — Extracts references from issue text: Linear issue IDs (KEY-123 pattern), file paths, and component class names (Service, Provider, Repository, etc.).

**`identifyFiles(issue)`** — Returns up to 30 relevant file patterns by matching file paths in text, extension/keyword patterns, and keyword-to-path mappings.

---

### `ReviewerService`

Path: `src/domain/interfaces/ReviewerService.ts`
Token: `REVIEWER_SERVICE`

```typescript
interface ReviewerService {
  reviewChanges(
    issueId: string,
    issueTitle: string,
    filesChanged: string[],
    testResult: string,
  ): Promise<ReviewResult>;
  suggestFixes(issues: ReviewIssue[]): Promise<string[]>;
}
```

**`reviewChanges(issueId, issueTitle, filesChanged, testResult)`** — Runs four-phase review: security, anti-patterns, test coverage, requirements. Returns `APPROVED` if no issues found, otherwise `REQUEST_CHANGES` with issue details.

**`suggestFixes(issues)`** — Generates categorized fix suggestions: `[SECURITY]`, `[CORRECTNESS]`, `[ARCHITECTURE]`, `[PERFORMANCE]`, `[MAINTAINABILITY]`, `[TESTS]`.

---

### `ExecutionStore`

Path: `src/domain/interfaces/ExecutionStore.ts`
Token: `EXECUTION_STORE`

```typescript
interface ExecutionStore {
  save(record: Omit<ExecutionHistory, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExecutionHistory>;
  findById(id: string): Promise<ExecutionHistory | null>;
  findByIssueId(issueId: string): Promise<ExecutionHistory[]>;
  findByStatus(status: string): Promise<ExecutionHistory[]>;
  findAll(limit?: number): Promise<ExecutionHistory[]>;
  update(id: string, data: Partial<ExecutionHistory>): Promise<ExecutionHistory>;
  addRetry(
    recordId: string,
    retry: { attempt: number; status: string; error?: string; duration?: number },
  ): Promise<void>;
}
```

**`save(record)`** — Creates a new execution record. Returns the saved `ExecutionHistory` with generated id and timestamps.

**`findAll(limit)`** — Returns most recent records, ordered by `createdAt` descending, default limit 50.

**`update(id, data)`** — Partial update — only provided fields are changed.

**`addRetry(recordId, retry)`** — Appends a retry attempt to an execution record.

---

### `AppConfig`

Path: `src/domain/interfaces/AppConfig.ts`
Token: `APP_CONFIG`

```typescript
interface AppConfig {
  agents: Record<string, {
    enabled: boolean;
    priority: number;
    capabilities: string[];
  }>;
  execution: {
    maxRetries: number;
    autoCommit: boolean;
    autoPush: boolean;
    dryRun: boolean;
    parallel: boolean;
  };
  review: {
    autoApproveTestsPassing: boolean;
    createIssuesForChanges: boolean;
  };
  workspace: {
    defaultBranch: string;
    branchPrefix: string;
  };
}
```

Loaded from `config/config.yaml` with env var overrides. Validated via Zod schema in `ConfigLoader`.

---

### `Logger`

Path: `src/domain/interfaces/Logger.ts`
Token: `LOGGER`

```typescript
interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}
```

**`child(bindings)`** — Creates a child logger with additional default context fields. Useful for scoping logs to specific issues or agents.

---

## Application Services

### `PlannerServiceImpl`

Path: `src/application/services/PlannerService.ts`

| Method | Description |
|--------|-------------|
| `analyzeIssue(issue: Issue)` | Full analysis: runs planImplementation, detectDependencies, identifyFiles, estimateComplexity, assessRisks, classifyRecommendedAgent, calculateDuration, computeConfidence |
| `selectAgent(issue, plan, agents)` | Scores agents: base priority + keyword match bonus (+30) + capability relevance (+5 each). Returns agent name. |
| `planImplementation(issue)` | Extracts steps from description: numbered lists > bullet lists > sentence splitting > fallback |
| `estimateComplexity(issue)` | Score-based: desc length (0-4) + estimate (0-3) + labels (0-3) + blockers (×2) + parent (+1) + keywords (+2 each). Thresholds: ≤2=LOW, ≤5=MEDIUM, ≤8=HIGH, >8=VERY_HIGH |

**Private methods:**

| Method | Description |
|--------|-------------|
| `classifyRecommendedAgent(issue, complexity)` | Bug → codex, React → claude, Refactor → opencode, HIGH/VH → opencode, default → opencode |
| `assessRisks(issue, complexity)` | Checks: blockers, dependents, complexity, deadline (<2 days), sub-issue propagation, breaking changes, DB changes, API changes, auth changes |
| `calculateDuration(complexity, estimate, steps)` | Base: LOW=15m, MEDIUM=45m, HIGH=90m, VH=180m + estimate × 15m + steps × 5m |
| `computeConfidence(issue, deps, steps)` | Base 0.8, adjusts for description quality (-0.2 if <50 chars, +0.1 if >500), deps (-0.05 each), steps >5 (-0.1), blockers (-0.1). Clamped 0.1-1.0 |

---

### `AgentRouter`

Path: `src/application/services/AgentRouter.ts`

| Method | Description |
|--------|-------------|
| `route(issue, plan, agents)` | Classifies issue by keyword patterns, scores agents, returns best match. Pattern matching: BUG_FIX → codex, REFACTOR → opencode, FRONTEND → claude. Falls back to plan recommendation. |
| `describeAgent(agent)` | Returns human-readable agent description with capabilities, priority, and enabled status |

**Scoring:**
1. Start with `agent.priority` as base
2. +50 if agent name matches preferred agent from classification
3. +20 if agent capabilities match description patterns
4. Select highest scorer

---

### `ContextBuilderImpl`

Path: `src/application/services/ContextBuilder.ts`

| Method | Description |
|--------|-------------|
| `buildIssueContext(issue)` | Metadata + parent issue resolution + blocker/blocking relations (via `findById`) + related project issues (up to 10) |
| `buildProjectContext(projectId)` | Project metadata + milestones with progress + issue completion stats |
| `buildMilestoneContext(projectId, milestoneId)` | Milestone metadata + issue list with statuses |
| `buildFullContext(issue, plan)` | Combines all contexts + plan details into full agent prompt |
| `detectDependencies(issue)` | Regex extraction: Linear issue refs (KEY-123), file paths, component class names (Service, Provider, Repository, etc.) |
| `identifyFiles(issue)` | Up to 30 files: path literals, extension patterns, keyword-to-path mappings, keyword-to-file patterns |

---

### `ReviewServiceImpl`

Path: `src/application/services/ReviewService.ts`

| Method | Description |
|--------|-------------|
| `reviewChanges(issueId, title, files, testResult)` | Four-phase review: security → anti-patterns → test coverage → requirements. Decision logic: security issues → REQUEST_CHANGES; failing tests → REQUEST_CHANGES; any issues → REQUEST_CHANGES; none → APPROVED |
| `suggestFixes(issues)` | Category-specific fix suggestions with formatted output |

**Review Phases:**

| Phase | Method | Checks |
|-------|--------|--------|
| Security | `checkSecurity()` | Config/env files changed, auth-sensitive file patterns, package.json/lock changes |
| Anti-patterns | `checkAntiPatterns()` | CSS modifications, entry point changes, ≥10 files (major), ≥20 files (critical) |
| Test coverage | `checkTestCoverage()` | Missing test files for source changes, failing tests, coverage <70% |
| Requirements | `checkRequirements()` | Zero files changed (critical), no test results (info) |

**Scoring:** 100 - Σ severityDeduction (critical: -30, major: -15, minor: -5, info: -1), minimum 0.

---

### `WorkflowEngine`

Path: `src/application/services/WorkflowEngine.ts`

| Method | Description |
|--------|-------------|
| `setExecutor(executor)` | Sets the `IssueExecutor` implementation (typically `ExecuteIssue`) |
| `runAutonomous()` | Main loop: polls `findNextIssue()`, delegates to executor, handles errors, continues until no more issues. Supports graceful stop. |
| `stop()` | Sets `running = false`, causing the loop to exit after current issue |
| `validateTransition(issueId, from, to)` | Checks if state transition is valid per `VALID_TRANSITIONS` |
| `advanceState(issueId, to)` | Updates issue status in Linear |
| `markFailed(issueId, error)` | Sets status to FAILED, posts error comment to Linear |

**State Transitions:**
```
CREATED → ANALYZING
ANALYZING → PLANNING | FAILED
PLANNING → CODING | FAILED
CODING → TESTING | FAILED
TESTING → REVIEWING | RETRY | FAILED
REVIEWING → COMPLETED | RETRY | FAILED
COMPLETED → (terminal)
FAILED → RETRY
RETRY → CODING
```

---

## CLI Commands

### `ai-dev audit`

Analyzes the Linear workspace.

```bash
ai-dev audit
```

Output:
- Project count, milestone count, total issues
- Issue breakdown: completed, in progress, blocked, failed
- Per-project progress bars

No options.

---

### `ai-dev next`

Shows the next recommended issues by priority.

```bash
ai-dev next [--count <n>]
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--count <n>` | `number` | `5` | Number of issues to preview |

Output: ordered list with issue ID, title, priority (color-coded), selection rationale.

---

### `ai-dev execute <issue-id>`

Executes a single Linear issue through the full pipeline.

```bash
ai-dev execute <issue-id> [--dry-run] [--agent <name>]
```

| Option | Type | Description |
|--------|------|-------------|
| `--dry-run` | `flag` | Plan only, no agent execution |
| `--agent <name>` | `string` | Override automatic agent selection |

Examples:
```bash
ai-dev execute ENG-123
ai-dev execute ENG-123 --dry-run
ai-dev execute ENG-123 --agent claude
```

Output on success: status, agent used, branch, commit (short SHA), token usage, duration.
Output on failure: status, error message, retry count.

---

### `ai-dev run`

Autonomous execution mode — continuously processes pending issues.

```bash
ai-dev run [--dry-run] [--limit <n>]
```

| Option | Type | Description |
|--------|------|-------------|
| `--dry-run` | `flag` | Discover issues but don't execute |
| `--limit <n>` | `number` | Max issues to process |

The engine polls `findNextIssue()` until no more eligible issues exist. Press Ctrl+C to stop gracefully.

Examples:
```bash
ai-dev run
ai-dev run --dry-run
ai-dev run --limit 5
```

---

### `ai-dev project <name>`

Executes all pending issues in a project.

```bash
ai-dev project <name> [--dry-run]
```

| Option | Type | Description |
|--------|------|-------------|
| `--dry-run` | `flag` | Plan only, no agent execution |

Examples:
```bash
ai-dev project "Mobile App Redesign"
ai-dev project "API v2" --dry-run
```

Output: completion summary with total processed, succeeded, failed counts, and total duration.

---

### `ai-dev milestone <name>`

Executes all pending issues in a milestone.

```bash
ai-dev milestone <name> [--project <projectName>] [--dry-run]
```

| Option | Type | Description |
|--------|------|-------------|
| `--project <name>` | `string` | Project containing the milestone (required if milestone name is not unique) |
| `--dry-run` | `flag` | Plan only, no agent execution |

If `--project` is omitted, the command searches all projects for the milestone.

Examples:
```bash
ai-dev milestone "Sprint 1"
ai-dev milestone "Sprint 1" --project "Backend API"
ai-dev milestone "Sprint 1" --dry-run
```

---

### `ai-dev agents`

Shows available AI coding agents with availability status.

```bash
ai-dev agents
```

No options.

Output per agent:
- Name (bold if available, dim if unavailable)
- Status: Available (green) or Unavailable (red)
- Capabilities list
- Environment issues (missing API keys, etc.)

---

### `ai-dev history`

Shows execution history in tabular format.

```bash
ai-dev history [--limit <n>] [--issue <id>]
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--limit <n>` | `number` | `20` | Number of records to show |
| `--issue <id>` | `string` | — | Filter by issue ID |

Output: table with columns: Time | Issue | Title | Status (color-coded) | Agent | Duration.
Footer shows record count and filter.

Examples:
```bash
ai-dev history
ai-dev history --limit 10
ai-dev history --issue ENG-123
```

---

### `ai-dev plan`

Shows a dry-run execution roadmap without running agents.

```bash
ai-dev plan [--project <name>] [--milestone <name>] [--limit <n>]
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--project <name>` | `string` | — | Plan by project name |
| `--milestone <name>` | `string` | — | Plan by milestone name |
| `--limit <n>` | `number` | `10` | Max issues to show |

With `--project`: shows project stats (total/completed/pending), then execution order with complexity and recommended agent per issue.

Without project/milestone: shows global pending issues with priority and selection rationale.

Examples:
```bash
ai-dev plan
ai-dev plan --project "API v2"
ai-dev plan --project "API v2" --limit 5
```

---

### Global Options

| Option | Description |
|--------|-------------|
| `--config <path>` | Path to config file (overrides `config/config.yaml`) |
| `--verbose` | Enable verbose logging (sets LOG_LEVEL to trace for this invocation) |
| `-V, --version` | Output version number |
| `-h, --help` | Display help for command |

---

## Agent Provider Implementations

### `OpenCodeProvider`

```typescript
class OpenCodeProvider implements CodingAgentProvider {
  readonly name = 'opencode';
  readonly capabilities = ['full-stack', 'refactoring', 'architecture', 'backend', 'testing'];

  execute(task: AgentTask): Promise<AgentExecutionResult>;
  isAvailable(): Promise<boolean>;       // Checks: which opencode
  validateEnvironment(): Promise<string[]>; // Checks: OPENAI_API_KEY, opencode --version
}
```

Execution: `opencode --task <prompt>` with 60-minute timeout in `process.cwd()`.

### `ClaudeCodeProvider`

```typescript
class ClaudeCodeProvider implements CodingAgentProvider {
  readonly name = 'claude';
  readonly capabilities = ['frontend', 'react', 'design', 'architecture', 'full-stack'];

  execute(task: AgentTask): Promise<AgentExecutionResult>;
  isAvailable(): Promise<boolean>;       // Checks: which claude
  validateEnvironment(): Promise<string[]>; // Checks: ANTHROPIC_API_KEY
}
```

Execution: `claude code --prompt <prompt>` with 60-minute timeout.

### `CodexProvider`

```typescript
class CodexProvider implements CodingAgentProvider {
  readonly name = 'codex';
  readonly capabilities = ['simple-bug', 'quick-fix', 'documentation', 'backend', 'testing'];

  execute(task: AgentTask): Promise<AgentExecutionResult>;
  isAvailable(): Promise<boolean>;       // Checks: which codex, falls back to which openai-codex
  validateEnvironment(): Promise<string[]>; // Checks: OPENAI_API_KEY
}
```

Execution: `codex --task <prompt>` with 60-minute timeout.

### `CustomProvider`

```typescript
class CustomProvider implements CodingAgentProvider {
  readonly name = 'custom';
  readonly capabilities = ['custom'];

  constructor(logger: Logger, options?: CustomProviderOptions);

  execute(task: AgentTask): Promise<AgentExecutionResult>;
  isAvailable(): Promise<boolean>;       // Checks: which <command>
  validateEnvironment(): Promise<string[]>; // Checks: CUSTOM_AGENT_COMMAND is set
}

interface CustomProviderOptions {
  command?: string;    // Falls back to CUSTOM_AGENT_COMMAND env var
  args?: string[];     // Falls back to CUSTOM_AGENT_ARGS env var (comma-separated)
}
```

Execution: `<command> [...args] <prompt>` with 60-minute timeout. Returns early error if command is not configured.

---

## Infrastructure Services

### `GitManager`

Path: `src/infrastructure/git/GitManager.ts`

All operations via `execa`. Branch names are sanitized (lowercase, alphanumeric + hyphens, max 100 chars). Config-driven: respects `autoPush` and `branchPrefix` from `AppConfig`.

### `TestExecutor`

Path: `src/infrastructure/testing/TestExecutor.ts`

- `runAll()` → `npm test`
- `runLint()` → `npm run lint`
- `runBuild()` → `npm run build`
- `runTests(pattern?)` → `npm test -- -t <pattern>`
- `getCoverageReport()` → `npm run test:coverage`

Test output parsing supports multiple regex patterns for test count extraction and error detection. Timeout: 120 seconds per run.

### `SQLiteExecutionStore`

Path: `src/infrastructure/persistence/SQLiteExecutionStore.ts`

Prisma-based implementation. Table: `ExecutionRecord` with related `ExecutionRetry` entries. Maps between Prisma model types and domain `ExecutionHistory` entity. Status values are validated against `IssueStatus` enum.

### `PinoLogger`

Path: `src/infrastructure/logging/PinoLogger.ts`

Pino-based. Pretty-prints in development (`pino-pretty`), pure JSON in production. Level from `LOG_LEVEL` env var (default: info).

### `ConfigLoader`

Path: `src/infrastructure/config/ConfigLoader.ts`

Loads YAML from `config/config.yaml` (or `CONFIG_PATH` env var), validates with Zod schemas, merges with `DEFAULT_CONFIG`, applies env var overrides for execution/review/workspace settings. Falls back to defaults on parse failure with console warning.

### `AgentRegistry`

Path: `src/infrastructure/agents/AgentRegistry.ts`

Collects all `CodingAgentProvider` instances via `@injectAll(CODING_AGENT_PROVIDER)`. Exposes lookup by name, list all, and availability-filtered list.

### `LinearClientFactory`

Path: `src/infrastructure/linear/LinearClient.ts`

Singleton factory for `@linear/sdk` LinearClient. Lazy-initialized with `LINEAR_API_KEY`. Token: `LINEAR_CLIENT_FACTORY`.

### `LinearService`

Path: `src/infrastructure/linear/LinearService.ts`

Higher-level Linear operations beyond raw repository access:
- `getWorkspace()` — first team's id, name, key
- `getIssuesByStatus(status)` — filter by Linear state name
- `getNextRecommendedIssue()` — unassigned, unblocked, non-completed, sorted by priority
- `createOrchestratorComment(issueId, message)` — timestamped, formatted comment
- `updateIssueWithExecutionResult(issueId, result)` — structured execution summary
- `getProjectSummary(projectName)` — project + issues + milestones + counts
- `getMilestoneProgress(milestoneName, projectName)` — milestone + issue counts + progress ratio

---

## Dependency Injection

All wiring happens in `src/config/container.ts` via tsyringe. Registration map:

| Token | Implementation | Lifetime |
|-------|---------------|----------|
| `LOGGER` | `PinoLogger` | Transient |
| `LINEAR_CLIENT_FACTORY` | `LinearClientFactory` | Singleton |
| `ISSUE_REPOSITORY` | `LinearIssueRepository` | Transient |
| `GIT_REPOSITORY` | `GitManager` | Transient |
| `TEST_RUNNER` | `TestExecutor` | Transient |
| `EXECUTION_STORE` | `SQLiteExecutionStore` | Transient |
| `PLANNER_SERVICE` | `PlannerServiceImpl` | Transient |
| `CONTEXT_BUILDER` | `ContextBuilderImpl` | Transient |
| `REVIEWER_SERVICE` | `ReviewServiceImpl` | Transient |
| `APP_CONFIG` | `ConfigLoader.load()` | Instance (resolved at startup) |
| `CODING_AGENT_PROVIDER` | `CustomProvider`, `ClaudeCodeProvider`, `CodexProvider`, `OpenCodeProvider` | Multi-registration |
| `AGENT_REGISTRY` | `AgentRegistry` | Transient |
| `ExecuteIssue` | `ExecuteIssue` | Transient |
| `SelectNextIssue` | `SelectNextIssue` | Transient |
| `RunProject` | `RunProject` | Transient |
| `RunMilestone` | `RunMilestone` | Transient |
| `AuditWorkspace` | `AuditWorkspace` | Transient |
| `WorkflowEngine` | `WorkflowEngine` | Transient |

**Container initialization order:**
1. Register all infrastructure implementations
2. Resolve `ConfigLoader`, register resolved config as `APP_CONFIG`
3. Register all agent providers under `CODING_AGENT_PROVIDER`
4. Register `AgentRegistry` (collects all `CODING_AGENT_PROVIDER` instances)
5. Register use cases and services
