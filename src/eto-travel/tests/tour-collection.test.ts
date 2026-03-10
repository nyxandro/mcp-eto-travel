/**
 * TOC:
 * - buildTourCollection: categorizes multiple tours into budget/optimal/premium buckets
 */

import { describe, expect, it } from 'vitest';

import { buildTourCollection } from '../tour-collection.js';
import type { TourSearchResult } from '../../shared/types.js';

describe('buildTourCollection', () => {
  it('sorts tours by price and assigns stable presentation categories', () => {
    // Категории нужны не для бизнес-логики, а для удобной подачи пользователю нескольких опций.
    const collection = buildTourCollection([
      createTour('Luxury Resort', '180 000 RUB'),
      createTour('Budget Hotel', '90 000 RUB'),
      createTour('Comfort Hotel', '115 000 RUB')
    ]);

    expect(collection.tours.map((tour: TourSearchResult & { category: string }) => [tour.title, tour.category])).toEqual([
      ['Budget Hotel', 'budget'],
      ['Comfort Hotel', 'optimal'],
      ['Luxury Resort', 'premium']
    ]);
  });
});

function createTour(title: string, price: string): TourSearchResult {
  return {
    title,
    hotelName: title,
    price,
    dates: 'Сиде, 300 м до моря',
    rating: '4.5',
    location: 'Сиде, 300 м до моря',
    description: 'Описание',
    imageUrl: 'https://example.com/hotel.jpg',
    url: `https://example.com/${title.toLowerCase().replace(/\s+/g, '-')}`,
    appliedFilters: {
      destination: 'Турция',
      departureCity: 'Москва',
      adults: 2,
      nights: 7,
      month: 'июнь'
    },
    relaxedFilters: [],
    source: 'ui' as const
  };
}
