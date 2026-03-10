#!/usr/bin/env node

/**
 * TOC:
 * - main: application entrypoint that starts the MCP stdio or HTTP server
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { PlaywrightBrowserLauncher } from './eto-travel/browser.js';
import { createRuntimeConfig } from './runtime/config.js';
import { startHttpServer } from './runtime/http-server.js';
import { EtoTravelSearchService } from './eto-travel/search-service.js';
import { createMcpServer } from './mcp/server.js';

async function main(): Promise<void> {
  // Все интеграции собираются в entrypoint, чтобы доменная логика оставалась независимой от транспорта.
  const searchService = new EtoTravelSearchService(new PlaywrightBrowserLauncher());
  const runtimeConfig = createRuntimeConfig(process.env);

  // HTTP-режим нужен для удаленного подключения по ссылке; stdio сохраняем для локальных MCP-клиентов.
  if (runtimeConfig.transportMode === 'http') {
    const httpServer = await startHttpServer(searchService, runtimeConfig);

    console.error(
      `ETO Travel MCP server is running over HTTP at http://${runtimeConfig.http!.host}:${runtimeConfig.http!.port}${runtimeConfig.http!.mcpPath}`
    );

    httpServer.on('close', () => {
      console.error('ETO Travel MCP HTTP server stopped');
    });

    return;
  }

  const server = createMcpServer(searchService);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ETO Travel MCP server is running on stdio');
}

main().catch((error: unknown) => {
  // stderr безопасен для логов, а затем ошибка пробрасывается завершением процесса.
  console.error('Fatal error while starting MCP server:', error);
  process.exit(1);
});
