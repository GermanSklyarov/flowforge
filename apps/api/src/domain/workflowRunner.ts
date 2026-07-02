import type { ExecutionRepository } from './executionRepository';
import { defaultNodeHandlers, type NodeHandlerRegistry, type NodeHandlerResult } from './nodeHandlers';
import type { WorkflowRecord } from './workflowRepository';
import type { WorkflowEdge, WorkflowNode } from './workflowValidation';

export type WorkflowRunnerInput = {
  executionId: string;
  workflow: WorkflowRecord;
  executionInput?: Record<string, unknown>;
  executionRepository: ExecutionRepository;
  nodeHandlers?: NodeHandlerRegistry;
};

export type WorkflowRunnerResult = {
  visitedNodeIds: string[];
};

export async function runWorkflowGraph(input: WorkflowRunnerInput): Promise<WorkflowRunnerResult> {
  const nodesById = new Map(input.workflow.definition.nodes.map((node) => [node.id, node]));
  const orderedNodes = topologicalSort(input.workflow.definition.nodes, input.workflow.definition.edges);
  const activeNodeIds = new Set(findStartNodeIds(input.workflow.definition.nodes, input.workflow.definition.edges));
  const outputsByNodeId = new Map<string, Record<string, unknown>>();
  const nodeHandlers = input.nodeHandlers ?? defaultNodeHandlers;
  const visitedNodeIds: string[] = [];

  await input.executionRepository.markRunning(input.executionId);

  try {
    for (const nodeId of orderedNodes) {
      const node = nodesById.get(nodeId);

      if (!activeNodeIds.has(nodeId)) {
        continue;
      }

      if (!node) {
        throw new Error(`Workflow references missing node "${nodeId}".`);
      }

      const inboundOutputs = collectInboundOutputs(
        node.id,
        input.workflow.definition.edges,
        outputsByNodeId
      );

      const nodeExecution = await input.executionRepository.startNode({
        executionId: input.executionId,
        nodeId: node.id,
        nodeType: node.type,
        input: {
          executionInput: input.executionInput ?? {},
          inboundOutputs,
          config: node.config ?? {}
        }
      });

      const result = await executeNode(node, {
        executionInput: input.executionInput ?? {},
        inboundOutputs,
        nodeHandlers
      });
      await input.executionRepository.completeNode(nodeExecution.id, result.output);
      outputsByNodeId.set(node.id, result.output);
      visitedNodeIds.push(node.id);
      activateNextNodes({
        activeNodeIds,
        edges: input.workflow.definition.edges,
        nodeId: node.id,
        selectedOutputPort: result.selectedOutputPort
      });
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

async function executeNode(
  node: WorkflowNode,
  input: {
    executionInput: Record<string, unknown>;
    inboundOutputs: Record<string, Record<string, unknown>>;
    nodeHandlers: NodeHandlerRegistry;
  }
): Promise<NodeHandlerResult> {
  const handler = input.nodeHandlers[node.type];

  if (!handler) {
    throw new Error(`No node handler registered for "${node.type}".`);
  }

  return handler({
    executionInput: input.executionInput,
    inboundOutputs: input.inboundOutputs,
    node
  });
}

function findStartNodeIds(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[] {
  const targetNodeIds = new Set(edges.map((edge) => edge.to));
  return nodes.filter((node) => !targetNodeIds.has(node.id)).map((node) => node.id);
}

function collectInboundOutputs(
  nodeId: string,
  edges: WorkflowEdge[],
  outputsByNodeId: Map<string, Record<string, unknown>>
): Record<string, Record<string, unknown>> {
  const inboundOutputs: Record<string, Record<string, unknown>> = {};

  for (const edge of edges) {
    if (edge.to !== nodeId) {
      continue;
    }

    const output = outputsByNodeId.get(edge.from);

    if (output) {
      inboundOutputs[edge.from] = output;
    }
  }

  return inboundOutputs;
}

function activateNextNodes(input: {
  activeNodeIds: Set<string>;
  edges: WorkflowEdge[];
  nodeId: string;
  selectedOutputPort?: string | undefined;
}): void {
  for (const edge of input.edges) {
    if (edge.from !== input.nodeId) {
      continue;
    }

    if (input.selectedOutputPort && edge.fromPort && edge.fromPort !== input.selectedOutputPort) {
      continue;
    }

    input.activeNodeIds.add(edge.to);
  }
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
