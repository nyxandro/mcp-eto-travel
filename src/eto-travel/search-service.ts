/**
 * TOC:
 * - EtoTravelSearchService: searches eto.travel through the embedded Tourvisor UI
 * - normalizeSearchInput: validates and normalizes structured MCP search filters
 * - SEARCH_PAGE_URL: main search page for tours
 * - SEARCH_SELECTORS: selector map for widget controls and result cards
 * - FORM_BEHAVIOR: rules for when filters can be safely changed
 * - buildSearchResults: executes search attempts and reads one or several valid result cards
 */

import { normalizeDepartureCity, normalizeDestination } from '../shared/query-parser.js';
import type { TourSearchClient, TourSearchCollection, TourSearchInput, TourSearchResult } from '../shared/types.js';
import type { BrowserContextHandle, BrowserElement, BrowserLauncher, BrowserPage } from './browser.js';
import { createSearchAttempts, type SearchAttempt } from './search-plan.js';
import { readFirstResult, readTopResults } from './search-results-reader.js';
import { buildTourCollection } from './tour-collection.js';

const SEARCH_PAGE_URL = 'https://eto.travel/search/';
const SHORT_UI_PAUSE_MS = 1_000;
const SEARCH_RESULTS_WAIT_MS = 15_000;
const DEFAULT_WAIT_TIMEOUT_MS = 25_000;

const SEARCH_SELECTORS = {
  widgetRoot: ['.tv-search-form', '.TVMainForm', '[class*="TVMainForm"]'],
  searchButton: ['.TVSearchButton', 'button.TVSearchButton', '[class*="TVSearchButton"]'],
  departureTrigger: ['.TVDepartureSelect .TVMainSelect'],
  countryTrigger: ['.TVCountrySelect .TVMainSelect'],
  nightsTrigger: ['.TVNightsFilter .TVMainSelect'],
  adultsTrigger: ['.TVTouristsFilter .TVMainSelect'],
  departureOption: ['.TVDepartureTableItemControl'],
  dateTrigger: ['.TVFlyDatesSelect .TVMainSelect'],
  dateOption: ['.TVCalendarSheetControl .TVCalendarTableCell.TVCalendarAvailableDayCell'],
  countryOption: ['.TVCountrySelectTooltip .TVComplexListItem'],
  nightsOption: ['.TVRangeSelectTooltip .TVRangeTableCell'],
  touristsPlusButton: ['.TVTouristsSelectTooltip .TVTouristActionPlus'],
  touristsMinusButton: ['.TVTouristsSelectTooltip .TVTouristActionMinus'],
  touristsCount: ['.TVTouristsSelectTooltip .TVTouristCount'],
  touristsSubmitButton: ['.TVTouristsSelectTooltip .TVButtonControl'],
  resultCard: ['.TVSResultItem', '.TVResultItem', '.TVSRResult', '[class*="TVSResultItem"]'],
  resultLink: ['.TVHotelInfoTitleLink', 'a[data-tvtourlink]', 'a[href*="tourcart.ru"]', 'a[href*="hotel"]', 'a'],
  resultTitle: ['.TVSResultItemTitle', '.TVHotelInfoTitleLink', '.TVResultItemTitle', '.TVResultItemHotelName'],
  resultPriceValue: ['.TVSResultItemPriceValue', '.TVResultItemPriceValue', '.TVResultItemPrice'],
  resultPriceCurrency: ['.TVSResultItemPriceCurrency', '.TVResultItemPriceCurrency'],
  resultSubtitle: ['.TVSResultItemSubTitle', '.TVResultItemDate', '.TVResultItemDates', '[class*="SubTitle"]'],
  resultRating: ['.TVSHotelInfoRating', '.TVHotelInfoRating', '[class*="Rating"]'],
  resultDescription: ['.TVSResultItemDescription', '.TVResultItemDescription', '[class*="Description"]'],
  resultImage: ['.TVPhotoGalleryImage', '.TVResultItemGallery .TVPhotoGalleryImage']
} as const;

