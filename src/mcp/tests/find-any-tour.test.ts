/**
 * TOC:
 * - createFindAnyTourHandler: MCP tool handler for searching tours
 */

import { describe, expect, it, vi } from 'vitest';

import { createFindAnyTourHandler } from '../find-any-tour.js';

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
    });

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
});
