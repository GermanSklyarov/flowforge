export type GenerateTextInput = {
  instruction: string;
  inputText: string | null;
  model: string | null;
};

export type GenerateTextResult = {
  text: string;
  model: string;
  provider: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
};

export type StreamTextEvent =
  | {
      type: 'delta';
      text: string;
    }
  | {
      type: 'completed';
      model: string;
      provider: string;
      usage: GenerateTextResult['usage'];
    };

export type LlmProvider = {
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
  streamText(input: GenerateTextInput): AsyncIterable<StreamTextEvent>;
};

export type OpenAIResponsesLlmProviderConfig = {
  apiKey: string;
  model: string;
  baseUrl?: string;
  fetch?: typeof fetch;
};

export class LocalLlmProvider implements LlmProvider {
  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const text = `${input.instruction}: ${input.inputText ?? 'No input provided.'}`;

    return {
      text,
      model: input.model ?? 'local-deterministic',
      provider: 'local',
      usage: {
        inputTokens: estimateTokens([input.instruction, input.inputText].filter(Boolean).join(' ')),
        outputTokens: estimateTokens(text)
      }
    };
  }

  async *streamText(input: GenerateTextInput): AsyncIterable<StreamTextEvent> {
    const result = await this.generateText(input);

    yield {
      type: 'delta',
      text: result.text
    };
    yield {
      type: 'completed',
      model: result.model,
      provider: result.provider,
      usage: result.usage
    };
  }
}

export class OpenAIResponsesLlmProvider implements LlmProvider {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;
  readonly #model: string;

  constructor(config: OpenAIResponsesLlmProviderConfig) {
    this.#apiKey = config.apiKey;
    this.#baseUrl = config.baseUrl ?? 'https://api.openai.com/v1';
    this.#fetch = config.fetch ?? fetch;
    this.#model = config.model;
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const model = input.model ?? this.#model;
    const response = await this.#fetch(`${this.#baseUrl}/responses`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.#apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'developer',
            content: input.instruction
          },
          {
            role: 'user',
            content: input.inputText ?? ''
          }
        ],
        store: false
      })
    });

    const payload = await readJson(response);

    if (!response.ok) {
      throw new Error(readOpenAIError(payload, response.status));
    }

    const text = readResponseText(payload);

    if (!text) {
      throw new Error('OpenAI response did not include text output.');
    }

    return {
      text,
      model: readString(payload, 'model') ?? model,
      provider: 'openai',
      usage: readUsage(payload)
    };
  }

  async *streamText(input: GenerateTextInput): AsyncIterable<StreamTextEvent> {
    const model = input.model ?? this.#model;
    const response = await this.#fetch(`${this.#baseUrl}/responses`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.#apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        input: createResponseInput(input),
        store: false,
        stream: true
      })
    });

    if (!response.ok) {
      const payload = await readJson(response);
      throw new Error(readOpenAIError(payload, response.status));
    }

    if (!response.body) {
      throw new Error('OpenAI streaming response did not include a body.');
    }

    for await (const payload of readServerSentEvents(response.body)) {
      if (!isRecord(payload)) {
        continue;
      }

      if (payload.type === 'error') {
        throw new Error(readOpenAIError(payload, response.status));
      }

      if (payload.type === 'response.output_text.delta' && typeof payload.delta === 'string') {
        yield {
          type: 'delta',
          text: payload.delta
        };
      }

      if (payload.type === 'response.completed') {
        const completedResponse = isRecord(payload.response) ? payload.response : payload;

        yield {
          type: 'completed',
          model: readString(completedResponse, 'model') ?? model,
          provider: 'openai',
          usage: readUsage(completedResponse)
        };
      }
    }
  }
}

export function createConfiguredLlmProvider(input: {
  apiKey?: string | undefined;
  baseUrl: string;
  model: string;
}): LlmProvider {
  if (!input.apiKey) {
    return new LocalLlmProvider();
  }

  return new OpenAIResponsesLlmProvider({
    apiKey: input.apiKey,
    baseUrl: input.baseUrl,
    model: input.model
  });
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function createResponseInput(input: GenerateTextInput): Array<{ role: string; content: string }> {
  return [
    {
      role: 'developer',
      content: input.instruction
    },
    {
      role: 'user',
      content: input.inputText ?? ''
    }
  ];
}

function readOpenAIError(payload: unknown, status: number): string {
  if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string') {
    return `OpenAI request failed: ${payload.error.message}`;
  }

  return `OpenAI request failed with status ${status}.`;
}

function readResponseText(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (typeof payload.output_text === 'string' && payload.output_text.trim().length > 0) {
    return payload.output_text;
  }

  if (!Array.isArray(payload.output)) {
    return null;
  }

  const chunks: string[] = [];

  for (const item of payload.output) {
    if (!isRecord(item) || !Array.isArray(item.content)) {
      continue;
    }

    for (const content of item.content) {
      if (isRecord(content) && content.type === 'output_text' && typeof content.text === 'string') {
        chunks.push(content.text);
      }
    }
  }

  return chunks.length > 0 ? chunks.join('\n') : null;
}

async function* readServerSentEvents(stream: ReadableStream<Uint8Array>): AsyncIterable<unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const event of events) {
        const payload = parseServerSentEvent(event);

        if (payload) {
          yield payload;
        }
      }
    }

    buffer += decoder.decode();

    if (buffer.trim().length > 0) {
      const payload = parseServerSentEvent(buffer);

      if (payload) {
        yield payload;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseServerSentEvent(event: string): unknown | null {
  const data = event
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trimStart())
    .join('\n');

  if (!data || data === '[DONE]') {
    return null;
  }

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function readUsage(payload: unknown): GenerateTextResult['usage'] {
  if (!isRecord(payload) || !isRecord(payload.usage)) {
    return {
      inputTokens: 0,
      outputTokens: 0
    };
  }

  return {
    inputTokens: typeof payload.usage.input_tokens === 'number' ? payload.usage.input_tokens : 0,
    outputTokens: typeof payload.usage.output_tokens === 'number' ? payload.usage.output_tokens : 0
  };
}

function readString(payload: unknown, key: string): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const value = payload[key];
  return typeof value === 'string' ? value : null;
}

function estimateTokens(text: string): number {
  const normalized = text.trim();

  if (normalized.length === 0) {
    return 0;
  }

  return Math.ceil(normalized.length / 4);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
