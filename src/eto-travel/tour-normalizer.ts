/**
 * TOC:
 * - ScrapedTourCandidate: raw tour fields collected from the page
 * - normalizeTourResult: validates scraped values and produces a stable MCP payload
 */

import type { TourSearchResult } from '../shared/types.js';

const ETO_TRAVEL_BASE_URL = 'https://eto.travel';

export interface ScrapedTourCandidate {
  title: string | null;
  hotelName: string | null;
  priceText: string | null;
  dateText: string | null;
  ratingText: string | null;
  descriptionText: string | null;
  imageUrl: string | null;
  href: string | null;
  appliedFilters: TourSearchResult['appliedFilters'];
  relaxedFilters: string[];
}

export function normalizeTourResult(candidate: ScrapedTourCandidate): TourSearchResult {
  // Ссылка обязательна: без нее MCP не выполняет главную бизнес-задачу пользователя.
  if (!candidate.href?.trim()) {
    throw new Error('Tour result link is required');
  }

  // Заголовок и цена также обязательны, потому что иначе ответ будет неполным и вводящим в заблуждение.
  if (!candidate.title?.trim()) {
    throw new Error('Tour result title is required');
  }

  if (!candidate.priceText?.trim()) {
    throw new Error('Tour result price is required');
  }

  // Абсолютный URL нормализуется единообразно для относительных и абсолютных ссылок.
  const normalizedUrl = new URL(candidate.href, ETO_TRAVEL_BASE_URL).toString();

  return {
    title: candidate.title.trim(),
    hotelName: candidate.hotelName?.trim() || null,
    price: candidate.priceText.trim(),
    dates: candidate.dateText?.trim() || null,
    rating: candidate.ratingText?.trim() || null,
    location: candidate.dateText?.trim() || null,
    description: candidate.descriptionText?.trim() || null,
    imageUrl: candidate.imageUrl?.trim() || null,
    url: normalizedUrl,
    appliedFilters: candidate.appliedFilters,
    relaxedFilters: candidate.relaxedFilters,
    source: 'ui'
  };
}
