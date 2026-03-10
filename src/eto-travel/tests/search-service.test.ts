/**
 * TOC:
 * - EtoTravelSearchService: UI-based search flow through the eto.travel widget
 */

import { describe, expect, it } from 'vitest';

import { EtoTravelSearchService } from '../search-service.js';
import type { BrowserContextHandle, BrowserElement, BrowserLauncher, BrowserLocator, BrowserPage } from '../browser.js';

describe('EtoTravelSearchService', () => {
  it('returns normalized first result from the live widget structure', async () => {
    // Тест опирается на фактические классы карточек и popup-контролов Tourvisor-виджета.
    const browserLauncher = new FakeBrowserLauncher(createBaseSelectorMap());
    const service = new EtoTravelSearchService(browserLauncher);

    const result = await service.searchAnyTour({
      destination: 'Турция',
      departureCity: 'Санкт-Петербург',
      adults: 3,
      nights: 7,
      month: 'апрель',
      rawQuery: 'Найди тур в Турцию из Санкт-Петербурга на апрель на 7 ночей для 3 взрослых'
    });

    expect(result).toMatchObject({
      title: 'Viva Магнолия',
      hotelName: 'Viva Магнолия',
      price: '29 027 RUB',
      dates: 'Адлер, Сочи, 350 м до моря',
      rating: '3.3',
      description: 'Отель на тихой улице',
      imageUrl: 'https://static.tourvisor.ru/hotel_pics/main400/80505.jpg',
      relaxedFilters: [],
      url: 'https://tourcart.ru/hotel?cd=99414988#!/hotel=viva-magnoliya'
    });
    expect(browserLauncher.pageState.clickCalls).toContain('.TVDepartureTableItemControl');
    expect(browserLauncher.pageState.clickCalls).toContain('.TVCalendarSheetControl .TVCalendarTableCell.TVCalendarAvailableDayCell');
  });

  it('does not use text input fills for popup-driven controls', async () => {
    // Для popup-виджета корректная автоматизация идет через клики, а не через фиктивные fill-вызовы.
    const browserLauncher = new FakeBrowserLauncher(createBaseSelectorMap());
    const service = new EtoTravelSearchService(browserLauncher);

    await service.searchAnyTour({
      destination: 'Турция',
      departureCity: null,
      adults: 2,
      nights: 7,
      month: null,
      rawQuery: 'Турция на 7 ночей для 2 взрослых'
    });

    expect(browserLauncher.pageState.fillCalls).toEqual([]);
  });

  it('does not reload the search page before the first attempt', async () => {
    // Первый точный прогон должен использовать уже открытую страницу, иначе время ответа MCP уходит на лишний reload.
    const browserLauncher = new FakeBrowserLauncher(createBaseSelectorMap());
    const service = new EtoTravelSearchService(browserLauncher);

    await service.searchAnyTour({
      destination: 'Турция',
      departureCity: null,
      adults: 2,
      nights: 7,
      month: null,
      rawQuery: 'Турция на 7 ночей для 2 взрослых'
    });

    expect(browserLauncher.pageState.gotoCalls).toBe(1);
  });
});

function createBaseSelectorMap(): Record<string, number> {
  return {
    '.TVSResultItem': 2,
    '.TVSResultItemTitle': 1,
    '.TVSResultItemPriceValue': 1,
    '.TVSResultItemPriceCurrency': 1,
    '.TVSHotelInfoRating': 1,
    '.TVSResultItemDescription': 1,
    '.TVPhotoGalleryImage': 1,
    '.TVHotelInfoTitleLink': 1,
    '.TVSResultItemSubTitle': 1,
    '.TVSearchButton': 1,
    '.tv-search-form': 1,
    '.TVDepartureSelect .TVMainSelect': 1,
    '.TVDepartureTableItemControl': 3,
    '.TVCountrySelect .TVMainSelect': 1,
    '.TVCountrySelectTooltip .TVComplexListItem': 2,
    '.TVFlyDatesSelect .TVMainSelect': 1,
    '.TVCalendarSheetControl': 2,
    '.TVCalendarSheetControl .TVCalendarTableCell.TVCalendarAvailableDayCell': 2,
    '.TVNightsFilter .TVMainSelect': 1,
    '.TVRangeSelectTooltip .TVRangeTableCell': 2,
    'body': 1,
    '.TVTouristsFilter .TVMainSelect': 1,
    '.TVTouristsSelectTooltip .TVTouristCount': 1,
    '.TVTouristsSelectTooltip .TVTouristActionPlus': 1,
    '.TVTouristsSelectTooltip .TVTouristActionMinus': 1,
    '.TVTouristsSelectTooltip .TVButtonControl': 1
  };
}

class FakeBrowserLauncher implements BrowserLauncher {
  readonly pageState = {
    fillCalls: [] as Array<{ selector: string; value: string }>,
    clickCalls: [] as string[],
    totalWaitMs: 0,
    gotoCalls: 0
  };

