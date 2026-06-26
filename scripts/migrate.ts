import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from '../apps/api/src/config';
import { runMigrations } from '../apps/api/src/db/migrations';
import { createPool } from '../apps/api/src/db/pool';

const config = getConfig();

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is required to run migrations.');
}

const pool = createPool({ connectionString: config.databaseUrl });
const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(currentDir, '../apps/api/migrations');

try {
  const result = await runMigrations(pool, migrationsDir);
  console.log(`Migrations applied: ${result.applied.length}`);
  console.log(`Migrations skipped: ${result.skipped.length}`);
} finally {
  await pool.end();
}
