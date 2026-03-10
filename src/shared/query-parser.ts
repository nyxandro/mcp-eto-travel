/**
 * TOC:
 * - parseSearchQuery: extracts lightweight filters from free-form Russian travel requests
 * - normalizeDestination: maps destination aliases to widget-friendly labels
 * - normalizeDepartureCity: maps departure aliases to widget-friendly labels
 * - MONTH_PATTERN_MAP: maps Russian month words to normalized month hints
 */

import type { ParsedSearchQuery } from './types.js';

const MONTH_PATTERN_MAP: ReadonlyArray<{ pattern: RegExp; value: string }> = [
  { pattern: /январ[ья]/i, value: 'январь' },
  { pattern: /феврал[ья]/i, value: 'февраль' },
  { pattern: /март[ае]?/i, value: 'март' },
  { pattern: /апрел[ья]/i, value: 'апрель' },
  { pattern: /ма[йя]/i, value: 'май' },
  { pattern: /июн[ья]/i, value: 'июнь' },
  { pattern: /июл[ья]/i, value: 'июль' },
  { pattern: /август[ае]?/i, value: 'август' },
  { pattern: /сентябр[ья]/i, value: 'сентябрь' },
  { pattern: /октябр[ья]/i, value: 'октябрь' },
  { pattern: /ноябр[ья]/i, value: 'ноябрь' },
  { pattern: /декабр[ья]/i, value: 'декабрь' }
];

const DESTINATION_NORMALIZATION_MAP: ReadonlyArray<{ pattern: RegExp; value: string }> = [
  { pattern: /^турци(?:я|ю|и|е|ей)$/i, value: 'Турция' },
  { pattern: /^егип(?:ет|та|ту|те|том)$/i, value: 'Египет' },
  { pattern: /^таиланд(?:а|у|е|ом)?$/i, value: 'Таиланд' },
  { pattern: /^оаэ$/i, value: 'ОАЭ' },
  { pattern: /^росси(?:я|ю|и|е|ей)$/i, value: 'Россия' },
  { pattern: /^вьетнам(?:а|у|е|ом)?$/i, value: 'Вьетнам' },
  { pattern: /^китай(?:я|ю|е|ем)?$/i, value: 'Китай' },
  { pattern: /^абхази(?:я|ю|и|е|ей)$/i, value: 'Абхазия' }
];

const DEPARTURE_CITY_NORMALIZATION_MAP: ReadonlyArray<{ pattern: RegExp; value: string }> = [
  { pattern: /^москв(?:а|ы|е|у|ой)$/i, value: 'Москва' },
  { pattern: /^санкт-петербург(?:а|е|у|ом)?$/i, value: 'С.Петербург' },
  { pattern: /^петербург(?:а|е|у|ом)?$/i, value: 'С.Петербург' },
  { pattern: /^сочи$/i, value: 'Сочи' },
  { pattern: /^екатеринбург(?:а|е|у|ом)?$/i, value: 'Екатеринбург' },
  { pattern: /^казан(?:ь|и|ью)$/i, value: 'Казань' },
  { pattern: /^самар(?:а|ы|е|у|ой)$/i, value: 'Самара' }
];

export function parseSearchQuery(rawQuery: string): ParsedSearchQuery {
  // Сервер не должен работать с пустым пользовательским вводом, иначе невозможно объяснить выбор тура.
  const normalizedQuery = rawQuery.trim();

  if (!normalizedQuery) {
    throw new Error('Search query is required');
  }

  // Извлекаем только простые и надежные подсказки без NLP-моделей и рискованных эвристик.
  const destinationMatch = normalizedQuery.match(/(?:в|на)\s+([А-ЯA-ZЁ][\p{L}-]+)/u);
  const departureMatch = normalizedQuery.match(/(?:из|вылет\s+из)\s+([А-ЯA-ZЁ][\p{L}.-]+)/u);
  const adultsMatch = normalizedQuery.match(/(\d+)\s*(?:взросл(?:ых|ый)|чел(?:овек)?)/i);
  const nightsMatch = normalizedQuery.match(/(\d+)\s*ноч/i);
  const monthMatch = MONTH_PATTERN_MAP.find(({ pattern }) => pattern.test(normalizedQuery));

  return {
    rawQuery: normalizedQuery,
    destination: normalizeDestination(destinationMatch?.[1] ?? null),
    departureCity: normalizeDepartureCity(departureMatch?.[1] ?? null),
    adults: adultsMatch ? Number.parseInt(adultsMatch[1]!, 10) : null,
    nights: nightsMatch ? Number.parseInt(nightsMatch[1]!, 10) : null,
    month: monthMatch?.value ?? null
  };
}

export function normalizeDestination(destination: string | null): string | null {
  // Приводим популярные направления к форме, которая встречается в списке выбора виджета.
  if (!destination) {
    return null;
  }

  const trimmedDestination = destination.trim();
  const normalizedMatch = DESTINATION_NORMALIZATION_MAP.find(({ pattern }) => pattern.test(trimmedDestination));

  return normalizedMatch?.value ?? trimmedDestination;
}

export function normalizeDepartureCity(departureCity: string | null): string | null {
  // Город вылета приводим к точной подписи из popup, иначе клик по элементу не совпадет.
  if (!departureCity) {
    return null;
  }

  const trimmedDepartureCity = departureCity.trim();
  const normalizedMatch = DEPARTURE_CITY_NORMALIZATION_MAP.find(({ pattern }) => pattern.test(trimmedDepartureCity));

  return normalizedMatch?.value ?? trimmedDepartureCity;
}
