/**
 * TOC:
 * - SearchAttempt: concrete filter set for one search try
 * - createSearchAttempts: builds a fallback plan that gradually relaxes filters
 */

import type { TourSearchInput } from '../shared/types.js';

export interface SearchAttempt {
  destination: string | null;
  departureCity: string | null;
  adults: number | null;
  nights: number | null;
  month: string | null;
  relaxedFilters: string[];
}

export function createSearchAttempts(parsedQuery: TourSearchInput): SearchAttempt[] {
  // План строится от самого точного запроса к более мягким, чтобы не терять релевантность раньше времени.
  const attempts: SearchAttempt[] = [];
  const seenKeys = new Set<string>();

  const candidates: SearchAttempt[] = [
    buildAttempt(parsedQuery, []),
    buildAttempt(parsedQuery, ['month']),
    buildAttempt(parsedQuery, ['month', 'departureCity', 'nights']),
    buildAttempt(parsedQuery, ['departureCity']),
    buildAttempt(parsedQuery, ['nights']),
    buildAttempt(parsedQuery, ['month', 'departureCity']),
    buildAttempt(parsedQuery, ['month', 'nights']),
    buildAttempt(parsedQuery, ['departureCity', 'nights']),
    buildAttempt(parsedQuery, ['month', 'departureCity', 'nights'])
  ];

  for (const candidate of candidates) {
    const key = JSON.stringify(candidate);

    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    attempts.push(candidate);
  }

  return attempts;
}

function buildAttempt(parsedQuery: TourSearchInput, relaxedFilters: Array<'month' | 'departureCity' | 'nights'>): SearchAttempt {
  // Ослабляем только подтвержденные проблемные фильтры; страну и количество взрослых сохраняем как бизнес-критичные.
  return {
    destination: parsedQuery.destination,
    departureCity: relaxedFilters.includes('departureCity') ? null : parsedQuery.departureCity,
    adults: parsedQuery.adults,
    nights: relaxedFilters.includes('nights') ? null : parsedQuery.nights,
    month: relaxedFilters.includes('month') ? null : parsedQuery.month,
    relaxedFilters: [...relaxedFilters]
  };
}
