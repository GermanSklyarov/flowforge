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
});
