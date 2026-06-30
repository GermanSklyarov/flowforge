import type { ExecutionRepository } from './executionRepository';
import type { WorkflowRecord } from './workflowRepository';
import type { WorkflowEdge, WorkflowNode } from './workflowValidation';

export type WorkflowRunnerInput = {
  executionId: string;
  workflow: WorkflowRecord;
  executionInput?: Record<string, unknown>;
  executionRepository: ExecutionRepository;
};

export type WorkflowRunnerResult = {
  visitedNodeIds: string[];
};

export async function runWorkflowGraph(input: WorkflowRunnerInput): Promise<WorkflowRunnerResult> {
  const nodesById = new Map(input.workflow.definition.nodes.map((node) => [node.id, node]));
  const orderedNodes = topologicalSort(input.workflow.definition.nodes, input.workflow.definition.edges);
  const visitedNodeIds: string[] = [];

  await input.executionRepository.markRunning(input.executionId);

  try {
    for (const nodeId of orderedNodes) {
      const node = nodesById.get(nodeId);

      if (!node) {
        throw new Error(`Workflow references missing node "${nodeId}".`);
      }

      const nodeExecution = await input.executionRepository.startNode({
        executionId: input.executionId,
        nodeId: node.id,
        nodeType: node.type,
        input: {
          executionInput: input.executionInput ?? {},
          config: node.config ?? {}
        }
      });

      const output = executeNode(node);
      await input.executionRepository.completeNode(nodeExecution.id, output);
      visitedNodeIds.push(node.id);
    }

    await input.executionRepository.markSucceeded(input.executionId, {
      visitedNodeIds
    });

    return { visitedNodeIds };
  } catch (error) {
    await input.executionRepository.markFailed(
      input.executionId,
      error instanceof Error ? error.message : 'Workflow execution failed.'
    );
    throw error;
  }
}

function executeNode(node: WorkflowNode): Record<string, unknown> {
  return {
    nodeId: node.id,
    nodeType: node.type,
    status: 'completed'
  };
}

function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[] {
  const incomingCount = new Map(nodes.map((node) => [node.id, 0]));
  const outgoingEdges = new Map<string, string[]>(nodes.map((node) => [node.id, []]));

  for (const edge of edges) {
    incomingCount.set(edge.to, (incomingCount.get(edge.to) ?? 0) + 1);
    outgoingEdges.get(edge.from)?.push(edge.to);
  }

  const queue = nodes
    .filter((node) => incomingCount.get(node.id) === 0)
    .map((node) => node.id);
  const ordered: string[] = [];

  while (queue.length > 0) {
    const nodeId = queue.shift();

    if (!nodeId) {
      continue;
    }

    ordered.push(nodeId);

    for (const targetNodeId of outgoingEdges.get(nodeId) ?? []) {
      const nextIncomingCount = (incomingCount.get(targetNodeId) ?? 0) - 1;
      incomingCount.set(targetNodeId, nextIncomingCount);

      if (nextIncomingCount === 0) {
        queue.push(targetNodeId);
      }
    }
  }

  if (ordered.length !== nodes.length) {
    throw new Error('Workflow graph contains a cycle.');
  }

  return ordered;
}

