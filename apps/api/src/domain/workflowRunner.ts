import type { ExecutionRepository } from './executionRepository';
import {
  createExecutionEventBase,
  type ExecutionEventPublisher
} from './executionEvents';
import { resolveNodeExecutionPolicy, type NodeExecutionPolicy } from './nodeExecutionPolicy';
import { defaultNodeHandlers, type NodeHandlerRegistry, type NodeHandlerResult } from './nodeHandlers';
import type { WorkflowRecord } from './workflowRepository';
import type { WorkflowEdge, WorkflowNode } from './workflowValidation';

export type WorkflowRunnerInput = {
  executionId: string;
  workflow: WorkflowRecord;
  executionInput?: Record<string, unknown>;
  executionRepository: ExecutionRepository;
  eventPublisher?: ExecutionEventPublisher;
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
  input.eventPublisher?.publish({
    type: 'execution.started',
    ...createExecutionEventBase({
      executionId: input.executionId,
      workflowId: input.workflow.id
    })
  });

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
      const policy = resolveNodeExecutionPolicy(node);

      const nodeExecution = await input.executionRepository.startNode({
        executionId: input.executionId,
        nodeId: node.id,
        nodeType: node.type,
        input: {
          executionInput: input.executionInput ?? {},
          inboundOutputs,
          config: node.config ?? {},
          policy
        }
      });
      input.eventPublisher?.publish({
        type: 'node.started',
        nodeId: node.id,
        nodeType: node.type,
        ...createExecutionEventBase({
          executionId: input.executionId,
          workflowId: input.workflow.id
        })
      });

      const result = await runNodeWithPolicy(
        node,
        {
          executionInput: input.executionInput ?? {},
          inboundOutputs,
          nodeHandlers
        },
        policy
      ).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : 'Workflow node execution failed.';
        await input.executionRepository.failNode(nodeExecution.id, message);
        input.eventPublisher?.publish({
          type: 'node.failed',
          nodeId: node.id,
          nodeType: node.type,
          error: message,
          ...createExecutionEventBase({
            executionId: input.executionId,
            workflowId: input.workflow.id
          })
        });
        throw error;
      });

      const nodeOutput = {
        ...result.output,
        attempts: result.attempts
      };
      await input.executionRepository.completeNode(nodeExecution.id, nodeOutput);
      input.eventPublisher?.publish({
        type: 'node.succeeded',
        nodeId: node.id,
        nodeType: node.type,
        output: nodeOutput,
        ...createExecutionEventBase({
          executionId: input.executionId,
          workflowId: input.workflow.id
        })
      });
      outputsByNodeId.set(node.id, result.output);
      visitedNodeIds.push(node.id);
      activateNextNodes({
        activeNodeIds,
        edges: input.workflow.definition.edges,
        nodeId: node.id,
        selectedOutputPort: result.selectedOutputPort
      });
    }

    const output = {
      visitedNodeIds
    };
    await input.executionRepository.markSucceeded(input.executionId, output);
    input.eventPublisher?.publish({
      type: 'execution.succeeded',
      output,
      ...createExecutionEventBase({
        executionId: input.executionId,
        workflowId: input.workflow.id
      })
    });

    return { visitedNodeIds };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Workflow execution failed.';
    await input.executionRepository.markFailed(
      input.executionId,
      message
    );
    input.eventPublisher?.publish({
      type: 'execution.failed',
      error: message,
      ...createExecutionEventBase({
        executionId: input.executionId,
        workflowId: input.workflow.id
      })
    });
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

async function runNodeWithPolicy(
  node: WorkflowNode,
  input: {
    executionInput: Record<string, unknown>;
    inboundOutputs: Record<string, Record<string, unknown>>;
    nodeHandlers: NodeHandlerRegistry;
  },
  policy: NodeExecutionPolicy
): Promise<NodeHandlerResult & { attempts: number }> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    try {
      const result = await withTimeout(executeNode(node, input), policy.timeoutMs, node.id);
      return {
        ...result,
        attempts: attempt
      };
    } catch (error) {
      lastError = error;

      if (attempt === policy.maxAttempts) {
        break;
      }

      await sleep(policy.retryDelayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Workflow node execution failed.');
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, nodeId: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`Node "${nodeId}" timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function sleep(delayMs: number): Promise<void> {
  if (delayMs === 0) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, delayMs);
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
