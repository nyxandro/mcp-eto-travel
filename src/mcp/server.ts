/**
 * TOC:
 * - createMcpServer: configures the MCP server and registers tour search tools
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import { createFindAnyTourHandler } from './find-any-tour.js';
import type { TourSearchClient } from '../shared/types.js';

const MONTH_HINTS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'] as const;

export function createMcpServer(searchClient: TourSearchClient): McpServer {
  const server = new McpServer(
    {
      name: 'eto-travel-mcp',
      version: '0.1.0'
    },
    {
      capabilities: {
        logging: {}
      },
      instructions:
        'Use find_any_tour for package-tour search on eto.travel. Before calling the tool, extract structured filters from the user request yourself: destination is required and must contain the country or destination label to select in the widget; departureCity should contain the exact city of departure in Russian when the user specified it; adults should contain only the number of adult travelers; nights should contain the intended number of nights as an integer; month should contain one normalized Russian month name when the user asked for a specific month; rawQuery may keep the original user wording for traceability. Do not send a single free-form sentence instead of structured fields. If strict filters produce no usable results, the tool may relax month, departure city, or nights and will report that in relaxedFilters.'
    }
  );

  // Один инструмент закрывает основной пользовательский сценарий: найти тур и сразу вернуть ссылку.
  server.registerTool(
    'find_any_tour',
    {
      title: 'Find any tour on eto.travel',
      description: 'Searches eto.travel through the site UI using structured tour filters. The caller should extract destination, departure city, month, nights, and adults from the user request before invoking the tool.',
      inputSchema: z.object({
        destination: z.string().min(1).describe('Required destination or country label in Russian, for example: Турция, Египет, ОАЭ.'),
        departureCity: z.string().min(1).nullable().describe('Optional departure city in Russian when specified by the user, for example: Москва or Санкт-Петербург.'),
        adults: z.number().int().positive().nullable().describe('Optional number of adult travelers only. Use an integer such as 1, 2, or 3.'),
        nights: z.number().int().positive().nullable().describe('Optional trip length in nights. Use an integer such as 7 or 10.'),
        month: z.enum(MONTH_HINTS).nullable().describe('Optional normalized departure month in Russian. Use one of the month names exactly as listed in the schema.'),
        rawQuery: z.string().min(1).nullable().describe('Optional original user request in free form. Keep it only for traceability or logs, not as the main source of truth.')
      }),
      outputSchema: z.object({
        title: z.string(),
        hotelName: z.string().nullable(),
        price: z.string(),
        dates: z.string().nullable(),
        rating: z.string().nullable(),
        location: z.string().nullable(),
        description: z.string().nullable(),
        imageUrl: z.string().nullable(),
        url: z.url(),
        appliedFilters: z.object({
          destination: z.string().nullable(),
          departureCity: z.string().nullable(),
          adults: z.number().nullable(),
          nights: z.number().nullable(),
          month: z.string().nullable()
        }),
        relaxedFilters: z.array(z.string()),
        source: z.literal('ui')
      })
    },
    createFindAnyTourHandler(searchClient)
  );

  return server;
}
