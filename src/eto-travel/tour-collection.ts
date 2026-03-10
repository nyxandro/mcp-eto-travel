/**
 * TOC:
 * - buildTourCollection: sorts and categorizes several tour options for richer MCP responses
 * - parsePriceAmount: extracts a comparable numeric amount from price text
 */

import type { TourSearchCollection, TourSearchResult, TourSelectionCategory } from '../shared/types.js';

const MAX_TOUR_OPTIONS = 3;
const CATEGORY_ORDER: readonly TourSelectionCategory[] = ['budget', 'optimal', 'premium'] as const;

export function buildTourCollection(tours: TourSearchResult[]): TourSearchCollection {
  // Для подборки сортируем варианты по цене, чтобы бюджетный и премиальный слоты были предсказуемыми.
  const sortedTours = [...tours].sort((leftTour, rightTour) => parsePriceAmount(leftTour.price) - parsePriceAmount(rightTour.price));
  const selectedTours = sortedTours.slice(0, MAX_TOUR_OPTIONS);

  return {
    tours: selectedTours.map((tour, index) => ({
      ...tour,
      category: CATEGORY_ORDER[Math.min(index, CATEGORY_ORDER.length - 1)]
    }))
  };
}

function parsePriceAmount(price: string): number {
  // Сравниваем только числовую часть цены и не придумываем fallback-значения, если цена повреждена.
  const digitsOnly = price.replace(/[^\d]/g, '');

  if (!digitsOnly) {
    throw new Error(`Unable to parse tour price: ${price}`);
  }

  return Number.parseInt(digitsOnly, 10);
}
