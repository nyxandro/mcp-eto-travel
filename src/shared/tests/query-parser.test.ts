/**
 * TOC:
 * - parseSearchQuery: extracts lightweight search filters from free text
 */

import { describe, expect, it } from 'vitest';

import { parseSearchQuery } from '../query-parser.js';

describe('parseSearchQuery', () => {
  it('extracts destination, adults, nights and month hints', () => {
    // Проверяем, что пользовательский текст превращается в понятные фильтры.
    const result = parseSearchQuery('Найди тур в Турцию на май на 7 ночей для 2 взрослых');

    expect(result.destination).toBe('Турция');
    expect(result.departureCity).toBeNull();
    expect(result.adults).toBe(2);
    expect(result.nights).toBe(7);
    expect(result.month).toBe('май');
  });

  it('normalizes departure city from free text', () => {
    // Город вылета должен приводиться к подписи, которая реально есть в popup виджета.
    const result = parseSearchQuery('Найди тур в Турцию из Санкт-Петербурга на 7 ночей');

    expect(result.departureCity).toBe('С.Петербург');
    expect(result.destination).toBe('Турция');
  });

  it('keeps raw query when explicit filters were not found', () => {
    // Пустые распознанные фильтры не должны ломать произвольный запрос.
    const result = parseSearchQuery('Найди любой недорогой тур');

    expect(result.rawQuery).toBe('Найди любой недорогой тур');
    expect(result.destination).toBeNull();
    expect(result.departureCity).toBeNull();
    expect(result.adults).toBeNull();
    expect(result.nights).toBeNull();
    expect(result.month).toBeNull();
  });
});
