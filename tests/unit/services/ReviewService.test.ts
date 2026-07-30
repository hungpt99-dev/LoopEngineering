import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReviewServiceImpl } from '../../../src/application/services/ReviewService.js';
import { ReviewDecision } from '../../../src/domain/entities/ReviewResult.js';

function mockIssueRepo() {
  return {
    findNextIssue: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(null),
    findByProjectId: vi.fn().mockResolvedValue([]),
    findByMilestoneId: vi.fn().mockResolvedValue([]),
    findAll: vi.fn().mockResolvedValue([]),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    addComment: vi.fn().mockResolvedValue(undefined),
    createIssue: vi.fn().mockResolvedValue(null),
    findProjectByName: vi.fn().mockResolvedValue(null),
    findProjectById: vi.fn().mockResolvedValue(null),
    findAllProjects: vi.fn().mockResolvedValue([]),
    findMilestoneByName: vi.fn().mockResolvedValue(null),
    findMilestoneById: vi.fn().mockResolvedValue(null),
    findAllMilestones: vi.fn().mockResolvedValue([]),
    createBlocker: vi.fn().mockResolvedValue(undefined),
  };
}

function mockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };
}

describe('ReviewServiceImpl', () => {
  let service: ReviewServiceImpl;
  let issueRepo: ReturnType<typeof mockIssueRepo>;
  let logger: ReturnType<typeof mockLogger>;

  beforeEach(() => {
    issueRepo = mockIssueRepo();
    logger = mockLogger();
    service = new ReviewServiceImpl(issueRepo as any, logger as any);
  });

  describe('reviewChanges', () => {
    it('should review and return a ReviewResult with the correct shape for a clean changeset', async () => {
      const files = ['src/utils.ts'];
      const testResult = 'All tests passed';
      const result = await service.reviewChanges('issue-1', 'Add utility', files, testResult);
      expect(result).toBeDefined();
      expect(typeof result.decision).toBe('string');
      expect(typeof result.score).toBe('number');
      expect(Array.isArray(result.issues)).toBe(true);
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('should request changes when no test files are added for source changes', async () => {
      const files = ['src/auth.ts', 'src/db.ts'];
      const testResult = 'Tests passed';
      const result = await service.reviewChanges('issue-2', 'Auth changes', files, testResult);
      expect(result.decision).toBe(ReviewDecision.REQUEST_CHANGES);
      const testIssue = result.issues.find((i) => i.category === 'tests');
      expect(testIssue).toBeDefined();
      expect(testIssue?.severity).toBe('major');
    });

    it('should request changes with anti-pattern warning for too many files', async () => {
      const files = Array.from({ length: 12 }, (_, i) => `src/file${i}.ts`);
      const testResult = 'All tests passed';
      const result = await service.reviewChanges('issue-3', 'Big refactor', files, testResult);
      expect(result.decision).toBe(ReviewDecision.REQUEST_CHANGES);
      const antiPattern = result.issues.find(
        (i) => i.category === 'maintainability' || (i.category === 'architecture' && i.severity === 'major'),
      );
      expect(antiPattern).toBeDefined();
    });

    it('should flag very large changesets as critical architecture risk', async () => {
      const files = Array.from({ length: 25 }, (_, i) => `src/file${i}.ts`);
      const testResult = 'All tests passed';
      const result = await service.reviewChanges('issue-4', 'Massive change', files, testResult);
      const criticalArchIssue = result.issues.find(
        (i) => i.severity === 'critical' && i.category === 'architecture',
      );
      expect(criticalArchIssue).toBeDefined();
    });

    it('should request changes for security concerns (auth files)', async () => {
      const files = ['src/auth/login.ts'];
      const testResult = 'All tests passed';
      const result = await service.reviewChanges('issue-5', 'Auth update', files, testResult);
      expect(result.decision).toBe(ReviewDecision.REQUEST_CHANGES);
      const securityIssue = result.issues.find(
        (i) => i.category === 'security',
      );
      expect(securityIssue).toBeDefined();
    });

    it('should flag .env config changes as critical security', async () => {
      const files = ['.env.production'];
      const testResult = 'All tests passed';
      const result = await service.reviewChanges('issue-6', 'Config change', files, testResult);
      const criticalSecurity = result.issues.find(
        (i) => i.severity === 'critical' && i.category === 'security',
      );
      expect(criticalSecurity).toBeDefined();
    });

    it('should create critical issue when no files changed', async () => {
      const result = await service.reviewChanges('issue-7', 'Empty change', [], 'All tests passed');
      expect(result.decision).toBe(ReviewDecision.REQUEST_CHANGES);
      const emptyIssue = result.issues.find((i) => i.category === 'correctness');
      expect(emptyIssue).toBeDefined();
      expect(emptyIssue?.severity).toBe('critical');
    });

    it('should request changes when tests fail', async () => {
      const files = ['src/utils.ts', 'src/utils.test.ts'];
      const testResult = '1 failing test: utils.test.ts';
      const result = await service.reviewChanges('issue-8', 'Broken test', files, testResult);
      expect(result.decision).toBe(ReviewDecision.REQUEST_CHANGES);
    });

    it('should flag package.json changes as security major', async () => {
      const files = ['package.json', 'src/index.ts'];
      const testResult = 'All tests passed';
      const result = await service.reviewChanges('issue-9', 'Dependency update', files, testResult);
      const pkgIssue = result.issues.find(
        (i) => i.category === 'security' && i.severity === 'major',
      );
      expect(pkgIssue).toBeDefined();
    });

    it('should calculate score correctly for multiple issues', async () => {
      const files = ['src/auth/login.ts', '.env.config.yaml', 'package.json'];
      const testResult = 'fail';
      const result = await service.reviewChanges('issue-10', 'Bad PR', files, testResult);
      expect(result.score).toBeLessThan(100);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should call issueRepository.findById for context', async () => {
      const files = ['src/utils.ts'];
      const testResult = 'All tests passed';
      await service.reviewChanges('issue-11', 'Test', files, testResult);
      expect(issueRepo.findById).toHaveBeenCalledWith('issue-11');
    });
  });

  describe('suggestFixes', () => {
    it('should generate fix suggestion for security issues', async () => {
      const issues = [
        { severity: 'critical' as const, category: 'security' as const, description: 'Hardcoded secret found', file: 'auth.ts' },
      ];
      const suggestions = await service.suggestFixes(issues);
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]).toContain('[SECURITY]');
      expect(suggestions[0]).toContain('Hardcoded secret found');
      expect(suggestions[0]).toContain('auth.ts');
    });

    it('should generate fix suggestion for correctness issues', async () => {
      const issues = [
        { severity: 'critical' as const, category: 'correctness' as const, description: 'Missing implementation', file: 'src/feat.ts' },
      ];
      const suggestions = await service.suggestFixes(issues);
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]).toContain('[CORRECTNESS]');
    });

    it('should generate fix suggestion for architecture issues', async () => {
      const issues = [
        { severity: 'major' as const, category: 'architecture' as const, description: 'God object detected', file: 'src/handler.ts' },
      ];
      const suggestions = await service.suggestFixes(issues);
      expect(suggestions[0]).toContain('[ARCHITECTURE]');
    });

    it('should generate fix suggestion for performance issues', async () => {
      const issues = [
        { severity: 'minor' as const, category: 'performance' as const, description: 'N+1 query' },
      ];
      const suggestions = await service.suggestFixes(issues);
      expect(suggestions[0]).toContain('[PERFORMANCE]');
    });

    it('should generate fix suggestion for maintainability issues', async () => {
      const issues = [
        { severity: 'info' as const, category: 'maintainability' as const, description: 'Long function', file: 'src/util.ts' },
      ];
      const suggestions = await service.suggestFixes(issues);
      expect(suggestions[0]).toContain('[MAINTAINABILITY]');
    });

    it('should generate fix suggestion for test issues', async () => {
      const issues = [
        { severity: 'major' as const, category: 'tests' as const, description: 'Missing test coverage' },
      ];
      const suggestions = await service.suggestFixes(issues);
      expect(suggestions[0]).toContain('[TESTS]');
    });

    it('should generate multiple suggestions for multiple issues', async () => {
      const issues = [
        { severity: 'critical' as const, category: 'security' as const, description: 'Secret leak', file: '.env' },
        { severity: 'major' as const, category: 'tests' as const, description: 'No tests' },
        { severity: 'minor' as const, category: 'maintainability' as const, description: 'Naming issue' },
      ];
      const suggestions = await service.suggestFixes(issues);
      expect(suggestions).toHaveLength(3);
    });
  });
});
