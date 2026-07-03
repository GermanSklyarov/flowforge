import { EventEmitter } from 'node:events';
import Redis from 'ioredis';

export type ExecutionEvent =
  | {
      type: 'execution.started';
      executionId: string;
      workflowId: string;
      timestamp: string;
    }
  | {
      type: 'execution.succeeded';
      executionId: string;
      workflowId: string;
      timestamp: string;
      output: Record<string, unknown>;
    }
  | {
      type: 'execution.failed';
      executionId: string;
      workflowId: string;
      timestamp: string;
      error: string;
    }
  | {
      type: 'node.started';
      executionId: string;
      workflowId: string;
      nodeId: string;
      nodeType: string;
      timestamp: string;
    }
  | {
      type: 'node.succeeded';
      executionId: string;
      workflowId: string;
      nodeId: string;
      nodeType: string;
      timestamp: string;
      output: Record<string, unknown>;
    }
  | {
      type: 'node.failed';
      executionId: string;
      workflowId: string;
      nodeId: string;
      nodeType: string;
      timestamp: string;
      error: string;
    };

export type ExecutionEventPublisher = {
  publish(event: ExecutionEvent): void;
};

export type ExecutionEventSubscriber = {
  subscribe(listener: (event: ExecutionEvent) => void): () => void;
};

export class InMemoryExecutionEventBus
  implements ExecutionEventPublisher, ExecutionEventSubscriber
{
  readonly #emitter = new EventEmitter();

  publish(event: ExecutionEvent): void {
    this.#emitter.emit('event', event);
  }

  subscribe(listener: (event: ExecutionEvent) => void): () => void {
    this.#emitter.on('event', listener);

    return () => {
      this.#emitter.off('event', listener);
    };
  }
}

export const executionEventBus = new InMemoryExecutionEventBus();

export class RedisExecutionEventPublisher implements ExecutionEventPublisher {
  readonly #redis: Redis;

  constructor(redisUrl: string) {
    this.#redis = new Redis(redisUrl, {
      maxRetriesPerRequest: null
    });
  }

  publish(event: ExecutionEvent): void {
    void this.#redis.publish(EXECUTION_EVENTS_CHANNEL, JSON.stringify(event));
  }

  async close(): Promise<void> {
    await this.#redis.quit();
  }
}

export class RedisExecutionEventSubscriber implements ExecutionEventSubscriber {
  readonly #redis: Redis;
  readonly #listeners = new Set<(event: ExecutionEvent) => void>();
  #subscribed = false;

  constructor(redisUrl: string) {
    this.#redis = new Redis(redisUrl, {
      maxRetriesPerRequest: null
    });
    this.#redis.on('message', (_channel, message) => {
      const event = parseExecutionEvent(message);

      if (!event) {
        return;
      }

      for (const listener of this.#listeners) {
        listener(event);
      }
    });
  }

  subscribe(listener: (event: ExecutionEvent) => void): () => void {
    this.#listeners.add(listener);

    if (!this.#subscribed) {
      this.#subscribed = true;
      void this.#redis.subscribe(EXECUTION_EVENTS_CHANNEL);
    }

    return () => {
      this.#listeners.delete(listener);
    };
  }

  async close(): Promise<void> {
    await this.#redis.unsubscribe(EXECUTION_EVENTS_CHANNEL);
    await this.#redis.quit();
  }
}

export function createExecutionEventBase(input: {
  executionId: string;
  workflowId: string;
}): { executionId: string; timestamp: string; workflowId: string } {
  return {
    executionId: input.executionId,
    workflowId: input.workflowId,
    timestamp: new Date().toISOString()
  };
}

const EXECUTION_EVENTS_CHANNEL = 'flowforge:execution-events';

function parseExecutionEvent(message: string): ExecutionEvent | null {
  try {
    const parsed = JSON.parse(message);
    return isExecutionEvent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isExecutionEvent(value: unknown): value is ExecutionEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'executionId' in value &&
    'workflowId' in value &&
    'timestamp' in value
  );
}
