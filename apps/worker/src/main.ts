import { Worker } from 'bullmq';
import { getConfig } from '../../api/src/config';
import { createPool } from '../../api/src/db/pool';
import { PostgresExecutionRepository } from '../../api/src/db/postgresExecutionRepository';
import { PostgresWorkflowRepository } from '../../api/src/db/postgresWorkflowRepository';
import { runWorkflowGraph } from '../../api/src/domain/workflowRunner';
import {
  EXECUTION_QUEUE_NAME,
  type WorkflowExecutionJobData
} from '../../api/src/queue/executionQueue';
import { parseRedisConnection } from '../../api/src/queue/redisConnection';

const config = getConfig();

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is required to run the worker.');
}

const pool = createPool({ connectionString: config.databaseUrl });
const executionRepository = new PostgresExecutionRepository(pool);
const workflowRepository = new PostgresWorkflowRepository(pool);
const worker = new Worker<WorkflowExecutionJobData>(
  EXECUTION_QUEUE_NAME,
  async (job) => {
    const execution = await executionRepository.findById(job.data.executionId);

    if (!execution) {
      throw new Error(`Execution "${job.data.executionId}" was not found.`);
    }

    const workflow = await workflowRepository.findById(job.data.workflowId);

    if (!workflow) {
      await executionRepository.markFailed(execution.id, 'Workflow was not found.');
      throw new Error(`Workflow "${job.data.workflowId}" was not found.`);
    }

    await runWorkflowGraph({
      executionId: execution.id,
      workflow,
      executionInput: execution.input,
      executionRepository
    });
  },
  {
    concurrency: 5,
    connection: parseRedisConnection(config.redisUrl)
  }
);

worker.on('completed', (job) => {
  console.log(`Workflow execution job ${job.id} completed.`);
});

worker.on('failed', (job, error) => {
  console.error(`Workflow execution job ${job?.id ?? 'unknown'} failed: ${error.message}`);
});

console.log(`FlowForge worker listening on BullMQ queue "${EXECUTION_QUEUE_NAME}".`);

async function shutdown(): Promise<void> {
  await worker.close();
  await pool.end();
}

process.on('SIGINT', () => {
  void shutdown().then(() => process.exit(0));
});

process.on('SIGTERM', () => {
  void shutdown().then(() => process.exit(0));
});
