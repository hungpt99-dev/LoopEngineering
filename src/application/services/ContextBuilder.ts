import { injectable, inject } from 'tsyringe';
import { Issue } from '../../domain/entities/Issue.js';
import { ExecutionPlan } from '../../domain/entities/ExecutionPlan.js';
import { ContextBuilder } from '../../domain/interfaces/ContextBuilder.js';
import { IssueRepository, ISSUE_REPOSITORY } from '../../domain/interfaces/IssueRepository.js';
import { Logger, LOGGER } from '../../domain/interfaces/Logger.js';

const ISSUE_REF_PATTERN = /[A-Z]+-\d+/g;
const FILE_PATH_PATTERN = /(?:src\/|lib\/|app\/|components\/|pages\/|utils\/|hooks\/|services\/|models\/|controllers\/|middleware\/)[\w\/.-]+\.(?:ts|tsx|js|jsx|py|go|rs|java|rb|css|scss|html|json|yaml|yml)/gi;
const EXTENSION_KEYWORD_MAP: Record<string, RegExp[]> = {
  '.ts': [/typescript|type|interface|enum|generic/i],
  '.tsx': [/component|react|jsx|props|state|hook/i],
  '.jsx': [/react|component|jsx|render/i],
  '.css': [/css|style|stylesheet|scss|less|tailwind|responsive|layout/i],
  '.go': [/golang|go module|goroutine|channel/i],
  '.rs': [/rust|cargo|crate|trait|ownership/i],
  '.py': [/python|django|flask|fastapi|pytest/i],
  '.json': [/config|json|package\.json|manifest|schema/i],
  '.yaml': [/yaml|yml|config|docker.compose|k8s|kubernetes/i],
  '.sql': [/sql|database|migration|schema|query|postgres|mysql/i],
};

@injectable()
export class ContextBuilderImpl implements ContextBuilder {
  constructor(
    @inject(ISSUE_REPOSITORY) private readonly issueRepository: IssueRepository,
    @inject(LOGGER) private readonly logger: Logger,
  ) {}

  async buildIssueContext(issue: Issue): Promise<string> {
    this.logger.info('Building issue context', { issueId: issue.id });

    const sections: string[] = [];

    sections.push(`## Issue: ${issue.title}`);
    sections.push(`**Status**: ${issue.status}`);
    sections.push(`**Priority**: ${issue.priority}`);

    if (issue.estimate !== undefined) {
      sections.push(`**Estimate**: ${issue.estimate} points`);
    }

    if (issue.projectName) {
      sections.push(`**Project**: ${issue.projectName}`);
    }

    if (issue.milestoneName) {
      sections.push(`**Milestone**: ${issue.milestoneName}`);
    }

    if (issue.dueDate) {
      sections.push(`**Due Date**: ${issue.dueDate.toISOString().slice(0, 10)}`);
    }

    sections.push(`\n### Labels`);
    if (issue.labelIds.length > 0) {
      sections.push(issue.labelIds.map((l) => `- ${l}`).join('\n'));
    } else {
      sections.push('(none)');
    }

    if (issue.parentId) {
      sections.push(`\n### Parent Issue`);
      const parent = await this.issueRepository.findById(issue.parentId);
      if (parent) {
        sections.push(`- **${parent.id}**: ${parent.title}`);
        sections.push(`  Status: ${parent.status}`);
      } else {
        sections.push(`- ${issue.parentId} (not found)`);
      }
    }

    if (issue.blockedByIssues.length > 0) {
      sections.push(`\n### Blocked By`);
      for (const blockerId of issue.blockedByIssues) {
        const blocker = await this.issueRepository.findById(blockerId);
        if (blocker) {
          sections.push(`- **${blocker.id}**: ${blocker.title} [${blocker.status}]`);
        } else {
          sections.push(`- ${blockerId} (not found)`);
        }
      }
    }

    if (issue.blockingIssues.length > 0) {
      sections.push(`\n### Blocking`);
      for (const blockingId of issue.blockingIssues) {
        const blocking = await this.issueRepository.findById(blockingId);
        if (blocking) {
          sections.push(`- **${blocking.id}**: ${blocking.title} [${blocking.status}]`);
        } else {
          sections.push(`- ${blockingId} (not found)`);
        }
      }
    }

    if (issue.projectId) {
      sections.push(`\n### Related Issues (same project)`);
      const projectIssues = await this.issueRepository.findByProjectId(issue.projectId);
      const related = projectIssues.filter((i) => i.id !== issue.id).slice(0, 10);
      if (related.length > 0) {
        sections.push(related.map((i) => `- **${i.id}**: ${i.title} [${i.status}]`).join('\n'));
      } else {
        sections.push('(no other issues in project)');
      }
    }

    return sections.join('\n');
  }

