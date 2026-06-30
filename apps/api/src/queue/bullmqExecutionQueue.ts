import { Queue } from 'bullmq';
import {
  EXECUTION_QUEUE_NAME,
  type ExecutionQueue,
  type WorkflowExecutionJobData
} from './executionQueue';
import { parseRedisConnection } from './redisConnection';

export class BullmqExecutionQueue implements ExecutionQueue {
  readonly #queue: Queue<WorkflowExecutionJobData, void, 'run-workflow'>;

  constructor(redisUrl: string) {
    this.#queue = new Queue<WorkflowExecutionJobData, void, 'run-workflow'>(EXECUTION_QUEUE_NAME, {
      connection: parseRedisConnection(redisUrl)
    });
  }

  async enqueueWorkflowExecution(data: WorkflowExecutionJobData): Promise<void> {
    await this.#queue.add('run-workflow', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      },
      removeOnComplete: {
        age: 60 * 60 * 24,
        count: 1000
      },
      removeOnFail: {
        age: 60 * 60 * 24 * 7,
        count: 5000
      }
    });
  }

  async close(): Promise<void> {
    await this.#queue.close();
  }
}
