/**
 * TOC:
 * - createFindTourOptionsHandler: MCP tool handler for a categorized multi-tour подборка
 */

import { describe, expect, it, vi } from 'vitest';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';

import { createFindTourOptionsHandler } from '../find-tour-options.js';

type ToolContext = RequestHandlerExtra<ServerRequest, ServerNotification> & {
  mcpReq?: {
    log?: (level: string, message: string) => Promise<void>;
  };
};

describe('createFindTourOptionsHandler', () => {
  it('returns a categorized selection of tours', async () => {
    // Новый tool должен отдавать сразу несколько вариантов, чтобы агент мог собрать полезную подборку для клиента.
    const searchTourOptions = vi.fn().mockResolvedValue({
      tours: [
        {
          category: 'budget',
          title: 'Budget Hotel',
          hotelName: 'Budget Hotel',
          price: '90 000 RUB',
          dates: 'Аланья, 500 м до моря',
          rating: '4.0',
          location: 'Аланья, 500 м до моря',
          description: 'Самый доступный вариант',
          imageUrl: 'https://example.com/budget.jpg',
          url: 'https://example.com/budget',
          appliedFilters: {
            destination: 'Турция',
            departureCity: 'Москва',
            adults: 2,
            nights: 7,
            month: 'июнь'
          },
          relaxedFilters: [],
          source: 'ui'
        },
        {
          category: 'optimal',
          title: 'Comfort Hotel',
          hotelName: 'Comfort Hotel',
          price: '115 000 RUB',
          dates: 'Сиде, 300 м до моря',
          rating: '4.5',
          location: 'Сиде, 300 м до моря',
          description: 'Сбалансированный вариант',
          imageUrl: 'https://example.com/optimal.jpg',
          url: 'https://example.com/optimal',
          appliedFilters: {
            destination: 'Турция',
            departureCity: 'Москва',
            adults: 2,
            nights: 7,
            month: 'июнь'
          },
          relaxedFilters: [],
          source: 'ui'
        },
        {
          category: 'premium',
          title: 'Luxury Resort',
          hotelName: 'Luxury Resort',
          price: '180 000 RUB',
          dates: 'Белек, 100 м до моря',
          rating: '4.9',
          location: 'Белек, 100 м до моря',
          description: 'Более комфортный вариант',
          imageUrl: 'https://example.com/premium.jpg',
          url: 'https://example.com/premium',
          appliedFilters: {
            destination: 'Турция',
            departureCity: 'Москва',
            adults: 2,
            nights: 7,
            month: 'июнь'
          },
          relaxedFilters: ['month'],
          source: 'ui'
        }
      ]
    });
    const handler = createFindTourOptionsHandler({ searchAnyTour: vi.fn(), searchTourOptions });

    const result = await handler({
      destination: 'Турция',
      departureCity: 'Москва',
      adults: 2,
      nights: 7,
      month: 'июнь',
      rawQuery: 'Найди несколько туров в Турцию из Москвы на июнь'
    }, createToolContext());

    const text = getTextContent(result);
    const tours = getStructuredTours(result);

    expect(searchTourOptions).toHaveBeenCalledTimes(1);
    expect(tours).toHaveLength(3);
    expect(text).toContain('Бюджетный вариант');
    expect(text).toContain('Оптимальный вариант');
    expect(text).toContain('Премиальный вариант');
  });

  it('falls back to a single categorized option when multi-search is unavailable', async () => {
    // Обратная совместимость нужна, чтобы новый tool заработал даже до полноценной multi-card реализации в search backend.
    const handler = createFindTourOptionsHandler({
      searchAnyTour: vi.fn().mockResolvedValue({
        title: 'Comfort Hotel',
        hotelName: 'Comfort Hotel',
        price: '115 000 RUB',
        dates: 'Сиде, 300 м до моря',
        rating: '4.5',
        location: 'Сиде, 300 м до моря',
        description: 'Сбалансированный вариант',
        imageUrl: 'https://example.com/optimal.jpg',
        url: 'https://example.com/optimal',
        appliedFilters: {
          destination: 'Турция',
          departureCity: 'Москва',
          adults: 2,
          nights: 7,
          month: 'июнь'
        },
        relaxedFilters: [],
        source: 'ui'
      })
    });

    const result = await handler({
      destination: 'Турция',
      departureCity: 'Москва',
      adults: 2,
      nights: 7,
      month: 'июнь',
      rawQuery: 'Найди несколько туров в Турцию из Москвы на июнь'
    }, createToolContext());

    const tours = getStructuredTours(result);

    expect(tours).toHaveLength(1);
    expect(tours[0]?.category).toBe('budget');
  });
});

function getTextContent(result: Awaited<ReturnType<ReturnType<typeof createFindTourOptionsHandler>>>): string {
  const textBlock = result.content.find((contentBlock) => contentBlock.type === 'text');

  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Expected text content');
  }

  return textBlock.text;
}

function getStructuredTours(result: Awaited<ReturnType<ReturnType<typeof createFindTourOptionsHandler>>>) {
  const structuredContent = result.structuredContent as { tours?: Array<{ category: string }> } | undefined;

  if (!structuredContent?.tours) {
    throw new Error('Expected structured tours');
  }

  return structuredContent.tours;
}

function createToolContext(): ToolContext {
  return {
    signal: new AbortController().signal,
    requestId: 'test-request-id',
    sendNotification: async () => undefined,
    sendRequest: async () => {
      throw new Error('sendRequest is not implemented in tests');
    },
    mcpReq: {
      log: async () => undefined
    }
  };
}
