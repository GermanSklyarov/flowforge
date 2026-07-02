import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createConfiguredLlmProvider,
  LocalLlmProvider,
  OpenAIResponsesLlmProvider
} from '../src/domain/llmProvider';

describe('OpenAIResponsesLlmProvider', () => {
  it('creates a response request and maps text output', async () => {
    const requests: Array<{ body: unknown; headers: Headers; url: string }> = [];
    const provider = new OpenAIResponsesLlmProvider({
      apiKey: 'test-key',
      baseUrl: 'https://example.test/v1',
      model: 'gpt-test',
      fetch: async (url, init) => {
        requests.push({
          body: JSON.parse(String(init?.body)),
          headers: new Headers(init?.headers),
          url: String(url)
        });

        return Response.json({
          model: 'gpt-test',
          output_text: 'Summarized text',
          usage: {
            input_tokens: 10,
            output_tokens: 5
          }
        });
      }
    });

    const result = await provider.generateText({
      instruction: 'Summarize',
      inputText: 'Quarterly update',
      model: null
    });

    assert.equal(requests[0]?.url, 'https://example.test/v1/responses');
    assert.equal(requests[0]?.headers.get('authorization'), 'Bearer test-key');
    assert.deepEqual(requests[0]?.body, {
      model: 'gpt-test',
      input: [
        {
          role: 'developer',
          content: 'Summarize'
        },
        {
          role: 'user',
          content: 'Quarterly update'
        }
      ],
      store: false
    });
    assert.deepEqual(result, {
      text: 'Summarized text',
      model: 'gpt-test',
      provider: 'openai',
      usage: {
        inputTokens: 10,
        outputTokens: 5
      }
    });
  });

  it('reads nested output text when output_text is absent', async () => {
    const provider = new OpenAIResponsesLlmProvider({
      apiKey: 'test-key',
      model: 'gpt-test',
      fetch: async () =>
        Response.json({
          model: 'gpt-test',
          output: [
            {
              type: 'message',
              content: [
                {
                  type: 'output_text',
                  text: 'Nested text'
                }
              ]
            }
          ]
        })
    });

    const result = await provider.generateText({
      instruction: 'Summarize',
      inputText: 'Quarterly update',
      model: null
    });

    assert.equal(result.text, 'Nested text');
  });

  it('throws readable API errors', async () => {
    const provider = new OpenAIResponsesLlmProvider({
      apiKey: 'test-key',
      model: 'gpt-test',
      fetch: async () =>
        Response.json(
          {
            error: {
              message: 'Invalid API key.'
            }
          },
          { status: 401 }
        )
    });

    await assert.rejects(
      provider.generateText({
        instruction: 'Summarize',
        inputText: 'Quarterly update',
        model: null
      }),
      /Invalid API key/
    );
  });
});

describe('createConfiguredLlmProvider', () => {
  it('uses the local provider when no API key is configured', () => {
    const provider = createConfiguredLlmProvider({
      baseUrl: 'https://example.test/v1',
      model: 'gpt-test'
    });

    assert.ok(provider instanceof LocalLlmProvider);
  });
});
