import type { LlmProvider } from './llmProvider';
import type { ToolRegistry } from './toolRegistry';

export type AgentRunInput = {
  name: string;
  task: string;
  context: Record<string, unknown>;
};

export type AgentRunResult = {
  name: string;
  output: Record<string, unknown>;
};

export type AgentContext = {
  task: string;
  context: Record<string, unknown>;
  llmProvider: LlmProvider;
  toolRegistry: ToolRegistry;
};

export type FlowForgeAgent = {
  name: string;
  description: string;
  run(context: AgentContext): Promise<Record<string, unknown>>;
};

export type AgentRegistry = Record<string, FlowForgeAgent>;

export function createDefaultAgentRegistry(): AgentRegistry {
  return {
    taskBreakdown: {
      name: 'taskBreakdown',
      description: 'Breaks a large task into concrete subtasks.',
      async run(context) {
        const result = await context.llmProvider.generateText({
          instruction:
            'Break the task into 3-7 actionable subtasks. Return JSON with a "subtasks" array of objects containing "title" and "description".',
          inputText: context.task,
          model: null
        });
        const parsed = parseSubtasks(result.text);

        return {
          task: context.task,
          subtasks: parsed.length > 0 ? parsed : createFallbackSubtasks(context.task),
          model: result.model,
          provider: result.provider,
          usage: result.usage
        };
      }
    }
  };
}

export async function runAgent(input: {
  agentRegistry: AgentRegistry;
  llmProvider: LlmProvider;
  toolRegistry: ToolRegistry;
  run: AgentRunInput;
}): Promise<AgentRunResult> {
  const agent = input.agentRegistry[input.run.name];

  if (!agent) {
    throw new Error(`Agent "${input.run.name}" is not registered.`);
  }

  return {
    name: agent.name,
    output: await agent.run({
      task: input.run.task,
      context: input.run.context,
      llmProvider: input.llmProvider,
      toolRegistry: input.toolRegistry
    })
  };
}

function parseSubtasks(text: string): Array<{ title: string; description: string }> {
  const payload = parseJsonObject(text);
  const subtasks = Array.isArray(payload?.subtasks) ? payload.subtasks : [];

  return subtasks.flatMap((item) => {
    if (!isRecord(item) || typeof item.title !== 'string') {
      return [];
    }

    return [
      {
        title: item.title,
        description: typeof item.description === 'string' ? item.description : ''
      }
    ];
  });
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function createFallbackSubtasks(task: string): Array<{ title: string; description: string }> {
  return [
    {
      title: `Clarify: ${task}`,
      description: 'Capture scope, acceptance criteria, and constraints.'
    },
    {
      title: `Implement: ${task}`,
      description: 'Build the smallest complete slice.'
    },
    {
      title: `Verify: ${task}`,
      description: 'Run checks and confirm the expected behavior.'
    }
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
