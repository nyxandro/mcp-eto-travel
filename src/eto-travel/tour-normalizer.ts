/**
 * TOC:
 * - ScrapedTourCandidate: raw tour fields collected from the page
 * - normalizeTourResult: validates scraped values and produces a stable MCP payload
 * - validateDestinationRelevance: rejects tours that do not match the requested destination
 */

import type { TourSearchResult } from '../shared/types.js';

const ETO_TRAVEL_BASE_URL = 'https://eto.travel';
const STRICT_DESTINATION_ALIAS_MAP: ReadonlyArray<{ canonical: string; aliases: readonly string[] }> = [
  { canonical: 'Сочи', aliases: ['сочи', 'адлер', 'имерет', 'красная поляна', 'хоста', 'дагомыс', 'лоо', 'мамайка'] },
  { canonical: 'Ессентуки', aliases: ['ессентуки', 'кав. мин. воды', 'кавминводы', 'кмв'] }
] as const;

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

  // Перед возвратом карточки убеждаемся, что scraped-результат действительно относится к запрошенному направлению.
  validateDestinationRelevance(candidate);

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

function validateDestinationRelevance(candidate: ScrapedTourCandidate): void {
  // Если направление не задано, отдельную проверку не делаем — обязательность уже обеспечивается на входе search flow.
  const requestedDestination = candidate.appliedFilters.destination?.trim();

  if (!requestedDestination) {
    return;
  }

  // Сопоставляем направление по нескольким текстовым полям карточки, потому что виджет может раскладывать локацию по subtitle/description.
  const searchableText = [candidate.title, candidate.hotelName, candidate.dateText, candidate.descriptionText]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .toLowerCase();

  const aliases = getDestinationAliases(requestedDestination);

  if (!aliases) {
    return;
  }

  const matchesRequestedDestination = aliases.some((alias) => searchableText.includes(alias));

  if (!matchesRequestedDestination) {
    throw new Error(`Tour result does not match requested destination: ${requestedDestination}`);
  }
}

function getDestinationAliases(destination: string): readonly string[] | null {
  // Строгую гео-проверку включаем только для точечных курортов/городов, а не для широких страновых направлений.
  const normalizedDestination = destination.trim().toLowerCase();
  const knownAliasGroup = STRICT_DESTINATION_ALIAS_MAP.find(({ canonical, aliases }) => {
    return canonical.toLowerCase() === normalizedDestination || aliases.includes(normalizedDestination);
  });

  if (knownAliasGroup) {
    return knownAliasGroup.aliases;
  }

  return null;
}
