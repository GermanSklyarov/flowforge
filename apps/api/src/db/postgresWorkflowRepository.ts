import type pg from 'pg';
import {
  normalizeDefinition,
  type CreateWorkflowInput,
  type UpdateWorkflowInput,
  type WorkflowRecord,
  type WorkflowRepository,
  type WorkflowStatus
} from '../domain/workflowRepository';
import type { WorkflowDefinition } from '../domain/workflowValidation';

type WorkflowRow = {
  id: string;
  name: string;
  status: WorkflowStatus;
  version: number;
  definition: WorkflowDefinition;
  created_at: Date;
  updated_at: Date;
};

export class PostgresWorkflowRepository implements WorkflowRepository {
  readonly #pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.#pool = pool;
  }

  async create(input: CreateWorkflowInput): Promise<WorkflowRecord> {
    const definition = normalizeDefinition(input.definition);
    const result = await this.#pool.query<WorkflowRow>(
      `
        insert into workflows (name, status, version, definition)
        values ($1, $2, $3, $4)
        returning id, name, status, version, definition, created_at, updated_at
      `,
      [definition.name, definition.status, definition.version, JSON.stringify(definition)]
    );

    return mapWorkflowRow(requireRow(result));
  }

  async list(): Promise<WorkflowRecord[]> {
    const result = await this.#pool.query<WorkflowRow>(`
      select id, name, status, version, definition, created_at, updated_at
      from workflows
      order by updated_at desc
    `);

    return result.rows.map(mapWorkflowRow);
  }

  async findById(id: string): Promise<WorkflowRecord | null> {
    const result = await this.#pool.query<WorkflowRow>(
      `
        select id, name, status, version, definition, created_at, updated_at
        from workflows
        where id = $1
      `,
      [id]
    );

    return result.rows[0] ? mapWorkflowRow(result.rows[0]) : null;
  }

  async update(id: string, input: UpdateWorkflowInput): Promise<WorkflowRecord | null> {
    const definition = normalizeDefinition(input.definition);
    const result = await this.#pool.query<WorkflowRow>(
      `
        update workflows
        set
          name = $2,
          status = $3,
          version = $4,
          definition = $5,
          updated_at = now()
        where id = $1
        returning id, name, status, version, definition, created_at, updated_at
      `,
      [id, definition.name, definition.status, definition.version, JSON.stringify(definition)]
    );

    return result.rows[0] ? mapWorkflowRow(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.#pool.query('delete from workflows where id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}

function mapWorkflowRow(row: WorkflowRow): WorkflowRecord {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    version: row.version,
    definition: row.definition,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function requireRow(result: pg.QueryResult<WorkflowRow>): WorkflowRow {
  const row = result.rows[0];

  if (!row) {
    throw new Error('Expected database query to return a workflow row.');
  }

  return row;
}
