import pg from 'pg';

export type DatabaseConfig = {
  connectionString: string;
};

export function createPool(config: DatabaseConfig): pg.Pool {
  return new pg.Pool({
    connectionString: config.connectionString,
    max: 10
  });
}

