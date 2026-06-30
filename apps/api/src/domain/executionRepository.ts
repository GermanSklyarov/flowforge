import { randomUUID } from 'node:crypto';
import type { WorkflowRecord } from './workflowRepository';

export type ExecutionStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
export type NodeExecutionStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped';

export type ExecutionRecord = {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  queuedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NodeExecutionRecord = {
  id: string;
  executionId: string;
  nodeId: string;
  nodeType: string;
  status: NodeExecutionStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateExecutionInput = {
  workflow: WorkflowRecord;
  input?: Record<string, unknown>;
};

export type StartNodeExecutionInput = {
  executionId: string;
  nodeId: string;
  nodeType: string;
  input?: Record<string, unknown>;
};

export type ExecutionRepository = {
  createQueued(input: CreateExecutionInput): Promise<ExecutionRecord>;
  findById(id: string): Promise<ExecutionRecord | null>;
  listByWorkflowId(workflowId: string): Promise<ExecutionRecord[]>;
  markRunning(id: string): Promise<ExecutionRecord | null>;
  markSucceeded(id: string, output: Record<string, unknown>): Promise<ExecutionRecord | null>;
  markFailed(id: string, error: string): Promise<ExecutionRecord | null>;
  startNode(input: StartNodeExecutionInput): Promise<NodeExecutionRecord>;
  completeNode(id: string, output: Record<string, unknown>): Promise<NodeExecutionRecord | null>;
  failNode(id: string, error: string): Promise<NodeExecutionRecord | null>;
  listNodesByExecutionId(executionId: string): Promise<NodeExecutionRecord[]>;
};

export class InMemoryExecutionRepository implements ExecutionRepository {
  readonly #executions = new Map<string, ExecutionRecord>();
  readonly #nodeExecutions = new Map<string, NodeExecutionRecord>();

  async createQueued(input: CreateExecutionInput): Promise<ExecutionRecord> {
    const now = new Date();
    const record: ExecutionRecord = {
      id: randomUUID(),
      workflowId: input.workflow.id,
      status: 'queued',
      input: input.input ?? {},
      output: null,
      error: null,
      queuedAt: now,
      startedAt: null,
      finishedAt: null,
      createdAt: now,
      updatedAt: now
    };

    this.#executions.set(record.id, record);
    return record;
  }

  async findById(id: string): Promise<ExecutionRecord | null> {
    return this.#executions.get(id) ?? null;
  }

  async listByWorkflowId(workflowId: string): Promise<ExecutionRecord[]> {
    return [...this.#executions.values()]
      .filter((execution) => execution.workflowId === workflowId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  async markRunning(id: string): Promise<ExecutionRecord | null> {
    return this.#updateExecution(id, {
      status: 'running',
      startedAt: new Date()
    });
  }

  async markSucceeded(
    id: string,
    output: Record<string, unknown>
  ): Promise<ExecutionRecord | null> {
    return this.#updateExecution(id, {
      status: 'succeeded',
      output,
      finishedAt: new Date()
    });
  }

  async markFailed(id: string, error: string): Promise<ExecutionRecord | null> {
    return this.#updateExecution(id, {
      status: 'failed',
      error,
      finishedAt: new Date()
    });
  }

  async startNode(input: StartNodeExecutionInput): Promise<NodeExecutionRecord> {
    const now = new Date();
    const record: NodeExecutionRecord = {
      id: randomUUID(),
      executionId: input.executionId,
      nodeId: input.nodeId,
      nodeType: input.nodeType,
      status: 'running',
      input: input.input ?? {},
      output: null,
      error: null,
      startedAt: now,
      finishedAt: null,
      createdAt: now,
      updatedAt: now
    };

    this.#nodeExecutions.set(record.id, record);
    return record;
  }

  async completeNode(
    id: string,
    output: Record<string, unknown>
  ): Promise<NodeExecutionRecord | null> {
    return this.#updateNode(id, {
      status: 'succeeded',
      output,
      finishedAt: new Date()
    });
  }

  async failNode(id: string, error: string): Promise<NodeExecutionRecord | null> {
    return this.#updateNode(id, {
      status: 'failed',
      error,
      finishedAt: new Date()
    });
  }

  async listNodesByExecutionId(executionId: string): Promise<NodeExecutionRecord[]> {
    return [...this.#nodeExecutions.values()]
      .filter((nodeExecution) => nodeExecution.executionId === executionId)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  }

  #updateExecution(
    id: string,
    patch: Partial<Pick<ExecutionRecord, 'error' | 'finishedAt' | 'output' | 'startedAt' | 'status'>>
  ): ExecutionRecord | null {
    const current = this.#executions.get(id);

    if (!current) {
      return null;
    }

    const next = {
      ...current,
      ...patch,
      updatedAt: new Date()
    };

    this.#executions.set(id, next);
    return next;
  }

  #updateNode(
    id: string,
    patch: Partial<Pick<NodeExecutionRecord, 'error' | 'finishedAt' | 'output' | 'status'>>
  ): NodeExecutionRecord | null {
    const current = this.#nodeExecutions.get(id);

    if (!current) {
      return null;
    }

    const next = {
      ...current,
      ...patch,
      updatedAt: new Date()
    };

    this.#nodeExecutions.set(id, next);
    return next;
  }
}

