import { TestResult } from '../entities/TestResult.js';

export interface TestRunner {
  runAll(): Promise<TestResult>;
  runLint(): Promise<TestResult>;
  runBuild(): Promise<TestResult>;
  runTests(testPattern?: string): Promise<TestResult>;
  getCoverageReport(): Promise<string | null>;
}

export const TEST_RUNNER = Symbol('TestRunner');
