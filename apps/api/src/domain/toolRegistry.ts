import { randomUUID } from 'node:crypto';

export type ToolCallInput = {
  name: string;
  arguments: Record<string, unknown>;
};

export type ToolCallResult = {
  name: string;
  result: Record<string, unknown>;
};

export type FlowForgeTool = {
  name: string;
  description: string;
  execute(arguments_: Record<string, unknown>): Promise<Record<string, unknown>>;
};

export type ToolRegistry = Record<string, FlowForgeTool>;

export const defaultToolRegistry: ToolRegistry = {
  createTask: {
    name: 'createTask',
    description: 'Creates a task in FlowForge.',
    async execute(arguments_) {
      const title = readString(arguments_.title) ?? 'Untitled task';
      const description = readString(arguments_.description);

      return {
        task: {
          id: `task_${randomUUID()}`,
          title,
          description,
          status: 'created'
        }
      };
    }
  },
  searchUsers: {
    name: 'searchUsers',
    description: 'Searches FlowForge users by query.',
    async execute(arguments_) {
      const query = readString(arguments_.query) ?? '';

      return {
        users: query.trim()
          ? [
              {
                id: 'user_demo',
                name: 'Demo User',
                email: 'demo@flowforge.local'
              }
            ]
          : []
      };
    }
  }
};

export async function callTool(
  registry: ToolRegistry,
  input: ToolCallInput
): Promise<ToolCallResult> {
  const tool = registry[input.name];

  if (!tool) {
    throw new Error(`Tool "${input.name}" is not registered.`);
  }

  return {
    name: tool.name,
    result: await tool.execute(input.arguments)
  };
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}
