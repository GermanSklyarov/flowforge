import type { IncomingMessage, ServerResponse } from 'node:http';

type JsonBody = Record<string, unknown> | unknown[] | string | number | boolean | null;

export async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');

  if (rawBody.length === 0) {
    return null;
  }

  return JSON.parse(rawBody) as unknown;
}

export function sendJson(response: ServerResponse, statusCode: number, body: JsonBody): void {
  const payload = JSON.stringify(body, null, 2);

  response.writeHead(statusCode, {
    ...corsHeaders(),
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload)
  });
  response.end(payload);
}

export function sendNoContent(response: ServerResponse): void {
  response.writeHead(204, corsHeaders());
  response.end();
}

export function sendNotFound(response: ServerResponse): void {
  sendJson(response, 404, {
    error: {
      code: 'not_found',
      message: 'Route not found.'
    }
  });
}

export function sendBadRequest(response: ServerResponse, message: string): void {
  sendJson(response, 400, {
    error: {
      code: 'bad_request',
      message
    }
  });
}

function corsHeaders(): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type'
  };
}

