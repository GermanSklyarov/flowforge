import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseRedisConnection } from '../src/queue/redisConnection';

describe('parseRedisConnection', () => {
  it('parses redis urls into BullMQ connection options', () => {
    const connection = parseRedisConnection('redis://user:secret@localhost:6380/2') as Record<
      string,
      unknown
    >;

    assert.equal(connection.host, 'localhost');
    assert.equal(connection.port, 6380);
    assert.equal(connection.username, 'user');
    assert.equal(connection.password, 'secret');
    assert.equal(connection.db, 2);
    assert.equal(connection.maxRetriesPerRequest, null);
  });
});
