import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? 'apps/web');
const port = Number.parseInt(process.argv[3] ?? process.env.WEB_PORT ?? '5173', 10);
const host = process.env.WEB_HOST ?? '0.0.0.0';

const contentTypes = new Map<string, string>([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml']
]);

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const requestedPath = normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
  const filePath = resolve(join(root, requestedPath === '/' ? 'index.html' : requestedPath));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'content-type': contentTypes.get(extname(filePath)) ?? 'application/octet-stream'
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
}).listen(port, host, () => {
  console.log(`FlowForge web listening on http://${host}:${port}`);
});

