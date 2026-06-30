import type { Provider } from '@nestjs/common';
import { getConfig } from '../config';
import { createPool } from '../db/pool';
import { PostgresExecutionRepository } from '../db/postgresExecutionRepository';
import { InMemoryExecutionRepository } from '../domain/executionRepository';
import { EXECUTION_REPOSITORY } from './tokens';

export const ExecutionRepositoryProvider: Provider = {
  provide: EXECUTION_REPOSITORY,
  useFactory: () => {
    const config = getConfig();

    if (!config.databaseUrl) {
      return new InMemoryExecutionRepository();
    }

    const pool = createPool({ connectionString: config.databaseUrl });
    return new PostgresExecutionRepository(pool);
  }
};

