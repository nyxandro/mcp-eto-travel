/**
 * TOC:
 * - SearchResultSelectors: selector bundle for reading tour cards from the widget
 * - readFirstResult: returns the first valid tour card from search results
 * - readTopResults: returns several valid tour cards from search results without duplicates
 * - buildResultFromCard: normalizes one DOM card into a stable tour payload
 */

import type { TourSearchResult } from '../shared/types.js';
import type { BrowserElement, BrowserPage } from './browser.js';
import type { SearchAttempt } from './search-plan.js';
import { normalizeTourResult } from './tour-normalizer.js';

export interface SearchResultSelectors {
  resultCard: readonly string[];
  resultLink: readonly string[];
  resultTitle: readonly string[];
  resultPriceValue: readonly string[];
  resultPriceCurrency: readonly string[];
  resultSubtitle: readonly string[];
  resultRating: readonly string[];
  resultDescription: readonly string[];
  resultImage: readonly string[];
}

const MAX_MULTI_RESULTS = 5;

export async function readFirstResult(page: BrowserPage, attempt: SearchAttempt, selectors: SearchResultSelectors): Promise<TourSearchResult> {
  // Single-result сценарий переиспользует общий reader, чтобы логика валидации карточек не дублировалась.
  const results = await readTopResults(page, attempt, selectors, 1);

  if (!results.length) {
    throw new Error('No complete tour cards were found in search results');
  }

  return results[0]!;
}

export async function readTopResults(
  page: BrowserPage,
  attempt: SearchAttempt,
  selectors: SearchResultSelectors,
  limit = MAX_MULTI_RESULTS
): Promise<TourSearchResult[]> {
  // Подборка должна собирать несколько валидных карточек, но без дублей и мусорных элементов.
  const resultSelector = await findFirstExistingSelector(page, selectors.resultCard);

  if (!resultSelector) {
    throw new Error('Tour results were not found on eto.travel');
  }

  const cards = page.locator(resultSelector);
  const count = await cards.count();
  const results: TourSearchResult[] = [];
  const seenUrls = new Set<string>();

  for (let index = 0; index < count; index += 1) {
    const candidateCard = cards.nth(index);

    try {
      const result = await buildResultFromCard(candidateCard, attempt, selectors);

      if (seenUrls.has(result.url)) {
        continue;
      }

      seenUrls.add(result.url);
      results.push(result);

      if (results.length >= limit) {
        break;
      }
    } catch {
      // Неполные или нерелевантные карточки пропускаем, чтобы подборка состояла только из пригодных вариантов.
    }
  }

  if (!results.length) {
    throw new Error('No complete tour cards were found in search results');
  }

  return results;
}

async function buildResultFromCard(card: BrowserElement, attempt: SearchAttempt, selectors: SearchResultSelectors): Promise<TourSearchResult> {
  const title = await readTextFromNestedSelectors(card, selectors.resultTitle);
  const priceValue = await readTextFromNestedSelectors(card, selectors.resultPriceValue);
  const priceCurrency = await readTextFromNestedSelectors(card, selectors.resultPriceCurrency);
  const subtitle = await readTextFromNestedSelectors(card, selectors.resultSubtitle);
  const rating = await readTextFromNestedSelectors(card, selectors.resultRating);
  const description = await readTextFromNestedSelectors(card, selectors.resultDescription);
  const imageUrl = await readImageUrlFromNestedSelectors(card, selectors.resultImage);
  const href = await readAttributeFromNestedSelectors(card, selectors.resultLink, 'href');

  return normalizeTourResult({
    title,
    hotelName: title,
    priceText: formatPrice(priceValue, priceCurrency),
    dateText: subtitle,
    ratingText: rating,
    descriptionText: description,
    imageUrl,
    href,
    appliedFilters: {
      destination: attempt.destination,
      departureCity: attempt.departureCity,
      adults: attempt.adults,
      nights: attempt.nights,
      month: attempt.month
    },
    relaxedFilters: attempt.relaxedFilters
  });
}

async function findFirstExistingSelector(page: BrowserPage, selectors: readonly string[]): Promise<string | null> {
  // Count дешевле и устойчивее, чем клики по каждому возможному селектору по очереди.
  for (const selector of selectors) {
    const count = await page.locator(selector).count();

    if (count > 0) {
      return selector;
    }
  }

  return null;
}

function formatPrice(priceValue: string | null, priceCurrency: string | null): string | null {
  // Цена собирается из нескольких DOM-узлов, поэтому объединяем только когда числовая часть реально есть.
  if (!priceValue?.trim()) {
    return null;
  }

  const normalizedValue = priceValue.replace(/\s+/g, ' ').trim();
  const normalizedCurrency = priceCurrency?.replace(/\s+/g, ' ').trim() ?? '';

  return normalizedCurrency ? `${normalizedValue} ${normalizedCurrency}` : normalizedValue;
}

async function readTextFromNestedSelectors(card: BrowserElement, selectors: readonly string[]): Promise<string | null> {
  // Читаем первый непустой текстовый узел из известных вариантов структуры карточки.
  for (const selector of selectors) {
    const nestedLocator = card.locator(selector);
    const count = await nestedLocator.count();

    if (count > 0) {
      const textValue = await nestedLocator.first().textContent();

      if (textValue?.trim()) {
        return textValue;
      }
    }
  }

  return null;
}

async function readImageUrlFromNestedSelectors(card: BrowserElement, selectors: readonly string[]): Promise<string | null> {
  // Картинка хранится в inline style, поэтому извлекаем URL из background-image.
  for (const selector of selectors) {
    const nestedLocator = card.locator(selector);
    const count = await nestedLocator.count();

    if (count > 0) {
      const styleValue = await nestedLocator.first().evaluate((node) => node.getAttribute('style'));
      const imageUrl = extractBackgroundImageUrl(styleValue);

      if (imageUrl?.trim()) {
        return imageUrl;
      }
    }
  }

  return null;
}

async function readAttributeFromNestedSelectors(card: BrowserElement, selectors: readonly string[], attributeName: string): Promise<string | null> {
  // Ссылку и другие атрибуты читаем по нескольким шаблонам, так как виджет меняет DOM между режимами.
  for (const selector of selectors) {
    const nestedLocator = card.locator(selector);
    const count = await nestedLocator.count();

    if (count > 0) {
      const attributeValue = await nestedLocator.first().getAttribute(attributeName);

      if (attributeValue?.trim()) {
        return attributeValue;
      }
    }
  }

  return null;
}

function extractBackgroundImageUrl(styleValue: string | null): string | null {
  // Background-image приходит в виде css-строки и требует отдельного разбора.
  if (!styleValue) {
    return null;
  }

  const match = styleValue.match(/background-image:\s*url\(["']?(.*?)["']?\)/i);

  return match?.[1] ?? null;
}
