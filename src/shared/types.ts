/**
 * TOC:
 * - TourSearchInput: structured search filters provided by an MCP client or LLM agent
 * - ParsedSearchQuery: legacy normalized pieces extracted from free-form user text
 * - TourSearchResult: stable payload returned from the eto.travel search flow
 * - TourSearchClient: integration contract for any search backend
 */

// Структурированный ввод позволяет LLM заполнять поля явно, без хрупкого regex-разбора на сервере.
export interface TourSearchInput {
  destination: string;
  departureCity: string | null;
  adults: number | null;
  nights: number | null;
  month: string | null;
  rawQuery: string | null;
}

// Нормализованный запрос хранит только те поля, которые можно извлечь без догадок.
export interface ParsedSearchQuery {
  rawQuery: string;
  destination: string | null;
  departureCity: string | null;
  adults: number | null;
  nights: number | null;
  month: string | null;
}

// Результат поиска отделен от сырого DOM, чтобы MCP всегда возвращал стабильную структуру.
export interface TourSearchResult {
  title: string;
  hotelName: string | null;
  price: string;
  dates: string | null;
  rating: string | null;
  location: string | null;
  description: string | null;
  imageUrl: string | null;
  url: string;
  appliedFilters: {
    destination: string | null;
    departureCity: string | null;
    adults: number | null;
    nights: number | null;
    month: string | null;
  };
  relaxedFilters: string[];
  source: 'ui';
}

// Контракт позволяет тестировать MCP-обработчик без реального браузера.
export interface TourSearchClient {
  searchAnyTour(input: TourSearchInput): Promise<TourSearchResult>;
}
