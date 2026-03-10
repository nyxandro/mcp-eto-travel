/**
 * TOC:
 * - createSearchAttempts: fallback plan for graceful result recovery
 */

import { describe, expect, it } from 'vitest';

import { createSearchAttempts } from '../search-plan.js';

describe('createSearchAttempts', () => {
  it('builds exact and relaxed attempts without duplicates', () => {
    // Порядок попыток важен: сначала точный запрос, потом постепенное ослабление фильтров.
    const attempts = createSearchAttempts({
      destination: 'Турция',
      departureCity: 'С.Петербург',
      adults: 3,
      nights: 7,
      month: 'апрель',
      rawQuery: 'Турция из Санкт-Петербурга на апрель на 7 ночей'
    });

    expect(attempts[0]).toMatchObject({
      destination: 'Турция',
      departureCity: 'С.Петербург',
      nights: 7,
      month: 'апрель',
      relaxedFilters: []
    });
    expect(attempts.some((attempt) => attempt.relaxedFilters.includes('month'))).toBe(true);
    expect(attempts.some((attempt) => attempt.relaxedFilters.includes('departureCity'))).toBe(true);
    expect(attempts.some((attempt) => attempt.relaxedFilters.includes('nights'))).toBe(true);
    expect(new Set(attempts.map((attempt) => JSON.stringify(attempt))).size).toBe(attempts.length);
  });
});
