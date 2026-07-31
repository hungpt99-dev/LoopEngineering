import { execa } from 'execa';

function getErrorStdout(error: unknown): string {
  if (error instanceof Error && 'stdout' in error) {
    const raw = error.stdout;
    if (typeof raw === 'string') return raw;
  }
  return '';
}

function getErrorStderr(error: unknown): string {
  if (error instanceof Error && 'stderr' in error) {
    const raw = error.stderr;
    if (typeof raw === 'string') return raw;
  }
  return '';
}

function getErrorExitCode(error: unknown): number | undefined {
  if (error instanceof Error && 'exitCode' in error) {
    const raw = error.exitCode;
    if (typeof raw === 'number') return raw;
  }
  return undefined;
}

export function extractAgentError(error: unknown, agentName: string): string {
  if (!(error instanceof Error)) {
    return 'Unknown error occurred';
  }

  const exitCode = getErrorExitCode(error);
  const stderr = getErrorStderr(error);
  const codeStr = exitCode !== undefined ? ` (exit code ${exitCode})` : '';

  if (stderr.trim()) {
    const summary = stderr.split('\n').slice(0, 10).join('\n').slice(0, 500);
    return `${agentName} failed${codeStr}: ${summary}`;
  }

  const shortMessage = error.message.includes('\n') ? error.message.split('\n')[0]! : error.message;
  return `${agentName} failed${codeStr}: ${shortMessage.slice(0, 300)}`;
}

export function getErrorOutput(error: unknown): string {
  return getErrorStdout(error);
}

export async function getChangedFiles(): Promise<string[]> {
  try {
    const { stdout } = await execa('git', ['diff', '--name-only', 'HEAD'], {
      reject: false,
    });
    return stdout
      .trim()
      .split('\n')
      .filter((line) => line.length > 0);
  } catch {
    return [];
  }
}
