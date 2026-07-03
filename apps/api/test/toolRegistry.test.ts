import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { callTool, defaultToolRegistry } from '../src/domain/toolRegistry';

describe('callTool', () => {
  it('calls registered tools by name', async () => {
    const result = await callTool(defaultToolRegistry, {
      name: 'createTask',
      arguments: {
        title: 'Prepare demo',
        description: 'Ship a small workflow demo'
      }
    });

    assert.equal(result.name, 'createTask');
    assert.equal(result.result.task && typeof result.result.task, 'object');
  });

  it('rejects unknown tools', async () => {
    await assert.rejects(
      callTool(defaultToolRegistry, {
        name: 'missingTool',
        arguments: {}
      }),
      /not registered/
    );
  });
});
