/**
 * TOC:
 * - createFindTourOptionsHandler: builds the MCP tool handler for several categorized tour options
 * - buildTourOptionsText: formats a grouped plain-text подборка for chat-like clients
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';

import { buildTourCollection } from '../eto-travel/tour-collection.js';
import type { TourSearchClient, TourSearchInput, TourSearchResult } from '../shared/types.js';
import { validateSearchInputOrThrow } from './find-any-tour.js';

const CATEGORY_LABELS = {
  budget: 'Бюджетный вариант',
  optimal: 'Оптимальный вариант',
  premium: 'Премиальный вариант'
} as const;

export function createFindTourOptionsHandler(searchClient: TourSearchClient) {
  type ToolContext = RequestHandlerExtra<ServerRequest, ServerNotification> & {
    mcpReq?: {
      log?: (level: string, message: string) => Promise<void>;
    };
  };

  return async (input: TourSearchInput, context: ToolContext): Promise<CallToolResult> => {
    // Многовариантный tool обязан так же строго проверять обязательные поля, как и single-result tool.
    const validationError = validateSearchInputOrThrow(input);

    if (validationError) {
      return validationError;
    }

    // Логируем старт долгого поиска и для multi-option сценария, чтобы пользователь видел активную работу инструмента.
    if (context?.mcpReq?.log) {
      await context.mcpReq.log('info', 'Начинаю подбор нескольких туров: это может занять около 1 минуты.');
    }

    // Если backend пока не умеет искать несколько туров за один проход, возвращаем хотя бы одну категorizованную карточку.
    const collection = searchClient.searchTourOptions
      ? await searchClient.searchTourOptions(input)
      : buildTourCollection([await searchClient.searchAnyTour(input)]);
    const text = buildTourOptionsText(collection.tours);

    return {
      content: [{ type: 'text', text }],
      structuredContent: {
        tours: collection.tours
      }
    };
  };
}

function buildTourOptionsText(tours: Array<TourSearchResult & { category: 'budget' | 'optimal' | 'premium' }>): string {
  // Текстовая подборка помогает агенту и пользователю быстро понять различия между несколькими вариантами.
  return [
    'ETO Travel - найдено несколько вариантов',
    ...tours.flatMap((tour) => [
      '',
      `${CATEGORY_LABELS[tour.category]}:`,
      `Название: ${tour.title}`,
      `Цена: ${tour.price}`,
      `Локация: ${tour.location ?? 'не указана'}`,
      `Рейтинг: ${tour.rating ?? 'не указан'}`,
      `Ослабленные фильтры: ${tour.relaxedFilters.length ? tour.relaxedFilters.join(', ') : 'нет'}`,
      `Ссылка: ${tour.url}`
    ])
  ].join('\n');
}
