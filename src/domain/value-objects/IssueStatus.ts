export enum IssueStatus {
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

export enum Priority {
  URGENT = 1,
  HIGH = 2,
  MEDIUM = 3,
  LOW = 4,
  NONE = 0,
}

export enum Complexity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high',
}

export enum AgentCapability {
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