const FORM_BEHAVIOR = {
  allowCountrySelection: true,
  allowNightsSelection: true,
  allowAdultsSelection: true
} as const;

export class EtoTravelSearchService implements TourSearchClient {
  constructor(private readonly browserLauncher: BrowserLauncher) {}

  async searchAnyTour(input: TourSearchInput): Promise<TourSearchResult> {
    // Валидируем структурированный ввод до запуска браузера, чтобы LLM-клиент быстро видел ошибку в аргументах.
    const parsedQuery = normalizeSearchInput(input);

    const browserSession = await this.browserLauncher.launch();

    try {
      const results = await this.searchWithBrowser(browserSession, parsedQuery, 1);

      return results[0]!;
    } catch (error) {
      // Ошибка поднимается с контекстом, чтобы оператор MCP видел, на каком этапе сломался сценарий.
      throw new Error(`eto.travel search failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await browserSession.close();
    }
  }

  async searchTourOptions(input: TourSearchInput): Promise<TourSearchCollection> {
    // Многовариантный поиск переиспользует тот же браузерный сценарий, но читает несколько валидных карточек.
    const parsedQuery = normalizeSearchInput(input);
    const browserSession = await this.browserLauncher.launch();

    try {
      const results = await this.searchWithBrowser(browserSession, parsedQuery, 3);

      return buildTourCollection(results);
    } catch (error) {
      throw new Error(`eto.travel search failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await browserSession.close();
    }
  }

  private async searchWithBrowser(browserSession: BrowserContextHandle, parsedQuery: TourSearchInput, resultLimit: number): Promise<TourSearchResult[]> {
    const { page } = browserSession;

    return buildSearchResults(page, parsedQuery, resultLimit);
  }
}

async function buildSearchResults(page: BrowserPage, parsedQuery: TourSearchInput, resultLimit: number): Promise<TourSearchResult[]> {
  const searchAttempts = createSearchAttempts(parsedQuery);

  // Сначала открываем страницу и дожидаемся полной отрисовки встроенного виджета.
  await page.goto(SEARCH_PAGE_URL, { waitUntil: 'domcontentloaded', timeout: DEFAULT_WAIT_TIMEOUT_MS });
  await waitForAnySelector(page, SEARCH_SELECTORS.widgetRoot, DEFAULT_WAIT_TIMEOUT_MS);
  await page.waitForTimeout(SHORT_UI_PAUSE_MS * 3);

  // Запускаем каскад попыток: сначала точные фильтры, затем мягкое ослабление проблемных полей.
  for (const [attemptIndex, attempt] of searchAttempts.entries()) {
    // Повторный reload нужен только перед fallback-попытками; первый точный прогон использует уже открытую страницу.
    if (attemptIndex > 0) {
      await resetSearchPage(page);
    }

    await applySafeFilters(page, attempt);
    await triggerSearch(page);

    if (await hasNoResults(page)) {
      continue;
    }

    try {
      return resultLimit === 1
        ? [await readFirstResult(page, attempt, SEARCH_SELECTORS)]
        : await readTopResults(page, attempt, SEARCH_SELECTORS, resultLimit);
    } catch {
      // Если на текущей попытке нет пригодных карточек, идем к следующему fallback-набору фильтров.
    }
  }

  throw new Error('No tours were found for the requested filters, including relaxed attempts');
}

function normalizeSearchInput(input: TourSearchInput): TourSearchInput {
  // Направление обязательно: без него поиск будет слишком расплывчатым и неуправляемым.
  const destination = input.destination.trim();

  if (!destination) {
    throw new Error('Destination is required');
  }

  // Необязательные строковые поля подрезаем, чтобы не передавать в UI пустые пробельные значения.
  const departureCity = input.departureCity?.trim() || null;
  const month = input.month?.trim() || null;
  const rawQuery = input.rawQuery?.trim() || null;

  // Числовые фильтры валидируем строго, потому что виджет не умеет обрабатывать дробные или нулевые значения.
  validatePositiveInteger(input.adults, 'Adults');
  validatePositiveInteger(input.nights, 'Nights');

  return {
    destination: normalizeDestination(destination) ?? destination,
    departureCity: normalizeDepartureCity(departureCity),
    adults: input.adults,
    nights: input.nights,
    month,
    rawQuery
  };
}

function validatePositiveInteger(value: number | null, fieldName: string): void {
  // Ошибку возвращаем сразу на границе сервиса, чтобы caller скорректировал tool arguments, а не получил сбой глубже в UI.
  if (value === null) {
    return;
  }

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
}

async function applySafeFilters(page: BrowserPage, parsedQuery: SearchAttempt): Promise<void> {
  // Меняем только те фильтры, для которых подтвержден живой сценарий выбора через popup.
  if (parsedQuery.destination && FORM_BEHAVIOR.allowCountrySelection) {
    await selectCountry(page, parsedQuery.destination);
  }

  if (parsedQuery.departureCity) {
    await selectDepartureCity(page, parsedQuery.departureCity);
  }

  if (parsedQuery.nights !== null && FORM_BEHAVIOR.allowNightsSelection) {
    await selectNights(page, parsedQuery.nights);
  }

  if (parsedQuery.month !== null) {
    await selectFlightDate(page, parsedQuery.month);
  }

  if (parsedQuery.adults !== null && FORM_BEHAVIOR.allowAdultsSelection) {
    await selectAdults(page, parsedQuery.adults);
  }
}

async function selectDepartureCity(page: BrowserPage, departureCity: string): Promise<void> {
  const triggerSelector = await ensureSelectorExists(page, SEARCH_SELECTORS.departureTrigger, 'Departure filter trigger was not found');

  await page.locator(triggerSelector).first().click({ timeout: DEFAULT_WAIT_TIMEOUT_MS });
  await page.waitForTimeout(SHORT_UI_PAUSE_MS);

  const optionSelector = await ensureSelectorExists(page, SEARCH_SELECTORS.departureOption, 'Departure options were not found');
  const option = await findElementByText(page, optionSelector, departureCity);

  if (!option) {
    throw new Error(`Departure city option was not found for: ${departureCity}`);
  }

  await option.click({ timeout: DEFAULT_WAIT_TIMEOUT_MS });
  await page.waitForTimeout(SHORT_UI_PAUSE_MS);
}

async function selectCountry(page: BrowserPage, destination: string): Promise<void> {
  const triggerSelector = await ensureSelectorExists(page, SEARCH_SELECTORS.countryTrigger, 'Country filter trigger was not found');

  await page.locator(triggerSelector).first().click({ timeout: DEFAULT_WAIT_TIMEOUT_MS });
  await page.waitForTimeout(SHORT_UI_PAUSE_MS);

  const optionSelector = await ensureSelectorExists(page, SEARCH_SELECTORS.countryOption, 'Country options were not found');
  const option = await findElementByText(page, optionSelector, destination);

  if (!option) {
    throw new Error(`Country option was not found for: ${destination}`);
  }

  await option.click({ timeout: DEFAULT_WAIT_TIMEOUT_MS });
  await page.waitForTimeout(SHORT_UI_PAUSE_MS);
}

async function selectNights(page: BrowserPage, nights: number): Promise<void> {
  const triggerSelector = await ensureSelectorExists(page, SEARCH_SELECTORS.nightsTrigger, 'Nights filter trigger was not found');

  await page.locator(triggerSelector).first().click({ timeout: DEFAULT_WAIT_TIMEOUT_MS });
  await page.waitForTimeout(SHORT_UI_PAUSE_MS);

  const optionSelector = await ensureSelectorExists(page, SEARCH_SELECTORS.nightsOption, 'Nights options were not found');
  const option = await findElementByText(page, optionSelector, `${nights}ноч`);

  if (!option) {
    throw new Error(`Nights option was not found for: ${nights}`);
  }

  await option.click({ timeout: DEFAULT_WAIT_TIMEOUT_MS });
  await page.waitForTimeout(SHORT_UI_PAUSE_MS / 2);
  await closePopupByClickingOutside(page);
  await page.waitForTimeout(SHORT_UI_PAUSE_MS);
}

async function selectAdults(page: BrowserPage, adults: number): Promise<void> {
  const triggerSelector = await ensureSelectorExists(page, SEARCH_SELECTORS.adultsTrigger, 'Tourists filter trigger was not found');

  await page.locator(triggerSelector).first().click({ timeout: DEFAULT_WAIT_TIMEOUT_MS });
  await page.waitForTimeout(SHORT_UI_PAUSE_MS);

  const countSelector = await ensureSelectorExists(page, SEARCH_SELECTORS.touristsCount, 'Tourists count was not found');
  const plusSelector = await ensureSelectorExists(page, SEARCH_SELECTORS.touristsPlusButton, 'Tourists plus button was not found');
  const minusSelector = await ensureSelectorExists(page, SEARCH_SELECTORS.touristsMinusButton, 'Tourists minus button was not found');

  const currentAdults = await readTouristCount(page, countSelector);
  const delta = adults - currentAdults;

  if (delta > 0) {
    await repeatClicks(page, plusSelector, delta);
  }

  if (delta < 0) {
    await repeatClicks(page, minusSelector, Math.abs(delta));
  }

  const submitSelector = await ensureSelectorExists(page, SEARCH_SELECTORS.touristsSubmitButton, 'Tourists submit button was not found');
  await page.locator(submitSelector).first().click({ timeout: DEFAULT_WAIT_TIMEOUT_MS });
  await page.waitForTimeout(SHORT_UI_PAUSE_MS);
}

async function selectFlightDate(page: BrowserPage, month: string): Promise<void> {
  const triggerSelector = await ensureSelectorExists(page, SEARCH_SELECTORS.dateTrigger, 'Date filter trigger was not found');

  await page.locator(triggerSelector).first().click({ timeout: DEFAULT_WAIT_TIMEOUT_MS });
  await page.waitForTimeout(SHORT_UI_PAUSE_MS);

  const optionSelector = await ensureSelectorExists(page, SEARCH_SELECTORS.dateOption, 'Date options were not found');
  const preferredDate = await findFlightDateForMonth(page, optionSelector, month);

  if (!preferredDate) {
    throw new Error(`Available flight date was not found for month: ${month}`);
  }

  await preferredDate.click({ timeout: DEFAULT_WAIT_TIMEOUT_MS });
  await page.waitForTimeout(SHORT_UI_PAUSE_MS / 2);
  await closePopupByClickingOutside(page);
  await page.waitForTimeout(SHORT_UI_PAUSE_MS);
}

async function triggerSearch(page: BrowserPage): Promise<void> {
  // Кнопка поиска обязательна для каждой попытки, независимо от набора активных фильтров.
  const searchButtonSelector = await findFirstExistingSelector(page, SEARCH_SELECTORS.searchButton);

  if (!searchButtonSelector) {
    throw new Error('Search button was not found on eto.travel');
  }

  await page.locator(searchButtonSelector).first().click({ timeout: DEFAULT_WAIT_TIMEOUT_MS });
  await page.waitForTimeout(SEARCH_RESULTS_WAIT_MS);
}

async function resetSearchPage(page: BrowserPage): Promise<void> {
  // Полный reload между попытками исключает накопление состояния popup-виджета между search attempts.
  await page.goto(SEARCH_PAGE_URL, { waitUntil: 'domcontentloaded', timeout: DEFAULT_WAIT_TIMEOUT_MS });
  await waitForAnySelector(page, SEARCH_SELECTORS.widgetRoot, DEFAULT_WAIT_TIMEOUT_MS);
  await page.waitForTimeout(SHORT_UI_PAUSE_MS * 2);
}

async function ensureSelectorExists(page: BrowserPage, selectors: readonly string[], errorMessage: string): Promise<string> {
  // Проверка отделена в helper, чтобы будущая доработка popup-автоматизации могла переиспользовать этот guard.
  const selector = await findFirstExistingSelector(page, selectors);

  if (!selector) {
    throw new Error(errorMessage);
  }

  return selector;
}

async function waitForAnySelector(page: BrowserPage, selectors: readonly string[], timeout: number): Promise<string> {
  // Виджет Tourvisor меняет классы между шаблонами, поэтому храним несколько допустимых вариантов.
  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { state: 'visible', timeout });
      return selector;
    } catch {
      // Ошибку по конкретному селектору откладываем, пока не исчерпаем все известные варианты.
    }
  }

  throw new Error(`None of the selectors matched: ${selectors.join(', ')}`);
}

