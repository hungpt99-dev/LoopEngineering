import { injectable, inject } from 'tsyringe';
import { ReviewResult, ReviewIssue } from '../../domain/entities/ReviewResult.js';
import { ReviewerService } from '../../domain/interfaces/ReviewerService.js';
import { IssueRepository, ISSUE_REPOSITORY } from '../../domain/interfaces/IssueRepository.js';
import { Logger, LOGGER } from '../../domain/interfaces/Logger.js';

const SECURITY_SENSITIVE_PATTERNS: Record<string, string> = {
  'Hardcoded credentials': 'plaintext password or API key in source code',
  'eval() usage': 'dynamic code execution with eval()',
  'SQL injection risk': 'unsanitized input in SQL query',
  'console.log left in production': 'debug logging in production code',
  dangerouslySetInnerHTML: 'React dangerouslySetInnerHTML usage',
};

const ANTI_PATTERN_CATEGORIES: Record<string, string[]> = {
  'Large file (>500 lines suggested refactor)': [],
  'Inconsistent naming convention': [],
  'Missing error handling': [],
};

const MISSING_TEST_EXTENSIONS = /\.(ts|tsx|js|jsx)$/;

@injectable()
export class ReviewServiceImpl implements ReviewerService {
  constructor(
    @inject(ISSUE_REPOSITORY) private readonly issueRepository: IssueRepository,
    @inject(LOGGER) private readonly logger: Logger,
  ) {}

  async reviewChanges(
    issueId: string,
    issueTitle: string,
    filesChanged: string[],
    testResult: string,
  ): Promise<ReviewResult> {
    this.logger.info('Reviewing changes', { issueId, fileCount: filesChanged.length });

    const existingIssue = await this.issueRepository.findById(issueId);
    const issueContext = existingIssue
      ? `Issue "${existingIssue.title}" [${existingIssue.status}]`
      : `Issue ${issueId} (not found in repository)`;
    this.logger.debug('Review context', { issueContext });

    const issues: ReviewIssue[] = [];

    const securityIssues = this.checkSecurity(filesChanged);
    issues.push(...securityIssues);

    const antiPatternIssues = this.checkAntiPatterns(filesChanged);
    issues.push(...antiPatternIssues);

    const testIssues = this.checkTestCoverage(filesChanged, testResult);
    issues.push(...testIssues);

    const requirementIssues = this.checkRequirements(issueTitle, filesChanged, testResult);
    issues.push(...requirementIssues);

    const testPassed = this.isTestPassing(testResult);
    const hasSecurityIssues = securityIssues.some((i) => i.severity === 'critical' || i.severity === 'major');

    if (hasSecurityIssues) {
      const suggestions = await this.suggestFixes(securityIssues);
      const score = this.calculateScore(issues);
      this.logger.warn('Review: changes requested due to security concerns', { issueId, criticalCount: securityIssues.length });
      return ReviewResult.requestChanges(issues, suggestions, score);
    }

    if (!testPassed) {
      const suggestions = await this.suggestFixes(testIssues);
      const score = this.calculateScore(issues);
      this.logger.warn('Review: changes requested due to failing tests', { issueId, failingTests: testResult });
      return ReviewResult.requestChanges(issues, suggestions, score);
    }

    if (issues.length > 0) {
      const suggestions = await this.suggestFixes(issues);
      const score = this.calculateScore(issues);
      return ReviewResult.requestChanges(issues, suggestions, score);
    }

    const score = 100;
    this.logger.info('Review: approved', { issueId, score });
    return ReviewResult.approved('All checks passed. Implementation meets requirements.', score);
  }

  async suggestFixes(issues: ReviewIssue[]): Promise<string[]> {
    const suggestions: string[] = [];

    for (const issue of issues) {
      const fix = this.generateFixSuggestion(issue);
      suggestions.push(fix);
    }

    return suggestions;
  }

  private checkSecurity(filesChanged: string[]): ReviewIssue[] {
    const securityIssues: ReviewIssue[] = [];

    for (const file of filesChanged) {
      const fileName = file.split('/').pop() ?? file;

      if (/\.(env|config)$/i.test(fileName) && /\.(json|yaml|yml|toml)$/i.test(fileName)) {
        securityIssues.push({
          severity: 'critical',
          category: 'security',
          description: `Configuration file changed: ${file}. Ensure no secrets are exposed.`,
          file,
        });
      }

      if (/auth|login|session|token|password/i.test(file)) {
        securityIssues.push({
          severity: 'major',
          category: 'security',
          description: `Security-sensitive file modified: ${file}. Review for proper auth handling and input validation.`,
          file,
        });
      }

      for (const [title, description] of Object.entries(SECURITY_SENSITIVE_PATTERNS)) {
        securityIssues.push({
          severity: 'critical',
          category: 'security',
          description: `${title}: ${description}`,
          file,
        });
      }
    }

    if (filesChanged.some((f) => /package\.json$/i.test(f))) {
      securityIssues.push({
        severity: 'major',
        category: 'security',
        description: 'package.json modified - review new dependencies for known vulnerabilities',
        file: 'package.json',
      });
    }

    if (filesChanged.some((f) => /\.lock$/i.test(f) || f.includes('yarn.lock'))) {
      securityIssues.push({
        severity: 'info',
        category: 'security',
        description: 'Lock file updated - ensure transitive dependency changes are intentional',
      });
    }

    return securityIssues;
  }

  private checkAntiPatterns(filesChanged: string[]): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const antiPatternNames = Object.keys(ANTI_PATTERN_CATEGORIES);

