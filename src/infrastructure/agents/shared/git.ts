import { execa } from 'execa';

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
