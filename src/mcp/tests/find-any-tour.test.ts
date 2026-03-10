/**
 * TOC:
 * - createFindAnyTourHandler: MCP tool handler for searching tours
 */

import { describe, expect, it, vi } from 'vitest';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';

import { createFindAnyTourHandler } from '../find-any-tour.js';

type ToolContext = RequestHandlerExtra<ServerRequest, ServerNotification> & {
  mcpReq?: {
    log?: (level: string, message: string) => Promise<void>;
  };
};

describe('createFindAnyTourHandler', () => {
  it('returns text and structured content for the found tour', async () => {
    // Хендлер должен отдавать и текст для чата, и структуру для машинной обработки.
    const searchAnyTour = vi.fn().mockResolvedValue({
      title: 'Тур в Турцию',
      hotelName: 'Blue Sea Hotel',
      price: '150 000 RUB',
      dates: '10.06 - 17.06',
      rating: '4.8',
      location: 'Анталья, 200 м до моря',
      description: 'Семейный отель у моря',
      imageUrl: 'https://example.com/hotel.jpg',
      url: 'https://eto.travel/tours/1',
      appliedFilters: {
        destination: 'Турция',
        departureCity: 'Москва',
        adults: 2,
        nights: 7,
        month: 'июнь'
      },
      relaxedFilters: ['month'],
      source: 'ui'
    });

    const handler = createFindAnyTourHandler({ searchAnyTour });
    const result = await handler({
      destination: 'Турция',
      departureCity: 'Москва',
      adults: 2,
      nights: 7,
      month: 'июнь',
      rawQuery: 'Турция, июнь, 2 взрослых'
    }, createToolContext(async () => undefined));

    expect(searchAnyTour).toHaveBeenCalledWith({
      destination: 'Турция',
      departureCity: 'Москва',
      adults: 2,
      nights: 7,
      month: 'июнь',
      rawQuery: 'Турция, июнь, 2 взрослых'
    });
    expect(result.structuredContent).toMatchObject({
      title: 'Тур в Турцию',
      imageUrl: 'https://example.com/hotel.jpg',
      relaxedFilters: ['month'],
      url: 'https://eto.travel/tours/1'
    });
    expect(result.content[0]?.type).toBe('text');

    if (result.content[0]?.type !== 'text') {
      throw new Error('Expected text content');
    }

    expect(result.content[0].text).toContain('https://eto.travel/tours/1');
    expect(result.content[0].text).toContain('Картинка: https://example.com/hotel.jpg');
    expect(result.content[0].text).toContain('Ослабленные фильтры: month');
  });

  it('logs a start message before running a long search', async () => {
    // Длинный UI-поиск должен сразу сообщать клиенту, что работа началась и это не зависание.
    const searchAnyTour = vi.fn().mockResolvedValue({
      title: 'Тур в Турцию',
      hotelName: 'Blue Sea Hotel',
      price: '150 000 RUB',
      dates: '10.06 - 17.06',
      rating: '4.8',
      location: 'Анталья, 200 м до моря',
      description: 'Семейный отель у моря',
      imageUrl: 'https://example.com/hotel.jpg',
      url: 'https://eto.travel/tours/1',
      appliedFilters: {
        destination: 'Турция',
        departureCity: 'Москва',
        adults: 2,
        nights: 7,
        month: 'июнь'
      },
      relaxedFilters: [],
      source: 'ui'
    });
    const log = vi.fn<(...args: [string, string]) => Promise<void>>().mockResolvedValue();
    const handler = createFindAnyTourHandler({ searchAnyTour });

    await handler(
      {
        destination: 'Турция',
        departureCity: 'Москва',
        adults: 2,
        nights: 7,
        month: 'июнь',
        rawQuery: 'Турция, июнь, 2 взрослых'
      },
      createToolContext(log)
    );

    expect(log).toHaveBeenCalledWith('info', 'Начинаю поиск тура: это может занять около 1 минуты.');
    expect(searchAnyTour).toHaveBeenCalledTimes(1);
  });

  it('asks for critical fields instead of starting an underspecified search', async () => {
    // Если критичные поля пустые, нужно вернуть понятный запрос на уточнение, а не искать наугад.
    const searchAnyTour = vi.fn();
    const handler = createFindAnyTourHandler({ searchAnyTour });

    const result = await handler({
      destination: '   ',
      departureCity: null,
      adults: null,
      nights: 7,
      month: null,
      rawQuery: 'Нужен тур на неделю'
    }, createToolContext(async () => undefined));

    expect(searchAnyTour).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(getTextContent(result)).toContain('Уточните, пожалуйста');
    expect(getTextContent(result)).toContain('страну, город или курорт назначения');
    expect(getTextContent(result)).toContain('город вылета');
    expect(getTextContent(result)).toContain('количество взрослых');
  });
});

function createToolContext(log: (...args: [string, string]) => Promise<void>): ToolContext {
  return {
    signal: new AbortController().signal,
    requestId: 'test-request-id',
    sendNotification: async () => undefined,
    sendRequest: async () => {
      throw new Error('sendRequest is not implemented in tests');
    },
    mcpReq: {
      log
    }
  };
}

function getTextContent(result: CallToolResult): string {
  const textBlock = result.content.find((contentBlock) => contentBlock.type === 'text');

  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Expected text content');
  }

  return textBlock.text;
}