  constructor(private readonly selectorCounts: Record<string, number>) {}

  async launch(): Promise<BrowserContextHandle> {
    return {
      page: new FakeBrowserPage(this.selectorCounts, this.pageState),
      async close(): Promise<void> {
        // Пустой close достаточен для unit/integration-like проверки orchestration-логики.
      }
    };
  }
}

class FakeBrowserPage implements BrowserPage {
  constructor(
    private readonly selectorCounts: Record<string, number>,
    private readonly pageState: {
      fillCalls: Array<{ selector: string; value: string }>;
      clickCalls: string[];
      totalWaitMs: number;
      gotoCalls: number;
    }
  ) {}

  async goto(): Promise<void> {
    this.pageState.gotoCalls += 1;
  }

  async waitForTimeout(timeout: number): Promise<void> {
    this.pageState.totalWaitMs += timeout;
  }

  async waitForSelector(): Promise<void> {}

  locator(selector: string): BrowserLocator {
    return new FakeLocator(selector, this.selectorCounts, this.pageState);
  }
}

class FakeLocator implements BrowserLocator {
  constructor(
    private readonly selector: string,
    private readonly selectorCounts: Record<string, number>,
    private readonly pageState: {
      fillCalls: Array<{ selector: string; value: string }>;
      clickCalls: string[];
      totalWaitMs: number;
      gotoCalls: number;
    }
  ) {}

  async count(): Promise<number> {
    // Каждая проверка count управляется картой селекторов, чтобы тесты имитировали разные DOM-сценарии.
    return this.selectorCounts[this.selector] ?? 0;
  }

  first(): BrowserElement {
    return new FakeElement(this.selector, this.selectorCounts, this.pageState);
  }

  nth(): BrowserElement {
    return new FakeElement(this.selector, this.selectorCounts, this.pageState);
  }
}

class FakeElement implements BrowserElement {
  constructor(
    private readonly selector: string,
    private readonly selectorCounts: Record<string, number>,
    private readonly pageState: {
      fillCalls: Array<{ selector: string; value: string }>;
      clickCalls: string[];
      totalWaitMs: number;
      gotoCalls: number;
    }
  ) {}

  async click(): Promise<void> {
    this.pageState.clickCalls.push(this.selector);
  }

  async fill(value: string): Promise<void> {
    this.pageState.fillCalls.push({ selector: this.selector, value });
  }

  async textContent(): Promise<string | null> {
    // Возвращаем реальные поля под фактические live-селекторы результата и popup-элементов.
    if (this.selector.includes('PriceValue')) {
      return '29 027';
    }

    if (this.selector.includes('PriceCurrency')) {
      return 'RUB';
    }

    if (this.selector.includes('Rating')) {
      return '3.3';
    }

    if (this.selector.includes('SubTitle')) {
      return 'Адлер, Сочи, 350 м до моря';
    }

    if (this.selector.includes('Description')) {
      return 'Отель на тихой улице';
    }

    if (this.selector.includes('TouristCount')) {
      return '2';
    }

    if (this.selector.includes('DepartureTableItemControl')) {
      return 'С.Петербург';
    }

    if (this.selector.includes('ComplexListItem')) {
      return 'ТурцияАэропортАнталья';
    }

    if (this.selector.includes('CalendarSheetControl')) {
      return 'Апрель2026';
    }

    if (this.selector.includes('CalendarTableCell')) {
      return '1';
    }

    if (this.selector.includes('RangeTableCell')) {
      return '7ночей';
    }

    return 'Viva Магнолия';
  }

  async getAttribute(name: string): Promise<string | null> {
    // Ссылка на карточку должна читаться из дочернего anchor-элемента.
    if (name === 'href') {
      return 'https://tourcart.ru/hotel?cd=99414988#!/hotel=viva-magnoliya';
    }

    return null;
  }

  async evaluate<R>(pageFunction: (node: Element) => R): Promise<R> {
    if (this.selector.includes('PhotoGalleryImage')) {
      const element = {
        getAttribute: (name: string) =>
          name === 'style' ? 'background-image: url("https://static.tourvisor.ru/hotel_pics/main400/80505.jpg");' : null
      } as unknown as Element;

      return pageFunction(element);
    }

    return pageFunction({ getAttribute: () => null } as unknown as Element);
  }

  locator(childSelector: string): BrowserLocator {
    const nextCounts = { ...this.selectorCounts };

    if (this.selector === '.TVCalendarSheetControl' && childSelector === '.TVCalendarSheetControl .TVCalendarTableCell.TVCalendarAvailableDayCell') {
      nextCounts['calendar-panel-april'] = 1;
    }

    return new FakeLocator(childSelector, nextCounts, this.pageState);
  }
}
