import type { Provider } from '@nestjs/common';
import { getConfig } from '../config';
import { createPool } from '../db/pool';
import { PostgresWorkflowRepository } from '../db/postgresWorkflowRepository';
import { InMemoryWorkflowRepository } from '../domain/workflowRepository';
import { WORKFLOW_REPOSITORY } from './tokens';

export const WorkflowRepositoryProvider: Provider = {
  provide: WORKFLOW_REPOSITORY,
  useFactory: () => {
    const config = getConfig();

    if (!config.databaseUrl) {
      return new InMemoryWorkflowRepository();
    }

    const pool = createPool({ connectionString: config.databaseUrl });
    return new PostgresWorkflowRepository(pool);
  }
};