  async buildProjectContext(projectId: string): Promise<string> {
    this.logger.info('Building project context', { projectId });

    const project = await this.issueRepository.findProjectById(projectId);
    if (!project) {
      this.logger.warn('Project not found', { projectId });
      return `Project ${projectId} not found`;
    }

    const sections: string[] = [];
    sections.push(`## Project: ${project.name}`);
    sections.push(`**Status**: ${project.state}`);
    sections.push(`**Progress**: ${Math.round(project.progress * 100)}%`);

    if (project.description) {
      sections.push(`\n### Description\n${project.description}`);
    }

    if (project.startDate) {
      sections.push(`**Start Date**: ${project.startDate.toISOString().slice(0, 10)}`);
    }
    if (project.targetDate) {
      sections.push(`**Target Date**: ${project.targetDate.toISOString().slice(0, 10)}`);
    }

    const milestones = await this.issueRepository.findAllMilestones(projectId);
    if (milestones.length > 0) {
      sections.push(`\n### Milestones`);
      sections.push(
        milestones
          .map((m) => `- **${m.name}**: ${Math.round(m.progress * 100)}% complete${m.targetDate ? ` (target: ${m.targetDate.toISOString().slice(0, 10)})` : ''}`)
          .join('\n'),
      );
    }

    const issues = await this.issueRepository.findByProjectId(projectId);
    if (issues.length > 0) {
      const completed = issues.filter((i) => i.isCompleted).length;
      sections.push(`\n### Issue Stats`);
      sections.push(`- Total issues: ${issues.length}`);
      sections.push(`- Completed: ${completed}`);
      sections.push(`- Remaining: ${issues.length - completed}`);
    }

    return sections.join('\n');
  }

  async buildMilestoneContext(projectId: string, milestoneId: string): Promise<string> {
    this.logger.info('Building milestone context', { projectId, milestoneId });

    const milestone = await this.issueRepository.findMilestoneById(projectId, milestoneId);
    if (!milestone) {
      this.logger.warn('Milestone not found', { projectId, milestoneId });
      return `Milestone ${milestoneId} not found in project ${projectId}`;
    }

    const sections: string[] = [];
    sections.push(`## Milestone: ${milestone.name}`);
    sections.push(`**Progress**: ${Math.round(milestone.progress * 100)}%`);

    if (milestone.description) {
      sections.push(`\n### Description\n${milestone.description}`);
    }

    if (milestone.targetDate) {
      sections.push(`**Target Date**: ${milestone.targetDate.toISOString().slice(0, 10)}`);
    }

    const issues = await this.issueRepository.findByMilestoneId(milestoneId);
    if (issues.length > 0) {
      sections.push(`\n### Issues (${issues.length})`);
      sections.push(
        issues
          .map((i) => `- **${i.id}**: ${i.title} [${i.status}]`)
          .join('\n'),
      );
    }

    return sections.join('\n');
  }

  async buildFullContext(issue: Issue, plan: ExecutionPlan): Promise<string> {
    this.logger.info('Building full context', { issueId: issue.id });

    const parts: string[] = [];

    const issueContext = await this.buildIssueContext(issue);
    parts.push(issueContext);

    if (issue.projectId) {
      const projectContext = await this.buildProjectContext(issue.projectId);
      parts.push(projectContext);
    }

    if (issue.projectId && issue.milestoneId) {
      const milestoneContext = await this.buildMilestoneContext(issue.projectId, issue.milestoneId);
      parts.push(milestoneContext);
    }

    parts.push(`## Implementation Plan`);
    parts.push(`**Complexity**: ${plan.complexity}`);
    parts.push(`**Estimated Duration**: ${plan.estimatedDuration} minutes`);
    parts.push(`**Recommended Agent**: ${plan.recommendedAgent}`);

    if (plan.implementationSteps.length > 0) {
      parts.push(`\n### Steps`);
      parts.push(plan.implementationSteps.map((s, i) => `${i + 1}. ${s}`).join('\n'));
    }

    if (plan.filesToInspect.length > 0) {
      parts.push(`\n### Files to Inspect`);
      parts.push(plan.filesToInspect.map((f) => `- ${f}`).join('\n'));
    }

    if (plan.dependencies.length > 0) {
      parts.push(`\n### Dependencies`);
      parts.push(plan.dependencies.map((d) => `- ${d}`).join('\n'));
    }

    if (plan.risks.length > 0) {
      parts.push(`\n### Risks`);
      parts.push(plan.risks.map((r) => `- ${r}`).join('\n'));
    }

    return parts.join('\n\n');
  }

