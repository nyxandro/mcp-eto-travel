/**
 * TOC:
 * - createFindAnyTourHandler: builds the MCP tool handler for structured tour search
 * - buildTourCardText: formats a user-friendly tour card for plain-text MCP clients
 * - validateSearchInput: checks whether critical search fields are present before UI automation starts
 * - ToolContext: typed MCP tool context with optional logging helper from the SDK runtime
 * - validateSearchInputOrThrow: reusable MCP input validation for single and multiple tour tools
 */

import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';

import type { TourSearchClient, TourSearchInput, TourSearchResult } from '../shared/types.js';

const SEARCH_START_MESSAGE = 'Начинаю поиск тура: это может занять около 1 минуты.';
const CRITICAL_FIELD_LABELS = {
  destination: 'страну, город или курорт назначения',
  departureCity: 'город вылета',
  adults: 'количество взрослых'
} as const;

type ToolContext = RequestHandlerExtra<ServerRequest, ServerNotification> & {
  mcpReq?: {
    log?: (level: string, message: string) => Promise<void>;
  };
};

export function createFindAnyTourHandler(searchClient: TourSearchClient) {
  return async (input: TourSearchInput, context: ToolContext): Promise<CallToolResult> => {
    // Сначала валидируем обязательные для осмысленного подбора поля, чтобы не делать дорогой UI-поиск вслепую.
    const validationError = validateSearchInputOrThrow(input);

    if (validationError) {
      return validationError;
    }

    // Лог в MCP-клиент позволяет пользователю сразу увидеть, что длительный поиск уже начался.
    if (context?.mcpReq?.log) {
      await context.mcpReq.log('info', SEARCH_START_MESSAGE);
    }

    // MCP-слой принимает уже структурированные поля, чтобы LLM заполняла их явно и предсказуемо.
    const tour = await searchClient.searchAnyTour(input);
    const text = buildTourCardText(tour);

    return {
      content: [{ type: 'text', text }],
      structuredContent: {
        title: tour.title,
        hotelName: tour.hotelName,
        price: tour.price,
        dates: tour.dates,
        rating: tour.rating,
        location: tour.location,
        description: tour.description,
        imageUrl: tour.imageUrl,
        url: tour.url,
        appliedFilters: tour.appliedFilters,
        relaxedFilters: tour.relaxedFilters,
        source: tour.source
      }
    };
  };
}

export function validateSearchInputOrThrow(input: TourSearchInput): CallToolResult | null {
  // Проверяем только критичные поля, без которых подбор слишком неточный и может ввести клиента в заблуждение.
  const missingFields: string[] = [];

  if (!hasMeaningfulText(input.destination)) {
    missingFields.push(CRITICAL_FIELD_LABELS.destination);
  }

  if (!hasMeaningfulText(input.departureCity)) {
    missingFields.push(CRITICAL_FIELD_LABELS.departureCity);
  }

  if (!Number.isInteger(input.adults) || input.adults === null || input.adults <= 0) {
    missingFields.push(CRITICAL_FIELD_LABELS.adults);
  }

  if (!missingFields.length) {
    return null;
  }

  return {
    content: [
      {
        type: 'text',
        text: `Уточните, пожалуйста: ${missingFields.join(', ')}. После этого сразу начну поиск тура.`
      }
    ],
    isError: true
  };
}

function hasMeaningfulText(value: string | null): boolean {
  // Пустые строки от LLM или клиента считаем отсутствующим значением, чтобы не запускать поиск с мусорным фильтром.
  return typeof value === 'string' && value.trim().length > 0;
}

function buildTourCardText(tour: TourSearchResult): string {
  // Текстовая карточка нужна для Telegram/CLI-клиентов, где rich preview может быть недоступен.
  return [
    'ETO Travel - найден вариант',
    `Название: ${tour.title}`,
    `Отель: ${tour.hotelName ?? 'не указан'}`,
    `Цена: ${tour.price}`,
    `Локация: ${tour.location ?? 'не указана'}`,
    `Рейтинг: ${tour.rating ?? 'не указан'}`,
    `Описание: ${tour.description ?? 'не указано'}`,
    `Примененные фильтры: ${formatAppliedFilters(tour)}`,
    `Ослабленные фильтры: ${tour.relaxedFilters.length ? tour.relaxedFilters.join(', ') : 'нет'}`,
    `Картинка: ${tour.imageUrl ?? 'нет изображения'}`,
    `Ссылка на отель: ${tour.url}`
  ].join('\n');
}

function formatAppliedFilters(tour: TourSearchResult): string {
  // Явно показываем пользователю, какие фильтры реально использованы в успешной попытке поиска.
  return [
    `страна=${tour.appliedFilters.destination ?? 'не задана'}`,
    `вылет=${tour.appliedFilters.departureCity ?? 'по умолчанию'}`,
    `взрослые=${tour.appliedFilters.adults ?? 'по умолчанию'}`,
    `ночи=${tour.appliedFilters.nights ?? 'по умолчанию'}`,
    `месяц=${tour.appliedFilters.month ?? 'по умолчанию'}`
  ].join(', ');
}
