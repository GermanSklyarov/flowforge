import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateWorkflow } from '../src/domain/workflowValidation.ts';

describe('validateWorkflow', () => {
  it('accepts a valid directed workflow', () => {
    const result = validateWorkflow({
      name: 'Email summary',
      nodes: [
        { id: 'email', type: 'source.email' },
        { id: 'extract', type: 'transform.extractText' },
        { id: 'llm', type: 'ai.llm' },
        { id: 'task', type: 'task.create' },
        { id: 'telegram', type: 'notification.telegram' }
      ],
      edges: [
        { from: 'email', to: 'extract' },
        { from: 'extract', to: 'llm' },
        { from: 'llm', to: 'task' },
        { from: 'task', to: 'telegram' }
      ]
    });

    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  it('rejects unknown node types', () => {
    const result = validateWorkflow({
      name: 'Broken workflow',
      nodes: [{ id: 'first', type: 'unknown.node' }],
      edges: []
    });

    assert.equal(result.valid, false);
    assert.match(result.errors[0]?.message ?? '', /Unknown node type/);
  });

  it('rejects cycles', () => {
    const result = validateWorkflow({
      name: 'Cyclic workflow',
      nodes: [
        { id: 'a', type: 'trigger.webhook' },
        { id: 'b', type: 'ai.llm' }
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' }
      ]
    });

    assert.equal(result.valid, false);
    assert.match(result.errors[0]?.message ?? '', /cycles/);
  });
});

