/**
 * TOC:
 * - createRuntimeConfig: normalizes process env for stdio or HTTP startup modes
 */

import { describe, expect, it } from 'vitest';

import { createRuntimeConfig } from '../config.js';

describe('createRuntimeConfig', () => {
  it('builds HTTP config with normalized host settings', () => {
    // HTTP-режим должен собирать все публичные настройки в одном месте без скрытых дефолтов.
    const config = createRuntimeConfig({
      TRANSPORT_MODE: 'http',
      HOST: '0.0.0.0',
      PORT: '3100',
      MCP_PATH: '/mcp',
      ALLOWED_HOSTS: 'mcp.example.com,localhost'
    });

    expect(config).toEqual({
      transportMode: 'http',
      http: {
        host: '0.0.0.0',
        port: 3100,
        mcpPath: '/mcp',
        allowedHosts: ['mcp.example.com', 'localhost']
      }
    });
  });

  it('keeps stdio mode when HTTP transport is not requested', () => {
    // Локальная разработка через stdio должна оставаться рабочей без дополнительных env-переменных.
    const config = createRuntimeConfig({});

    expect(config).toEqual({
      transportMode: 'stdio'
    });
  });

  it('rejects invalid HTTP ports early', () => {
    // Неверный порт должен ломать запуск сразу, чтобы контейнер не стартовал в неконсистентном состоянии.
    expect(() =>
      createRuntimeConfig({
        TRANSPORT_MODE: 'http',
        PORT: 'abc'
      })
    ).toThrow('PORT must be a valid integer when TRANSPORT_MODE=http');
  });
});
