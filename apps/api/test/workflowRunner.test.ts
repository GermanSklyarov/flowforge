import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { InMemoryExecutionRepository } from '../src/domain/executionRepository';
import { runWorkflowGraph } from '../src/domain/workflowRunner';
import { InMemoryWorkflowRepository } from '../src/domain/workflowRepository';

describe('runWorkflowGraph', () => {
  it('executes workflow nodes in topological order and stores node history', async () => {
    const workflowRepository = new InMemoryWorkflowRepository();
    const executionRepository = new InMemoryExecutionRepository();
    const workflow = await workflowRepository.create({
      definition: {
        name: 'Email summary',
        nodes: [
          { id: 'email', type: 'source.email' },
          { id: 'extract', type: 'transform.extractText' },
          { id: 'llm', type: 'ai.llm' }
        ],
        edges: [
          { from: 'email', to: 'extract' },
          { from: 'extract', to: 'llm' }
        ]
      }
    });
    const execution = await executionRepository.createQueued({
      workflow,
      input: { messageId: 'msg_123' }
    });

    const result = await runWorkflowGraph({
      executionId: execution.id,
      workflow,
      executionInput: execution.input,
      executionRepository
    });

    const finishedExecution = await executionRepository.findById(execution.id);
    const nodeExecutions = await executionRepository.listNodesByExecutionId(execution.id);

    assert.deepEqual(result.visitedNodeIds, ['email', 'extract', 'llm']);
    assert.equal(finishedExecution?.status, 'succeeded');
    assert.deepEqual(finishedExecution?.output?.visitedNodeIds, ['email', 'extract', 'llm']);
    assert.deepEqual(
      nodeExecutions.map((nodeExecution) => nodeExecution.nodeId),
      ['email', 'extract', 'llm']
    );
    assert.deepEqual(
      nodeExecutions.map((nodeExecution) => nodeExecution.status),
      ['succeeded', 'succeeded', 'succeeded']
    );
  });

  it('routes decision nodes through the selected output port', async () => {
    const workflowRepository = new InMemoryWorkflowRepository();
    const executionRepository = new InMemoryExecutionRepository();
    const workflow = await workflowRepository.create({
      definition: {
        name: 'Decision routing',
        nodes: [
          { id: 'email', type: 'source.email' },
          { id: 'decision', type: 'logic.decision', config: { route: 'false' } },
          { id: 'task', type: 'task.create' },
          { id: 'telegram', type: 'notification.telegram' }
        ],
        edges: [
          { from: 'email', to: 'decision' },
          { from: 'decision', fromPort: 'true', to: 'task' },
          { from: 'decision', fromPort: 'false', to: 'telegram' }
        ]
      }
    });
    const execution = await executionRepository.createQueued({
      workflow,
      input: { message: 'Please notify the team.' }
    });

    const result = await runWorkflowGraph({
      executionId: execution.id,
      workflow,
      executionInput: execution.input,
      executionRepository
    });

    const nodeExecutions = await executionRepository.listNodesByExecutionId(execution.id);

    assert.deepEqual(result.visitedNodeIds, ['email', 'decision', 'telegram']);
    assert.deepEqual(
      nodeExecutions.map((nodeExecution) => nodeExecution.nodeId),
      ['email', 'decision', 'telegram']
    );
    assert.equal(
      nodeExecutions.find((nodeExecution) => nodeExecution.nodeId === 'decision')?.output
        ?.selectedOutputPort,
      'false'
    );
  });

  it('retries failed nodes according to node retry policy', async () => {
    const workflowRepository = new InMemoryWorkflowRepository();
    const executionRepository = new InMemoryExecutionRepository();
    const workflow = await workflowRepository.create({
      definition: {
        name: 'Retry policy',
        nodes: [
          {
            id: 'llm',
            type: 'ai.llm',
            config: {
              retry: {
                maxAttempts: 2,
                delayMs: 0
              }
            }
          }
        ],
        edges: []
      }
    });
    const execution = await executionRepository.createQueued({ workflow });
    let attempts = 0;

    await runWorkflowGraph({
      executionId: execution.id,
      workflow,
      executionInput: execution.input,
      executionRepository,
      nodeHandlers: {
        'ai.llm': async () => {
          attempts += 1;

          if (attempts === 1) {
            throw new Error('Temporary provider failure.');
          }

          return {
            output: {
              response: 'ok'
            }
          };
        }
      }
    });

    const nodeExecutions = await executionRepository.listNodesByExecutionId(execution.id);

    assert.equal(attempts, 2);
    assert.equal(nodeExecutions[0]?.status, 'succeeded');
    assert.equal(nodeExecutions[0]?.output?.attempts, 2);
    assert.equal(nodeExecutions[0]?.output?.response, 'ok');
  });

  it('fails timed out nodes and marks workflow execution as failed', async () => {
    const workflowRepository = new InMemoryWorkflowRepository();
    const executionRepository = new InMemoryExecutionRepository();
    const workflow = await workflowRepository.create({
      definition: {
        name: 'Timeout policy',
        nodes: [
          {
            id: 'slow',
            type: 'ai.llm',
            config: {
              timeoutMs: 1
            }
          }
        ],
        edges: []
      }
    });
    const execution = await executionRepository.createQueued({ workflow });

    await assert.rejects(
      runWorkflowGraph({
        executionId: execution.id,
        workflow,
        executionInput: execution.input,
        executionRepository,
        nodeHandlers: {
          'ai.llm': async () => {
            await new Promise((resolve) => {
              setTimeout(resolve, 25);
            });

            return {
              output: {
                response: 'too late'
              }
            };
          }
        }
      }),
      /timed out/
    );

    const finishedExecution = await executionRepository.findById(execution.id);
    const nodeExecutions = await executionRepository.listNodesByExecutionId(execution.id);

    assert.equal(finishedExecution?.status, 'failed');
    assert.match(finishedExecution?.error ?? '', /timed out/);
    assert.equal(nodeExecutions[0]?.status, 'failed');
    assert.match(nodeExecutions[0]?.error ?? '', /timed out/);
  });
});
