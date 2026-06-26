import { createServer as createHttpServer } from 'node:http';
import type { Server } from 'node:http';
import { nodeCatalog } from './domain/nodeCatalog.ts';
import { validateWorkflow } from './domain/workflowValidation.ts';
import { readJson, sendBadRequest, sendJson, sendNoContent, sendNotFound } from './http.ts';

type CreateServerOptions = {
  startedAt?: Date;
};

export function createServer({ startedAt = new Date() }: CreateServerOptions = {}): Server {
  return createHttpServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');

      if (request.method === 'OPTIONS') {
        return sendNoContent(response);
      }

      if (request.method === 'GET' && url.pathname === '/health') {
        return sendJson(response, 200, {
          status: 'ok',
          service: 'flowforge-api',
          uptimeSeconds: Math.floor((Date.now() - startedAt.getTime()) / 1000)
        });
      }

      if (request.method === 'GET' && url.pathname === '/ready') {
        return sendJson(response, 200, {
          status: 'ready',
          checks: {
            api: 'ok'
          }
        });
      }

      if (request.method === 'GET' && url.pathname === '/catalog/nodes') {
        return sendJson(response, 200, {
          nodes: nodeCatalog
        });
      }

      if (request.method === 'POST' && url.pathname === '/workflows/validate') {
        let workflow: unknown;

        try {
          workflow = await readJson(request);
        } catch {
          return sendBadRequest(response, 'Request body must be valid JSON.');
        }

        const validation = validateWorkflow(workflow);
        return sendJson(response, validation.valid ? 200 : 422, validation);
      }

      return sendNotFound(response);
    } catch (error) {
      return sendJson(response, 500, {
        error: {
          code: 'internal_error',
          message: error instanceof Error ? error.message : 'Unexpected error.'
        }
      });
    }
  });
}

