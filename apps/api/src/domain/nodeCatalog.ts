export type NodeDefinition = {
  type: string;
  label: string;
  group: string;
  description: string;
  inputs: readonly string[];
  outputs: readonly string[];
};

export const nodeCatalog = [
  {
    type: 'trigger.webhook',
    label: 'Webhook',
    group: 'Triggers',
    description: 'Starts a workflow from an inbound HTTP request.',
    inputs: [],
    outputs: ['payload']
  },
  {
    type: 'source.email',
    label: 'Email',
    group: 'Sources',
    description: 'Receives or imports an email message.',
    inputs: [],
    outputs: ['message']
  },
  {
    type: 'transform.extractText',
    label: 'Extract Text',
    group: 'Transforms',
    description: 'Extracts plain text from an inbound document or message.',
    inputs: ['input'],
    outputs: ['text']
  },
  {
    type: 'ai.llm',
    label: 'LLM',
    group: 'AI',
    description: 'Calls a configured language model with a prompt.',
    inputs: ['prompt', 'context'],
    outputs: ['response']
  },
  {
    type: 'ai.llm.stream',
    label: 'Streaming LLM',
    group: 'AI',
    description: 'Streams a language model response as incremental text chunks.',
    inputs: ['prompt', 'context'],
    outputs: ['response', 'chunks']
  },
  {
    type: 'ai.toolCall',
    label: 'Tool Call',
    group: 'AI',
    description: 'Calls a registered FlowForge tool with structured arguments.',
    inputs: ['arguments'],
    outputs: ['result']
  },
  {
    type: 'ai.agent',
    label: 'Agent',
    group: 'AI',
    description: 'Runs a registered FlowForge agent against a task and context.',
    inputs: ['task', 'context'],
    outputs: ['result']
  },
  {
    type: 'logic.decision',
    label: 'Decision',
    group: 'Logic',
    description: 'Routes execution based on structured conditions.',
    inputs: ['input'],
    outputs: ['true', 'false']
  },
  {
    type: 'task.create',
    label: 'Create Task',
    group: 'Work Management',
    description: 'Creates a task in FlowForge.',
    inputs: ['title', 'description'],
    outputs: ['task']
  },
  {
    type: 'notification.telegram',
    label: 'Telegram',
    group: 'Notifications',
    description: 'Sends a Telegram message.',
    inputs: ['message'],
    outputs: ['result']
  }
] as const satisfies readonly NodeDefinition[];

export type NodeType = (typeof nodeCatalog)[number]['type'];

export function findNodeDefinition(type: string): NodeDefinition | undefined {
  return nodeCatalog.find((definition) => definition.type === type);
}
