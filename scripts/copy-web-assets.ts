import { copyFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const assets = [
  ['apps/web/index.html', 'dist/web/index.html'],
  ['apps/web/src/styles.css', 'dist/web/src/styles.css']
] as const;

for (const [from, to] of assets) {
  await mkdir(dirname(to), { recursive: true });
  await copyFile(from, to);
}

