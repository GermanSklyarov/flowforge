import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { InMemoryExecutionRepository } from '../src/domain/executionRepository';
import type { ExecutionEvent } from '../src/domain/executionEvents';
import type { LlmProvider } from '../src/domain/llmProvider';
import { createDefaultNodeHandlers } from '../src/domain/nodeHandlers';
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

  it('publishes streaming LLM deltas during node execution', async () => {
    const workflowRepository = new InMemoryWorkflowRepository();
    const executionRepository = new InMemoryExecutionRepository();
    const events: ExecutionEvent[] = [];
    const llmProvider: LlmProvider = {
      async generateText() {
        throw new Error('Unexpected generateText call.');
      },
      async *streamText() {
        yield {
          type: 'delta',
          text: 'Hello '
        };
        yield {
          type: 'delta',
          text: 'there'
        };
        yield {
          type: 'completed',
          model: 'stream-model',
          provider: 'test',
          usage: {
            inputTokens: 1,
            outputTokens: 2
          }
        };
      }
    };
    const workflow = await workflowRepository.create({
      definition: {
        name: 'Streaming events',
        nodes: [{ id: 'llm', type: 'ai.llm.stream' }],
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
      },
      nodeHandlers: createDefaultNodeHandlers({
        llmProvider
      })
    });

    assert.deepEqual(
      events.map((event) => event.type),
      [
        'execution.started',
        'node.started',
        'node.output.delta',
        'node.output.delta',
        'node.succeeded',
        'execution.succeeded'
      ]
    );
    assert.deepEqual(
      events
        .filter((event) => event.type === 'node.output.delta')
        .map((event) => event.text),
      ['Hello ', 'there']
    );
  });
});
