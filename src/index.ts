#!/usr/bin/env node

/**
 * TOC:
 * - main: application entrypoint that starts the MCP stdio server
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { PlaywrightBrowserLauncher } from './eto-travel/browser.js';
import { EtoTravelSearchService } from './eto-travel/search-service.js';
import { createMcpServer } from './mcp/server.js';

async function main(): Promise<void> {
  // Все интеграции собираются в entrypoint, чтобы доменная логика оставалась независимой от транспорта.
  const searchService = new EtoTravelSearchService(new PlaywrightBrowserLauncher());
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
