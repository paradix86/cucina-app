import { spawnSync } from 'node:child_process';
import process from 'node:process';

const skipArg = process.argv.find(a => a.startsWith('--skip='));
const skipped = new Set(skipArg ? skipArg.slice('--skip='.length).split(',') : []);

const steps = [
  { name: 'lint',            command: 'npm', args: ['run', 'lint'] },
  { name: 'typecheck',       command: 'npx', args: ['vue-tsc', '--noEmit'] },
  { name: 'typecheck-tests', command: 'npx', args: ['vue-tsc', '-p', 'tsconfig.test.json', '--noEmit'] },
  { name: 'unit',            command: 'npm', args: ['run', 'test:unit'] },
  { name: 'e2e',             command: 'npm', args: ['run', 'test:e2e'] },
];

const start = Date.now();

for (const { name, command, args } of steps) {
  if (skipped.has(name)) {
    process.stderr.write(`↷ skipped: ${name}\n`);
    continue;
  }

  process.stderr.write(`▶ ${name}\n`);

  // shell:true is required on Windows where npm/npx resolve via .cmd shims.
  // It has no meaningful downside on Linux/macOS.
  const result = spawnSync(command, args, { stdio: 'inherit', shell: true });
  const code = result.status ?? 1;

  if (code !== 0) {
    process.stderr.write(`✗ ${name} failed (exit ${code})\n`);
    process.exit(code);
  }

  process.stderr.write(`✓ ${name}\n`);
}

process.stderr.write(`\nAll checks passed (${Date.now() - start}ms)\n`);
