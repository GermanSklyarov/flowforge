import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { InMemoryExecutionRepository } from '../src/domain/executionRepository';
import type { ExecutionEvent } from '../src/domain/executionEvents';
import { runWorkflowGraph } from '../src/domain/workflowRunner';
import { InMemoryWorkflowRepository } from '../src/domain/workflowRepository';

describe('execution events', () => {
  it('publishes workflow and node lifecycle events', async () => {
    const workflowRepository = new InMemoryWorkflowRepository();
    const executionRepository = new InMemoryExecutionRepository();
    const events: ExecutionEvent[] = [];
    const workflow = await workflowRepository.create({
      definition: {
        name: 'Realtime events',
        nodes: [{ id: 'email', type: 'source.email' }],
        edges: []
      }
    });
    const execution = await executionRepository.createQueued({ workflow });

    await runWorkflowGraph({
      executionId: execution.id,
      workflow,
      executionInput: execution.input,
      executionRepository,
      eventPublisher: {
        publish(event) {
          events.push(event);
        }
      }
    });

    assert.deepEqual(
      events.map((event) => event.type),
      ['execution.started', 'node.started', 'node.succeeded', 'execution.succeeded']
    );
    assert.equal(events[0]?.executionId, execution.id);
    assert.equal(events[0]?.workflowId, workflow.id);
  });
});