  async detectDependencies(issue: Issue): Promise<string[]> {
    const dependencies: string[] = [];
    const desc = issue.description;
    const title = issue.title;
    const combined = `${title}\n${desc}`;

    const issueRefs = combined.matchAll(ISSUE_REF_PATTERN);
    for (const match of issueRefs) {
      const ref = match[0];
      if (ref && ref !== issue.id && !dependencies.includes(ref)) {
        dependencies.push(ref);
      }
    }

    const fileRefs = combined.matchAll(FILE_PATH_PATTERN);
    for (const match of fileRefs) {
      const ref = match[0];
      if (ref && !dependencies.includes(ref)) {
        dependencies.push(ref);
      }
    }

    const componentMentions = combined.matchAll(/\b(?:depends on|requires|needs|after|before|integrates with|extends|implements|uses)\s+([A-Z][\w]+(?:Service|Provider|Repository|Controller|Component|Module|Handler|Middleware|Store|Hook|Util))/g);
    for (const match of componentMentions) {
      const component = match[1];
      if (component && !dependencies.includes(component)) {
        dependencies.push(`Component: ${component}`);
      }
    }

    return dependencies;
  }

  async identifyFiles(issue: Issue): Promise<string[]> {
    const files = new Set<string>();
    const desc = `${issue.title} ${issue.description}`.toLowerCase();

    const pathMatches = desc.matchAll(FILE_PATH_PATTERN);
    for (const match of pathMatches) {
      const path = match[0];
      if (path) {
        files.add(path);
      }
    }

    for (const [ext, patterns] of Object.entries(EXTENSION_KEYWORD_MAP)) {
      if (patterns.some((p) => p.test(desc))) {
        files.add(`*${ext}`);
      }
    }

    const keywordPathMap: Record<string, string[]> = {
      component: ['src/components/', 'src/ui/', 'components/'],
      hook: ['src/hooks/', 'hooks/'],
      util: ['src/utils/', 'src/helpers/', 'utils/'],
      api: ['src/api/', 'src/controllers/', 'src/routes/', 'api/'],
      service: ['src/services/', 'services/'],
      model: ['src/models/', 'src/entities/', 'models/'],
      middleware: ['src/middleware/', 'middleware/'],
      config: ['src/config/', 'config/'],
      test: ['src/__tests__/', 'tests/', '*.test.ts', '*.spec.ts'],
      database: ['prisma/', 'src/db/', 'migrations/'],
      css: ['src/styles/', '*.module.css', '*.scss'],
      auth: ['src/auth/', 'src/middleware/auth'],
      route: ['src/routes/', 'src/pages/'],
      reducer: ['src/store/', 'src/reducers/'],
      type: ['src/types/', 'src/@types/'],
    };

    const fileKeywordMap: Record<string, string[]> = {
      component: ['*.tsx', '*.jsx'],
      hook: ['use*.ts', 'use*.tsx'],
      util: ['*.util.ts', '*.helper.ts'],
      api: ['*.controller.ts', '*.route.ts'],
      service: ['*.service.ts'],
      model: ['*.model.ts', '*.entity.ts'],
      middleware: ['*.middleware.ts'],
      config: ['*.config.ts', '*.config.json'],
      database: ['schema.prisma', '*.migration.sql'],
      test: ['*.test.ts', '*.spec.ts'],
      css: ['*.css', '*.scss', '*.module.css'],
    };

    for (const [keyword, paths] of Object.entries(keywordPathMap)) {
      if (desc.includes(keyword)) {
        for (const p of paths) {
          files.add(p);
        }
      }
    }

    for (const [keyword, filePatterns] of Object.entries(fileKeywordMap)) {
      if (desc.includes(keyword)) {
        for (const fp of filePatterns) {
          files.add(fp);
        }
      }
    }

    return Array.from(files).slice(0, 30);
  }
}
