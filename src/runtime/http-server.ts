/**
 * TOC:
 * - startHttpServer: starts the MCP server over Streamable HTTP using Express
 */

import { createServer, type Server as HttpServer } from 'node:http';

import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import type { RuntimeConfig } from './config.js';
import { createMcpServer } from '../mcp/server.js';
import type { TourSearchClient } from '../shared/types.js';

export async function startHttpServer(searchClient: TourSearchClient, config: RuntimeConfig): Promise<HttpServer> {
  // HTTP transport разрешен только при явно собранной HTTP-конфигурации, иначе это ошибка запуска.
  if (config.transportMode !== 'http' || !config.http) {
    throw new Error('HTTP runtime config is required to start the HTTP server');
  }

  // Express-приложение делегирует host validation SDK, чтобы защититься от DNS rebinding на публичном хосте.
  const app = createMcpExpressApp({
    host: config.http.host,
    allowedHosts: config.http.allowedHosts.length ? config.http.allowedHosts : undefined
  });

  // Health endpoint нужен для Docker/реверс-прокси и быстрой ручной проверки без MCP-клиента.
  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  // На каждый HTTP-запрос поднимаем stateless transport, чтобы не хранить серверные сессии в памяти контейнера.
  app.all(config.http.mcpPath, async (request, response) => {
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined
      });
      const server = createMcpServer(searchClient);

      await server.connect(transport);
      await transport.handleRequest(request, response, request.body);
      await server.close();
    } catch (error: unknown) {
      // Любая ошибка на границе HTTP должна логироваться и возвращаться как 500 без скрытых fallback-ответов.
      console.error('HTTP MCP request failed:', error);

      if (!response.headersSent) {
        response.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal MCP server error'
          },
          id: null
        });
      }
    }
  });

  const httpServer = createServer(app);

  return await new Promise<HttpServer>((resolve, reject) => {
    // Слушаем явный host/port, чтобы контейнер и локальный запуск вели себя одинаково.
    httpServer.listen(config.http!.port, config.http!.host, () => {
      resolve(httpServer);
    });
    httpServer.on('error', reject);
  });
}
