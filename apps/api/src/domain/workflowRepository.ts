import { randomUUID } from 'node:crypto';
import type { WorkflowDefinition } from './workflowValidation';

export type WorkflowStatus = 'draft' | 'active' | 'archived';

export type WorkflowRecord = {
  id: string;
  name: string;
  status: WorkflowStatus;
  version: number;
  definition: WorkflowDefinition;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateWorkflowInput = {
  definition: WorkflowDefinition;
};

export type UpdateWorkflowInput = {
  definition: WorkflowDefinition;
};

export type WorkflowRepository = {
  create(input: CreateWorkflowInput): Promise<WorkflowRecord>;
  list(): Promise<WorkflowRecord[]>;
  findById(id: string): Promise<WorkflowRecord | null>;
  update(id: string, input: UpdateWorkflowInput): Promise<WorkflowRecord | null>;
  delete(id: string): Promise<boolean>;
};

export class InMemoryWorkflowRepository implements WorkflowRepository {
  readonly #records = new Map<string, WorkflowRecord>();

  async create(input: CreateWorkflowInput): Promise<WorkflowRecord> {
    const now = new Date();
    const definition = normalizeDefinition(input.definition);
    const record: WorkflowRecord = {
      id: randomUUID(),
      name: definition.name,
      status: definition.status,
      version: definition.version,
      definition,
      createdAt: now,
      updatedAt: now
    };

    this.#records.set(record.id, record);
    return record;
  }

  async list(): Promise<WorkflowRecord[]> {
    return [...this.#records.values()].sort((left, right) => {
      return right.updatedAt.getTime() - left.updatedAt.getTime();
    });
  }

  async findById(id: string): Promise<WorkflowRecord | null> {
    return this.#records.get(id) ?? null;
  }

  async update(id: string, input: UpdateWorkflowInput): Promise<WorkflowRecord | null> {
    const current = this.#records.get(id);

    if (!current) {
      return null;
    }

    const definition = normalizeDefinition({
      ...input.definition,
      version: input.definition.version ?? current.version + 1
    });
    const next: WorkflowRecord = {
      ...current,
      name: definition.name,
      status: definition.status,
      version: definition.version,
      definition,
      updatedAt: new Date()
    };

    this.#records.set(id, next);
    return next;
  }

  async delete(id: string): Promise<boolean> {
    return this.#records.delete(id);
  }
}

export function normalizeDefinition(definition: WorkflowDefinition): WorkflowDefinition & {
  status: WorkflowStatus;
  version: number;
} {
  return {
    ...definition,
    status: definition.status ?? 'draft',
    version: definition.version ?? 1
  };
}
