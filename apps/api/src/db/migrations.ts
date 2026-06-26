import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type pg from 'pg';

export type MigrationResult = {
  applied: string[];
  skipped: string[];
};

export async function runMigrations(pool: pg.Pool, migrationsDir: string): Promise<MigrationResult> {
  await pool.query(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const existing = await pool.query<{ name: string }>(
      'select name from schema_migrations where name = $1',
      [file]
    );

    if ((existing.rowCount ?? 0) > 0) {
      skipped.push(file);
      continue;
    }

    const sql = await readFile(join(migrationsDir, file), 'utf8');
    const client = await pool.connect();

    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into schema_migrations (name) values ($1)', [file]);
      await client.query('commit');
      applied.push(file);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  return { applied, skipped };
}

