/**
 * TOC:
 * - createFindAnyTourHandler: builds the MCP tool handler for structured tour search
 * - buildTourCardText: formats a user-friendly tour card for plain-text MCP clients
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { TourSearchClient, TourSearchInput, TourSearchResult } from '../shared/types.js';

export function createFindAnyTourHandler(searchClient: TourSearchClient) {
  return async (input: TourSearchInput): Promise<CallToolResult> => {
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
