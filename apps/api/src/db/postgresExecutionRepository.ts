import type pg from 'pg';
import type {
  CreateExecutionInput,
  ExecutionRecord,
  ExecutionRepository,
  ExecutionStatus,
  NodeExecutionRecord,
  NodeExecutionStatus,
  StartNodeExecutionInput
} from '../domain/executionRepository';

type ExecutionRow = {
  id: string;
  workflow_id: string;
  status: ExecutionStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  queued_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type NodeExecutionRow = {
  id: string;
  execution_id: string;
  node_id: string;
  node_type: string;
  status: NodeExecutionStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  started_at: Date | null;
  finished_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export class PostgresExecutionRepository implements ExecutionRepository {
  readonly #pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.#pool = pool;
  }

  async createQueued(input: CreateExecutionInput): Promise<ExecutionRecord> {
    const result = await this.#pool.query<ExecutionRow>(
      `
        insert into workflow_executions (workflow_id, status, input)
        values ($1, 'queued', $2)
        returning *
      `,
      [input.workflow.id, JSON.stringify(input.input ?? {})]
    );

    return mapExecutionRow(requireExecutionRow(result));
  }

  async findById(id: string): Promise<ExecutionRecord | null> {
    const result = await this.#pool.query<ExecutionRow>(
      'select * from workflow_executions where id = $1',
      [id]
    );

    return result.rows[0] ? mapExecutionRow(result.rows[0]) : null;
  }

  async listByWorkflowId(workflowId: string): Promise<ExecutionRecord[]> {
    const result = await this.#pool.query<ExecutionRow>(
      `
        select *
        from workflow_executions
        where workflow_id = $1
        order by created_at desc
      `,
      [workflowId]
    );

    return result.rows.map(mapExecutionRow);
  }

  async markRunning(id: string): Promise<ExecutionRecord | null> {
    return this.#updateExecution(id, 'running', {
      startedAt: new Date()
    });
  }

  async markSucceeded(
    id: string,
    output: Record<string, unknown>
  ): Promise<ExecutionRecord | null> {
    return this.#updateExecution(id, 'succeeded', {
      output,
      finishedAt: new Date()
    });
  }

  async markFailed(id: string, error: string): Promise<ExecutionRecord | null> {
    return this.#updateExecution(id, 'failed', {
      error,
      finishedAt: new Date()
    });
  }

  async startNode(input: StartNodeExecutionInput): Promise<NodeExecutionRecord> {
    const result = await this.#pool.query<NodeExecutionRow>(
      `
        insert into workflow_node_executions (
          execution_id,
          node_id,
          node_type,
          status,
          input,
          started_at
        )
        values ($1, $2, $3, 'running', $4, now())
        returning *
      `,
      [input.executionId, input.nodeId, input.nodeType, JSON.stringify(input.input ?? {})]
    );

    return mapNodeExecutionRow(requireNodeExecutionRow(result));
  }

  async completeNode(
    id: string,
    output: Record<string, unknown>
  ): Promise<NodeExecutionRecord | null> {
    const result = await this.#pool.query<NodeExecutionRow>(
      `
        update workflow_node_executions
        set status = 'succeeded', output = $2, finished_at = now(), updated_at = now()
        where id = $1
        returning *
      `,
      [id, JSON.stringify(output)]
    );

    return result.rows[0] ? mapNodeExecutionRow(result.rows[0]) : null;
  }

  async failNode(id: string, error: string): Promise<NodeExecutionRecord | null> {
    const result = await this.#pool.query<NodeExecutionRow>(
      `
        update workflow_node_executions
        set status = 'failed', error = $2, finished_at = now(), updated_at = now()
        where id = $1
        returning *
      `,
      [id, error]
    );

    return result.rows[0] ? mapNodeExecutionRow(result.rows[0]) : null;
  }

  async listNodesByExecutionId(executionId: string): Promise<NodeExecutionRecord[]> {
    const result = await this.#pool.query<NodeExecutionRow>(
      `
        select *
        from workflow_node_executions
        where execution_id = $1
        order by created_at asc
      `,
      [executionId]
    );

    return result.rows.map(mapNodeExecutionRow);
  }

  async #updateExecution(
    id: string,
    status: ExecutionStatus,
    patch: {
      error?: string;
      finishedAt?: Date;
      output?: Record<string, unknown>;
      startedAt?: Date;
    }
  ): Promise<ExecutionRecord | null> {
    const result = await this.#pool.query<ExecutionRow>(
      `
        update workflow_executions
        set
          status = $2,
          output = coalesce($3, output),
          error = coalesce($4, error),
          started_at = coalesce($5, started_at),
          finished_at = coalesce($6, finished_at),
          updated_at = now()
        where id = $1
        returning *
      `,
      [
        id,
        status,
        patch.output ? JSON.stringify(patch.output) : null,
        patch.error ?? null,
        patch.startedAt ?? null,
        patch.finishedAt ?? null
      ]
    );

    return result.rows[0] ? mapExecutionRow(result.rows[0]) : null;
  }
}

function mapExecutionRow(row: ExecutionRow): ExecutionRecord {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    status: row.status,
    input: row.input,
    output: row.output,
    error: row.error,
    queuedAt: row.queued_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapNodeExecutionRow(row: NodeExecutionRow): NodeExecutionRecord {
  return {
    id: row.id,
    executionId: row.execution_id,
    nodeId: row.node_id,
    nodeType: row.node_type,
    status: row.status,
    input: row.input,
    output: row.output,
    error: row.error,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function requireExecutionRow(result: pg.QueryResult<ExecutionRow>): ExecutionRow {
  const row = result.rows[0];

  if (!row) {
    throw new Error('Expected database query to return an execution row.');
  }

  return row;
}

function requireNodeExecutionRow(result: pg.QueryResult<NodeExecutionRow>): NodeExecutionRow {
  const row = result.rows[0];

  if (!row) {
    throw new Error('Expected database query to return a node execution row.');
  }

  return row;
}
