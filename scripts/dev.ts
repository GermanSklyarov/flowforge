import { spawn } from 'node:child_process';
import type { ChildProcessByStdio } from 'node:child_process';
import type { Readable, Writable } from 'node:stream';

type ManagedProcess = {
  name: string;
  child: ChildProcessByStdio<null, Readable, Readable>;
};

type ProcessDefinition = readonly [name: string, command: string, args: readonly string[]];

const processDefinitions = [
  ['api', 'npm', ['run', 'dev:api']],
  ['web', 'npm', ['run', 'dev:web']]
] as const satisfies readonly ProcessDefinition[];

const processes: ManagedProcess[] = processDefinitions.map(([name, command, args]) => {
  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env
  });

  child.stdout.on('data', (chunk: Buffer) => process.stdout.write(`[${name}] ${chunk.toString()}`));
  child.stderr.on('data', (chunk: Buffer) => process.stderr.write(`[${name}] ${chunk.toString()}`));
  child.on('exit', (code: number | null) => {
    if (code !== 0 && code !== null) {
      console.error(`[${name}] exited with code ${code}`);
      process.exitCode = code;
    }
  });

  return { name, child };
});

function shutdown(): void {
  for (const { child } of processes) {
    child.kill('SIGTERM');
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
