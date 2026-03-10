/**
 * TOC:
 * - BrowserPage: minimal page contract used by the scraper
 * - BrowserContextHandle: lifecycle contract for a launched browser session
 * - PlaywrightBrowserLauncher: opens chromium and prepares a fresh page
 */

import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';

export interface BrowserElement {
  click(options?: { timeout?: number }): Promise<void>;
  fill(value: string, options?: { timeout?: number }): Promise<void>;
  textContent(): Promise<string | null>;
  getAttribute(name: string): Promise<string | null>;
  evaluate<R>(pageFunction: (node: Element) => R): Promise<R>;
  locator(childSelector: string): BrowserLocator;
}

export interface BrowserLocator {
  count(): Promise<number>;
  first(): BrowserElement;
  nth(index: number): BrowserElement;
}

export interface BrowserPage {
  goto(url: string, options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; timeout?: number }): Promise<unknown>;
  waitForTimeout(timeout: number): Promise<void>;
  waitForSelector(selector: string, options?: { timeout?: number; state?: 'attached' | 'detached' | 'visible' | 'hidden' }): Promise<unknown>;
  locator(selector: string): BrowserLocator;
}

export interface BrowserContextHandle {
  page: BrowserPage;
  close(): Promise<void>;
}

export interface BrowserLauncher {
  launch(): Promise<BrowserContextHandle>;
}

export class PlaywrightBrowserLauncher implements BrowserLauncher {
  async launch(): Promise<BrowserContextHandle> {
    // Отдельный context нужен, чтобы каждая MCP-команда работала изолированно и не смешивала cookies.
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ locale: 'ru-RU' });
    const page = await context.newPage();

    return createBrowserContextHandle(browser, context, page);
  }
}

function createBrowserContextHandle(browser: Browser, context: BrowserContext, page: Page): BrowserContextHandle {
  return {
    page,
    async close(): Promise<void> {
      // Закрываем context перед браузером, чтобы Playwright корректно освободил все страницы и ресурсы.
      await context.close();
      await browser.close();
    }
  };
}
