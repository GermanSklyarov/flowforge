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

export type LlmProvider = {
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
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
}

function estimateTokens(text: string): number {
  const normalized = text.trim();

  if (normalized.length === 0) {
    return 0;
  }

  return Math.ceil(normalized.length / 4);
}
