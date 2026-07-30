import { describe, it, expect } from 'vitest';
import { ReviewResult, ReviewDecision, ReviewIssue } from '../../../src/domain/entities/ReviewResult.js';

describe('ReviewResult', () => {
  describe('static factories', () => {
    describe('approved', () => {
      it('should create an approved ReviewResult', () => {
        const result = ReviewResult.approved('All checks passed', 95);
        expect(result.decision).toBe(ReviewDecision.APPROVED);
        expect(result.isApproved).toBe(true);
        expect(result.summary).toBe('All checks passed');
        expect(result.score).toBe(95);
        expect(result.issues).toEqual([]);
        expect(result.suggestions).toEqual([]);
      });

      it('should have no critical issues', () => {
        const result = ReviewResult.approved('OK', 100);
        expect(result.criticalIssues).toEqual([]);
      });
    });

    describe('requestChanges', () => {
      it('should create a requestChanges ReviewResult with issues and suggestions', () => {
        const issues: ReviewIssue[] = [
          {
            severity: 'major',
            category: 'tests',
            description: 'No tests added',
          },
        ];
        const suggestions = ['Add unit tests'];
        const result = ReviewResult.requestChanges(issues, suggestions, 60);

        expect(result.decision).toBe(ReviewDecision.REQUEST_CHANGES);
        expect(result.isApproved).toBe(false);
        expect(result.summary).toBe('Requested changes: 1 issue(s) found');
        expect(result.score).toBe(60);
        expect(result.issues).toEqual(issues);
        expect(result.suggestions).toEqual(suggestions);
      });

      it('should reflect multiple issues in summary', () => {
        const issues: ReviewIssue[] = [
          { severity: 'critical', category: 'security', description: 'd1' },
          { severity: 'major', category: 'tests', description: 'd2' },
          { severity: 'minor', category: 'maintainability', description: 'd3' },
        ];
        const result = ReviewResult.requestChanges(issues, ['fix1', 'fix2', 'fix3'], 40);
        expect(result.summary).toBe('Requested changes: 3 issue(s) found');
      });
    });

    describe('create', () => {
      it('should create with custom props', () => {
        const result = ReviewResult.create({
          decision: ReviewDecision.APPROVED,
          summary: 'Custom summary',
          issues: [],
          suggestions: [],
          score: 88,
        });
        expect(result.decision).toBe(ReviewDecision.APPROVED);
        expect(result.summary).toBe('Custom summary');
      });
    });
  });

  describe('isApproved', () => {
    it('should return true for APPROVED decision', () => {
      const result = ReviewResult.approved('OK', 100);
      expect(result.isApproved).toBe(true);
    });

    it('should return false for REQUEST_CHANGES decision', () => {
      const result = ReviewResult.requestChanges([], [], 50);
      expect(result.isApproved).toBe(false);
    });
  });

  describe('criticalIssues', () => {
    it('should filter only critical severity issues', () => {
      const issues: ReviewIssue[] = [
        { severity: 'critical', category: 'security', description: 'secret exposed' },
        { severity: 'major', category: 'tests', description: 'no tests' },
        { severity: 'critical', category: 'architecture', description: 'god object' },
        { severity: 'info', category: 'maintainability', description: 'note' },
        { severity: 'minor', category: 'performance', description: 'slow query' },
      ];
      const result = ReviewResult.requestChanges(issues, [], 30);

      expect(result.criticalIssues).toHaveLength(2);
      expect(result.criticalIssues[0]?.description).toBe('secret exposed');
      expect(result.criticalIssues[1]?.description).toBe('god object');
    });

    it('should return empty array when no critical issues', () => {
      const issues: ReviewIssue[] = [
        { severity: 'major', category: 'tests', description: 'no tests' },
      ];
      const result = ReviewResult.requestChanges(issues, [], 50);
      expect(result.criticalIssues).toHaveLength(0);
    });

    it('should return empty array for approved result', () => {
      const result = ReviewResult.approved('OK', 100);
      expect(result.criticalIssues).toEqual([]);
    });
  });

  describe('toJSON', () => {
    it('should return all props as a plain object', () => {
      const issues: ReviewIssue[] = [
        { severity: 'major', category: 'tests', description: 'missing tests', file: 'src/auth.ts' },
      ];
      const result = ReviewResult.requestChanges(issues, ['Add tests'], 70);
      const json = result.toJSON();

      expect(json.decision).toBe(ReviewDecision.REQUEST_CHANGES);
      expect(json.issues).toEqual(issues);
      expect(json.suggestions).toEqual(['Add tests']);
      expect(json.score).toBe(70);
    });
  });
});
