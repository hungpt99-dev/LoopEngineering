import { execa } from 'execa';
import { inject, injectable } from 'tsyringe';
import { TestResult } from '../../domain/entities/TestResult.js';
import type { Logger } from '../../domain/interfaces/Logger.js';
import { LOGGER } from '../../domain/interfaces/Logger.js';
import type { TestRunner } from '../../domain/interfaces/TestRunner.js';

@injectable()
export class TestExecutor implements TestRunner {
  constructor(@inject(LOGGER) private readonly logger: Logger) {}

  async runAll(): Promise<TestResult> {
    return this.executeTest('npm', ['test'], 'all tests');
  }

  async runLint(): Promise<TestResult> {
    return this.executeTest('npm', ['run', 'lint'], 'lint');
  }

  async runBuild(): Promise<TestResult> {
    return this.executeTest('npm', ['run', 'build'], 'build');
  }

  async runTests(testPattern?: string): Promise<TestResult> {
    const args = ['test'];
    if (testPattern) {
      args.push('--', '-t', testPattern);
    }
    return this.executeTest(
      'npm',
      args,
      testPattern ? `tests matching "${testPattern}"` : 'specific tests',
    );
  }

  async getCoverageReport(): Promise<string | null> {
    try {
      this.logger.info('Running test coverage');
      const start = performance.now();
      const result = await execa('npm', ['run', 'test:coverage'], {
        timeout: 120_000,
        reject: false,
      });
      const duration = performance.now() - start;

      this.logger.info(`Coverage run completed in ${duration.toFixed(0)}ms`);

      return result.stdout + result.stderr;
    } catch (error) {
      this.logger.error('Failed to get coverage report', error as Error);
      return null;
    }
  }

  private async executeTest(
    command: string,
    args: string[],
    label: string,
    timeout = 120_000,
  ): Promise<TestResult> {
    const start = performance.now();

    try {
      this.logger.info(`Running ${label}`);

      const result = await execa(command, args, {
        timeout,
        reject: false,
      });

      const duration = performance.now() - start;
      const output = result.stdout + result.stderr;

      const testCounts = this.parseTestCounts(output);

      if (result.exitCode === 0) {
        this.logger.info(`${label} passed (${duration.toFixed(0)}ms)`);
        return TestResult.create({
          success: true,
          totalTests: testCounts.totalTests,
          passedTests: testCounts.passedTests,
          failedTests: testCounts.failedTests,
          skippedTests: testCounts.skippedTests,
          duration,
          output,
          errors: [],
        });
      }

      const errors = this.parseErrors(output);
      this.logger.warn(`${label} failed with ${errors.length} error(s)`);

      return TestResult.create({
        success: false,
        totalTests: testCounts.totalTests,
        passedTests: testCounts.passedTests,
        failedTests: testCounts.failedTests || errors.length,
        skippedTests: testCounts.skippedTests,
        duration,
        output,
        errors,
      });
    } catch (error) {
      const duration = performance.now() - start;
      const err = error as Error & { stdout?: string; stderr?: string };
      const msg = err.stderr || err.stdout || err.message || 'Unknown error';

      this.logger.error(`${label} execution error`, error as Error);

      return TestResult.failure([msg], msg, duration);
    }
  }

  private parseTestCounts(output: string): {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
  } {
    const patterns = [
      /Tests\s+(\d+)\s+passed\s*,\s*(\d+)\s+failed\s*,\s*(\d+)\s+skipped/,
      /(\d+)\s+passed\s*,\s*(\d+)\s+failed\s*,\s*(\d+)\s+skipped/,
      /Tests\s+(\d+)\s+passed\s*,\s*(\d+)\s+total/,
      /(\d+)\s+tests?\s+passed/i,
    ];

    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match) {
        if (match.length === 4) {
          return {
            totalTests:
              parseInt(match[1]!, 10) +
              parseInt(match[2]!, 10) +
              (match[3] ? parseInt(match[3], 10) : 0),
            passedTests: parseInt(match[1]!, 10),
            failedTests: parseInt(match[2]!, 10),
            skippedTests: match[3] ? parseInt(match[3], 10) : 0,
          };
        }
        if (match.length === 3) {
          return {
            totalTests: parseInt(match[2]!, 10),
            passedTests: parseInt(match[1]!, 10),
            failedTests: parseInt(match[2]!, 10) - parseInt(match[1]!, 10),
            skippedTests: 0,
          };
        }
        return {
          totalTests: parseInt(match[1]!, 10),
          passedTests: parseInt(match[1]!, 10),
          failedTests: 0,
          skippedTests: 0,
        };
      }
    }

    return { totalTests: 0, passedTests: 0, failedTests: 0, skippedTests: 0 };
  }

  private parseErrors(output: string): string[] {
    const errors: string[] = [];
    const ansiPattern = new RegExp('\u001b' + String.raw`\[[\d;]*m`, 'g');
    const stripped = output.replace(ansiPattern, '');
    const lines = stripped.split('\n');

    for (let i = 0; i < lines.length && errors.length < 50; i++) {
      const line = lines[i]!;
      if (
        line.includes('FAIL') ||
        line.includes('Error:') ||
        line.includes('AssertionError:') ||
        line.includes('Expected') ||
        line.match(/^\s+[×✕]\s+/)
      ) {
        errors.push(line.trim().slice(0, 200));
      }
    }

    if (errors.length === 0 && stripped.trim()) {
      const head = stripped.trim().split('\n').slice(0, 5).join('\n');
      errors.push(head.slice(0, 500));
    }

    return errors;
  }
}