async function findFirstExistingSelector(page: BrowserPage, selectors: readonly string[]): Promise<string | null> {
  // Count дешевле и устойчивее, чем последовательные клики с try/catch по всем вариантам.
  for (const selector of selectors) {
    const count = await page.locator(selector).count();

    if (count > 0) {
      return selector;
    }
  }

  return null;
}

async function findElementByText(page: BrowserPage, selector: string, text: string): Promise<BrowserElement | null> {
  const locator = page.locator(selector);
  const count = await locator.count();
  const normalizedText = text.trim().toLowerCase();

  // Перебираем все варианты в popup, потому что SDK-обертка не поддерживает hasText напрямую.
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    const candidateText = (await candidate.textContent())?.trim().toLowerCase() ?? '';

    if (candidateText.includes(normalizedText)) {
      return candidate;
    }
  }

  return null;
}

async function findFlightDateForMonth(page: BrowserPage, selector: string, month: string): Promise<BrowserElement | null> {
  const locator = page.locator('.TVCalendarSheetControl');
  const monthPanels = await locator.count();

  // Сначала находим панель нужного месяца, затем берем первый доступный день внутри нее.
  for (let index = 0; index < monthPanels; index += 1) {
    const panel = locator.nth(index);
    const panelText = (await panel.textContent())?.toLowerCase() ?? '';

    if (!panelText.includes(month.toLowerCase())) {
      continue;
    }

    const dayLocator = page.locator(selector);
    const dayCount = await dayLocator.count();

    if (dayCount > 0) {
      return dayLocator.first();
    }
  }

  return null;
}

