/**
 * TOC:
 * - normalizeTourResult: converts scraped data into stable MCP payload
 */

import { describe, expect, it } from 'vitest';

import { normalizeTourResult } from '../tour-normalizer.js';

describe('normalizeTourResult', () => {
  it('normalizes relative links against eto.travel base url', () => {
    // Ссылка должна быть абсолютной, чтобы LLM могла сразу отдать ее пользователю.
    const result = normalizeTourResult({
      title: 'Тур в Египет',
      hotelName: 'Sunny Beach',
      priceText: '120 000 RUB',
      dateText: '12.06 - 19.06',
      ratingText: '4.7',
      descriptionText: 'Описание отеля',
      imageUrl: 'https://example.com/hotel.jpg',
      href: '/tour/123',
      appliedFilters: {
        destination: 'Египет',
        departureCity: 'Москва',
        adults: 2,
        nights: 7,
        month: 'май'
      },
      relaxedFilters: []
    });

    expect(result.url).toBe('https://eto.travel/tour/123');
    expect(result.title).toContain('Тур в Египет');
    expect(result.hotelName).toBe('Sunny Beach');
    expect(result.rating).toBe('4.7');
    expect(result.imageUrl).toBe('https://example.com/hotel.jpg');
    expect(result.appliedFilters.destination).toBe('Египет');
  });

  it('throws when source data misses a required link', () => {
    // Без ссылки результат бесполезен, поэтому сервер обязан упасть явно.
    expect(() =>
      normalizeTourResult({
        title: 'Broken result',
        hotelName: null,
        priceText: '100 000 RUB',
        dateText: null,
        ratingText: null,
        descriptionText: null,
        imageUrl: null,
        href: '',
        appliedFilters: {
          destination: null,
          departureCity: null,
          adults: null,
          nights: null,
          month: null
        },
        relaxedFilters: []
      })
    ).toThrow('Tour result link is required');
  });

  it('rejects tours that do not match the requested destination', () => {
    // Если пользователь ищет Сочи, результат по Ессентукам нельзя считать валидным даже при совпадении остальных фильтров.
    expect(() =>
      normalizeTourResult({
        title: 'Комфорт',
        hotelName: 'Комфорт',
        priceText: '28 972 RUB',
        dateText: 'Ессентуки, Кав. Мин. Воды',
        ratingText: '4.5',
        descriptionText: 'Санаторий в центре курорта',
        imageUrl: 'https://example.com/hotel.jpg',
        href: '/tour/456',
        appliedFilters: {
          destination: 'Сочи',
          departureCity: 'Москва',
          adults: 2,
          nights: 7,
          month: 'апрель'
        },
        relaxedFilters: ['month']
      })
    ).toThrow('Tour result does not match requested destination: Сочи');
  });
});