    for (const file of filesChanged) {
      if (/\.(css|scss|less)$/i.test(file)) {
        issues.push({
          severity: 'info',
          category: 'architecture',
          description: `CSS file modified: ${file}. Ensure consistent styling approach (CSS modules, styled-components, Tailwind).`,
          file,
        });
      }

      if (/(index|main|app)\.(ts|tsx|js|jsx)$/i.test(file)) {
        issues.push({
          severity: 'info',
          category: 'architecture',
          description: `Entry point file modified: ${file}. Ensure changes don't break application bootstrap.`,
          file,
        });
      }
    }

    if (filesChanged.length >= 10) {
      issues.push({
        severity: 'major',
        category: 'maintainability',
        description: `Potential ${antiPatternNames[0] ?? 'anti-pattern'}: ${filesChanged.length} files changed. Consider splitting into smaller, focused PRs.`,
      });
    }

    if (filesChanged.length >= 20) {
      issues.push({
        severity: 'critical',
        category: 'architecture',
        description: `${antiPatternNames[2] ?? 'Missing error handling'} risk: very large changeset (${filesChanged.length} files). High risk of unintended side effects.`,
      });
    }

    return issues;
  }

  private checkTestCoverage(filesChanged: string[], testResult: string): ReviewIssue[] {
    const issues: ReviewIssue[] = [];

    const sourceFiles = filesChanged.filter((f) => MISSING_TEST_EXTENSIONS.test(f) && !/\.(test|spec)\./.test(f) && !/test(s)?\//.test(f));
    const testFiles = filesChanged.filter((f) => /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(f) || /test(s)?\//.test(f));

    if (sourceFiles.length > 0 && testFiles.length === 0) {
      issues.push({
        severity: 'major',
        category: 'tests',
        description: `No test files included with ${sourceFiles.length} source file(s) changed. Add tests for the changes.`,
      });
    }

    if (testFiles.length > 0 && !this.isTestPassing(testResult)) {
      issues.push({
        severity: 'critical',
        category: 'tests',
        description: `Tests are failing: ${testResult.slice(0, 200)}`,
      });
    }

    const coverageMatch = testResult.match(/(?:coverage|covered)[:\s]*(\d+(?:\.\d+)?)\s*%/i);
    if (coverageMatch) {
      const coverage = parseFloat(coverageMatch[1] ?? '0');
      if (coverage < 70) {
        issues.push({
          severity: 'major',
          category: 'tests',
          description: `Test coverage is below 70% (current: ${coverage}%). Add more tests.`,
        });
      }
    }

    return issues;
  }

  private checkRequirements(issueTitle: string, filesChanged: string[], testResult: string): ReviewIssue[] {
    const issues: ReviewIssue[] = [];

    if (filesChanged.length === 0) {
      issues.push({
        severity: 'critical',
        category: 'correctness',
        description: 'No files were changed. The implementation may not have been applied.',
      });
    }

    if (testResult.toLowerCase().includes('0 tests') || testResult.toLowerCase().includes('no tests found')) {
      issues.push({
        severity: 'info',
        category: 'tests',
        description: `Issue "${issueTitle}" has no automated test results. Manual verification recommended.`,
      });
    }

    return issues;
  }

  private isTestPassing(testResult: string): boolean {
    const lower = testResult.toLowerCase();
    if (lower.includes('fail') || lower.includes('error') || lower.includes('0 passed') || lower.includes('1 failing')) {
      return false;
    }
    if (lower.includes('pass') || lower.includes('success') || lower.includes('tests passed') || lower.includes('all tests passed')) {
      return true;
    }
    return !lower.includes('fail');
  }

  private calculateScore(issues: ReviewIssue[]): number {
    if (issues.length === 0) return 100;

    let score = 100;
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          score -= 30;
          break;
        case 'major':
          score -= 15;
          break;
        case 'minor':
          score -= 5;
          break;
        case 'info':
          score -= 1;
          break;
      }
    }

    return Math.max(0, score);
  }

  private generateFixSuggestion(issue: ReviewIssue): string {
    const categoryFixMap: Record<string, (i: ReviewIssue) => string> = {
      security: (i) =>
        `[SECURITY] ${i.description}${i.file ? ` at ${i.file}` : ''}. Review for exposed secrets, remove hardcoded values, and use environment variables or a secrets manager.`,
      correctness: (i) =>
        `[CORRECTNESS] ${i.description} Verify the implementation against the original requirements. Ensure all acceptance criteria are met.`,
      architecture: (i) =>
        `[ARCHITECTURE] ${i.description}${i.file ? ` in ${i.file}` : ''}. Consider whether the change follows established patterns. If a new pattern is needed, document it.`,
      performance: (i) =>
        `[PERFORMANCE] ${i.description} Profile the affected code path, consider memoization, lazy loading, or query optimization.`,
      maintainability: (i) =>
        `[MAINTAINABILITY] ${i.description}${i.file ? ` in ${i.file}` : ''}. Break large changes into smaller commits, add inline documentation, and ensure naming is consistent.`,
      tests: (i) =>
        `[TESTS] ${i.description} Write unit tests covering edge cases, add integration tests for API changes, and ensure the test suite passes locally before pushing.`,
    };

    const fixFn = categoryFixMap[issue.category];
    if (fixFn) {
      return fixFn(issue);
    }

    return `${issue.category.toUpperCase()}: ${issue.description}. Review the implementation and address this concern before resubmitting.`;
  }
}
