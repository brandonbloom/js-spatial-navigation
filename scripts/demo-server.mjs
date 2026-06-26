import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 8080);

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8']
]);

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    ...headers
  });
  res.end(body);
}

function filePathForUrl(url) {
  const pathname = new URL(url, `http://${host}:${port}`).pathname;
  const decoded = decodeURIComponent(pathname);
  const normalized = normalize(decoded).replace(/^[/\\]+/, '');
  const filePath = join(root, normalized);
  const fileRelative = relative(root, filePath);

  if (fileRelative.startsWith(`..${sep}`) || fileRelative === '..') {
    return null;
  }

  return filePath;
}

const server = createServer(async (req, res) => {
  if (req.url === '/') {
    res.writeHead(302, { location: '/demo/' });
    res.end();
    return;
  }

  const filePath = filePathForUrl(req.url ?? '/');
  if (!filePath) {
    send(res, 403, 'Forbidden\n');
    return;
  }

  try {
    const fileStat = await stat(filePath);
    const path = fileStat.isDirectory() ? join(filePath, 'index.html') : filePath;
    const pathStat = fileStat.isDirectory() ? await stat(path) : fileStat;

    if (!pathStat.isFile()) {
      send(res, 404, 'Not found\n');
      return;
    }

    res.writeHead(200, {
      'content-length': pathStat.size,
      'content-type': contentTypes.get(extname(path)) ?? 'application/octet-stream'
    });
    createReadStream(path).pipe(res);
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
      send(res, 404, 'Not found\n');
      return;
    }

    send(res, 500, 'Internal server error\n');
  }
});

server.listen(port, host, () => {
  console.log(`Demo server: http://${host}:${port}/demo/`);
});
