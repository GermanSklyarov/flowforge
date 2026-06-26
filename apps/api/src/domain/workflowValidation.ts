import { findNodeDefinition } from './nodeCatalog.ts';

export type WorkflowNode = {
  id: string;
  type: string;
  name?: string;
  config?: Record<string, unknown>;
};

export type WorkflowEdge = {
  from: string;
  to: string;
  fromPort?: string;
  toPort?: string;
};

export type WorkflowDefinition = {
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  version?: number;
  status?: 'draft' | 'active' | 'archived';
};

export type ValidationError = {
  path: string;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
};

export function validateWorkflow(workflow: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!isRecord(workflow)) {
    return {
      valid: false,
      errors: [{ path: '$', message: 'Workflow must be an object.' }]
    };
  }

  if (!isNonEmptyString(workflow.name)) {
    errors.push({ path: 'name', message: 'Workflow name is required.' });
  }

  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
  const edges = Array.isArray(workflow.edges) ? workflow.edges : [];

  if (!Array.isArray(workflow.nodes)) {
    errors.push({ path: 'nodes', message: 'Workflow nodes must be an array.' });
  }

  if (!Array.isArray(workflow.edges)) {
    errors.push({ path: 'edges', message: 'Workflow edges must be an array.' });
  }

  if (nodes.length === 0) {
    errors.push({ path: 'nodes', message: 'Workflow must contain at least one node.' });
  }

  const nodeIds = new Set<string>();

  for (const [index, node] of nodes.entries()) {
    if (!isRecord(node)) {
      errors.push({ path: `nodes.${index}`, message: 'Node must be an object.' });
      continue;
    }

    if (!isNonEmptyString(node.id)) {
      errors.push({ path: `nodes.${index}.id`, message: 'Node id is required.' });
    } else if (nodeIds.has(node.id)) {
      errors.push({ path: `nodes.${index}.id`, message: `Duplicate node id "${node.id}".` });
    } else {
      nodeIds.add(node.id);
    }

    if (!isNonEmptyString(node.type)) {
      errors.push({ path: `nodes.${index}.type`, message: 'Node type is required.' });
    } else if (!findNodeDefinition(node.type)) {
      errors.push({ path: `nodes.${index}.type`, message: `Unknown node type "${node.type}".` });
    }
  }

  for (const [index, edge] of edges.entries()) {
    if (!isRecord(edge)) {
      errors.push({ path: `edges.${index}`, message: 'Edge must be an object.' });
      continue;
    }

    if (!isNonEmptyString(edge.from)) {
      errors.push({ path: `edges.${index}.from`, message: 'Edge source node id is required.' });
    } else if (!nodeIds.has(edge.from)) {
      errors.push({ path: `edges.${index}.from`, message: `Unknown source node "${edge.from}".` });
    }

    if (!isNonEmptyString(edge.to)) {
      errors.push({ path: `edges.${index}.to`, message: 'Edge target node id is required.' });
    } else if (!nodeIds.has(edge.to)) {
      errors.push({ path: `edges.${index}.to`, message: `Unknown target node "${edge.to}".` });
    }
  }

  if (errors.length === 0 && hasCycle(nodes as WorkflowNode[], edges as WorkflowEdge[])) {
    errors.push({ path: 'edges', message: 'Workflow graph must not contain cycles.' });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasCycle(nodes: WorkflowNode[], edges: WorkflowEdge[]): boolean {
  const graph = new Map<string, string[]>(nodes.map((node) => [node.id, []]));

  for (const edge of edges) {
    graph.get(edge.from)?.push(edge.to);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(nodeId: string): boolean {
    if (visiting.has(nodeId)) {
      return true;
    }

    if (visited.has(nodeId)) {
      return false;
    }

    visiting.add(nodeId);

    for (const nextNodeId of graph.get(nodeId) ?? []) {
      if (visit(nextNodeId)) {
        return true;
      }
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  }

  return nodes.some((node) => visit(node.id));
}

