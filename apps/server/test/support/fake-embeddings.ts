import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Deterministic OpenAI-compatible embeddings server for tests: hashed bag-of-words vectors, so texts
 * that share words are close in cosine space. Model "fake-<n>" returns n dimensions (default 1024);
 * model "broken" returns 500.
 */
export function embed(text: string, dimensions: number): number[] {
  const vector = Array.from({ length: dimensions }, () => 0);
  const tokens =
    text.toLowerCase().match(/[\p{Script=Han}]|[\p{L}\p{N}]+/gu) ?? [];
  for (const token of tokens) {
    let hash = 2166136261;
    for (const char of token) {
      hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619);
    }
    vector[Math.abs(hash) % dimensions]! += 1;
  }
  const norm = Math.hypot(...vector) || 1;
  return vector.map((value) => value / norm);
}

export async function startFakeEmbeddings(): Promise<{
  baseUrl: string;
  server: Server;
}> {
  const server = createServer((request, response) => {
    let raw = '';
    request.on('data', (chunk: Buffer) => (raw += chunk.toString('utf8')));
    request.on('end', () => {
      const body = JSON.parse(raw || '{}') as {
        model?: string;
        input?: string[];
      };
      if (request.url !== '/v1/embeddings' || body.model === 'broken') {
        response
          .writeHead(request.url === '/v1/embeddings' ? 500 : 404)
          .end('unavailable');
        return;
      }
      const inputs = body.input ?? [];
      const dimensions = Number(
        /^fake-(\d+)$/.exec(body.model ?? '')?.[1] ?? 1024,
      );
      response.writeHead(200, { 'content-type': 'application/json' }).end(
        JSON.stringify({
          object: 'list',
          model: body.model,
          data: inputs.map((input, index) => ({
            object: 'embedding',
            index,
            embedding: embed(input, dimensions),
          })),
        }),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${port}/v1`, server };
}
