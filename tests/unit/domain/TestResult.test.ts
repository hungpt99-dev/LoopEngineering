import { describe, it, expect } from 'vitest';
import { TestResult } from '../../../src/domain/entities/TestResult.js';

describe('TestResult', () => {
  describe('static factories', () => {
    describe('success', () => {
      it('should create a passing TestResult', () => {
        const result = TestResult.success('All tests passed', 1500);
        expect(result.success).toBe(true);
        expect(result.totalTests).toBe(0);
        expect(result.passedTests).toBe(0);
        expect(result.failedTests).toBe(0);
        expect(result.skippedTests).toBe(0);
        expect(result.duration).toBe(1500);
        expect(result.output).toBe('All tests passed');
        expect(result.errors).toEqual([]);
      });

      it('should have no errors for success', () => {
        const result = TestResult.success('OK', 100);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('failure', () => {
      it('should create a failing TestResult with errors', () => {
        const errors = ['Test auth failed', 'Expected true got false'];
        const result = TestResult.failure(errors, 'Tests failed', 2000);
        expect(result.success).toBe(false);
        expect(result.failedTests).toBe(2);
        expect(result.errors).toEqual(errors);
        expect(result.duration).toBe(2000);
        expect(result.output).toBe('Tests failed');
      });

      it('should set totalTests to 0 by default', () => {
        const result = TestResult.failure(['error'], 'fail', 100);
        expect(result.totalTests).toBe(0);
        expect(result.passedTests).toBe(0);
      });
    });

    describe('create', () => {
      it('should create a TestResult with full custom props', () => {
        const result = TestResult.create({
          success: true,
          totalTests: 42,
          passedTests: 40,
          failedTests: 1,
          skippedTests: 1,
          duration: 3000,
          output: '42 tests run',
          errors: [],
          coverage: 85.5,
        });
        expect(result.totalTests).toBe(42);
        expect(result.passedTests).toBe(40);
        expect(result.failedTests).toBe(1);
        expect(result.skippedTests).toBe(1);
        expect(result.coverage).toBe(85.5);
      });
    });
  });

  describe('formattedSummary', () => {
    it('should return success message when tests pass', () => {
      const result = TestResult.success('All tests passed', 1500);
      expect(result.formattedSummary).toBe('Tests passed');
    });

    it('should include coverage in success summary when available', () => {
      const result = TestResult.create({
        success: true,
        totalTests: 10,
        passedTests: 10,
        failedTests: 0,
        skippedTests: 0,
        duration: 500,
        output: 'passed',
        errors: [],
        coverage: 92.3,
      });
      expect(result.formattedSummary).toBe('Tests passed (coverage: 92.3%)');
    });

    it('should return failure message with count when tests fail', () => {
      const result = TestResult.failure(['auth test failed'], '1 failing', 1000);
      expect(result.formattedSummary).toContain('Tests failed: 1/0');
      expect(result.formattedSummary).toContain('auth test failed');
    });

    it('should include coverage in failure summary when available', () => {
      const result = TestResult.create({
        success: false,
        totalTests: 20,
        passedTests: 18,
        failedTests: 2,
        skippedTests: 0,
        duration: 2000,
        output: 'fail',
        errors: ['e1', 'e2'],
        coverage: 45,
      });
      expect(result.formattedSummary).toContain('Tests failed: 2/20');
      expect(result.formattedSummary).toContain('coverage: 45%');
    });

    it('should list all errors in failure summary', () => {
      const result = TestResult.failure(['Error A', 'Error B', 'Error C'], '3 failing', 500);
      expect(result.formattedSummary).toContain('  - Error A');
      expect(result.formattedSummary).toContain('  - Error B');
      expect(result.formattedSummary).toContain('  - Error C');
    });
  });

  describe('coverage', () => {
    it('should return undefined when coverage not set', () => {
      const result = TestResult.success('ok', 100);
      expect(result.coverage).toBeUndefined();
    });

    it('should return coverage value when set', () => {
      const result = TestResult.create({
        success: true,
        totalTests: 5,
        passedTests: 5,
        failedTests: 0,
        skippedTests: 0,
        duration: 100,
        output: 'ok',
        errors: [],
        coverage: 99.9,
      });
      expect(result.coverage).toBe(99.9);
    });
  });

  describe('toJSON', () => {
    it('should return all props as a plain object', () => {
      const props = {
        success: true,
        totalTests: 10,
        passedTests: 10,
        failedTests: 0,
        skippedTests: 0,
        duration: 100,
        output: 'ok',
        errors: [],
      };
      const result = TestResult.create(props);
      expect(result.toJSON()).toEqual(props);
    });
  });
});
