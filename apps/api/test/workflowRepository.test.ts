import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { InMemoryWorkflowRepository } from '../src/domain/workflowRepository';

describe('WorkflowRepository', () => {
  it('creates, lists, updates, and deletes workflows', async () => {
    const repository = new InMemoryWorkflowRepository();
    const created = await repository.create({
      definition: {
        name: 'Email summary',
        nodes: [{ id: 'email', type: 'source.email' }],
        edges: []
      }
    });

    assert.equal(created.name, 'Email summary');
    assert.equal(created.status, 'draft');
    assert.equal(created.version, 1);

    const list = await repository.list();
    assert.equal(list.length, 1);
    assert.equal(list[0]?.id, created.id);

    const updated = await repository.update(created.id, {
      definition: {
        name: 'Email summary v2',
        status: 'active',
        version: 2,
        nodes: [{ id: 'email', type: 'source.email' }],
        edges: []
      }
    });

    assert.equal(updated?.name, 'Email summary v2');
    assert.equal(updated?.status, 'active');
    assert.equal(updated?.version, 2);

    assert.equal(await repository.delete(created.id), true);
    assert.equal(await repository.findById(created.id), null);
  });
});