async function hasNoResults(page: BrowserPage): Promise<boolean> {
  const resultSelector = await findFirstExistingSelector(page, SEARCH_SELECTORS.resultCard);

  if (resultSelector) {
    const resultCount = await page.locator(resultSelector).count();

    if (resultCount > 0) {
      return false;
    }
  }

  const bodyText = await page.locator('body').first().textContent();

  return bodyText?.includes('Ничего не найдено') ?? false;
}

async function readTouristCount(page: BrowserPage, selector: string): Promise<number> {
  const textValue = await page.locator(selector).first().textContent();
  const numericMatch = textValue?.match(/\d+/);

  if (!numericMatch) {
    throw new Error('Unable to parse tourists count');
  }

  return Number.parseInt(numericMatch[0], 10);
}

async function repeatClicks(page: BrowserPage, selector: string, times: number): Promise<void> {
  // Нажимаем последовательно, чтобы синхронизироваться с анимацией виджета и счетчиком туристов.
  for (let index = 0; index < times; index += 1) {
    await page.locator(selector).first().click({ timeout: DEFAULT_WAIT_TIMEOUT_MS });
    await page.waitForTimeout(SHORT_UI_PAUSE_MS / 3);
  }
}

async function closePopupByClickingOutside(page: BrowserPage): Promise<void> {
  // Для popup ночей подтверждение скрыто, поэтому закрываем его безопасным кликом в свободную область документа.
  const bodySelector = 'body';
  await page.locator(bodySelector).first().click({ timeout: DEFAULT_WAIT_TIMEOUT_MS });
}
