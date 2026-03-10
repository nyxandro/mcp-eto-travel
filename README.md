# MCP ETO Travel

MCP-сервер для поиска туров на `eto.travel` через браузерную автоматизацию Playwright.

Проект подготовлен для двух сценариев использования:

- `Local / stdio` — пользователь запускает MCP локально на своей машине.
- `Remote / self-hosted HTTP` — пользователь поднимает MCP у себя на сервере и подключается к нему по URL.

В репозитории нет привязки к вашему серверу, IP или временному домену. Всё оформлено как универсальный self-hosted проект, который любой человек сможет развернуть у себя.

## Что умеет сервер

- ищет туры через реальный UI сайта `https://eto.travel/search/`
- принимает структурированные фильтры вместо одного свободного текста
- возвращает один тур или небольшую подборку туров
- сообщает клиенту, что долгий поиск начался и может занять около минуты
- просит уточнить критичные данные, если не указаны направление, город вылета или число взрослых
- ослабляет только не-критичные фильтры (`month`, `departureCity`, `nights`), если строгий поиск не дал результата
- отбрасывает нерелевантные карточки для точечных направлений вроде `Сочи`

## Инструменты

- `find_any_tour` — поиск одного подходящего тура
- `find_tour_options` — поиск подборки туров с категориями:
  - `budget` — самый бюджетный вариант
  - `optimal` — самый сбалансированный вариант
  - `premium` — самый дорогой или комфортный вариант из найденных

Общие входные аргументы:

- `destination` — обязательное направление или курорт, например `Турция` или `Сочи`
- `departureCity` — город вылета, например `Москва`
- `adults` — количество взрослых
- `nights` — количество ночей или `null`
- `month` — месяц в нормализованном виде (`январь` ... `декабрь`) или `null`
- `rawQuery` — исходная пользовательская формулировка или `null`

## Быстрый старт для обычного пользователя

Если человек просто хочет поставить проект у себя, у него есть два простых варианта.

### Вариант 1. Локально без сервера

```bash
git clone https://github.com/<your-org-or-user>/mcp-eto-travel.git
cd mcp-eto-travel
npm install
npx playwright install chromium
npm run build
```

Дальше MCP можно подключать как локальный процесс.

### Вариант 2. На своём сервере по URL

```bash
git clone https://github.com/<your-org-or-user>/mcp-eto-travel.git
cd mcp-eto-travel
cp .env.example .env
```

После этого нужно открыть `.env` и заменить хотя бы:

- `ALLOWED_HOSTS`
- `PUBLIC_DOMAIN`

Потом запуск:

```bash
docker-compose up -d --build
```

Health check:

```bash
curl http://127.0.0.1:3000/health
```

Если нужен публичный домен без порта, ставится reverse proxy вроде Nginx.

## Установка для разработки

Требования:

- Node.js 20+
- npm 10+
- Chromium для Playwright

Если Chromium ещё не установлен:

```bash
npx playwright install chromium
```

Установка:

```bash
npm install
npx playwright install chromium
npm run build
```

## Локальный MCP для OpenCode

Запуск вручную:

```bash
node dist/index.js
```

Или в dev-режиме:

```bash
npm run dev
```

Пример OpenCode-конфига:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "eto-travel-local": {
      "type": "local",
      "command": ["node", "./dist/index.js"],
      "enabled": true,
      "timeout": 180000
    }
  }
}
```

Готовый пример лежит в `examples/opencode.local.json`.

Классический MCP-конфиг для клиентов с `mcpServers`:

```json
{
  "mcpServers": {
    "eto-travel": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-eto-travel/dist/index.js"]
    }
  }
}
```

Или:

```json
{
  "mcpServers": {
    "eto-travel": {
      "command": ["node", "/absolute/path/to/mcp-eto-travel/dist/index.js"]
    }
  }
}
```

## Self-hosted remote MCP по URL

### 1. Настройка `.env`

Скопируйте пример:

```bash
cp .env.example .env
```

Пример `.env`:

```bash
TRANSPORT_MODE=http
HOST=0.0.0.0
PORT=3000
MCP_PATH=/mcp
ALLOWED_HOSTS=mcp.example.com,localhost,127.0.0.1
PUBLIC_DOMAIN=mcp.example.com
```

Что важно заменить:

- `ALLOWED_HOSTS` — сюда обязательно впишите свой домен
- `PUBLIC_DOMAIN` — тоже замените на свой реальный домен

### 2. Запуск через Docker Compose

```bash
docker-compose up -d --build
```

Это поднимет:

- MCP HTTP endpoint внутри контейнера
- health endpoint на `/health`
- основной MCP path на `/mcp`

### 3. Проверка

Локально на сервере:

```bash
curl http://127.0.0.1:3000/health
```

Ожидаемый ответ:

```json
{"status":"ok"}
```

### 4. Публичный URL через Nginx

В репозитории лежит шаблон `nginx.mcp-eto-travel.conf`.

Он показывает, как проксировать запросы на контейнер.

Типовой итоговый endpoint будет таким:

```text
https://mcp.example.com/mcp
```

Важно:

- в `server_name` нужно указать свой домен
- в `.env` тот же домен должен быть в `ALLOWED_HOSTS`

## Пример OpenCode-конфига для remote режима

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "eto-travel-remote": {
      "type": "remote",
      "url": "https://mcp.example.com/mcp",
      "enabled": true,
      "timeout": 180000
    }
  }
}
```

Готовый пример лежит в `examples/opencode.remote.json`.

Классический MCP-конфиг для обычных клиентов:

```json
{
  "mcpServers": {
    "eto-travel": {
      "url": "https://mcp.example.com/mcp"
    }
  }
}
```

Если клиент требует явный transport:

```json
{
  "mcpServers": {
    "eto-travel": {
      "url": "https://mcp.example.com/mcp",
      "transport": "streamable-http"
    }
  }
}
```

## Что лежит в репозитории для удобного деплоя

- `Dockerfile` — готовый образ для запуска
- `docker-compose.yml` — запуск через Compose
- `.env.example` — пример env-настроек
- `nginx.mcp-eto-travel.conf` — шаблон reverse proxy
- `examples/opencode.local.json` — локальный OpenCode-конфиг
- `examples/opencode.remote.json` — remote OpenCode-конфиг

## Архитектура

- `src/index.ts` — entrypoint, переключает режим запуска между `stdio` и `http`
- `src/runtime/config.ts` — нормализация runtime env-конфига
- `src/runtime/http-server.ts` — HTTP transport для remote MCP
- `src/mcp/server.ts` — регистрация MCP tools
- `src/mcp/find-any-tour.ts` — single-result MCP handler
- `src/mcp/find-tour-options.ts` — multi-result MCP handler
- `src/eto-travel/search-service.ts` — orchestration сценария поиска
- `src/eto-travel/search-results-reader.ts` — чтение нескольких карточек из выдачи
- `src/eto-travel/tour-collection.ts` — категоризация `budget / optimal / premium`
- `src/eto-travel/search-plan.ts` — fallback-план ослабления фильтров
- `src/eto-travel/tour-normalizer.ts` — нормализация карточки и проверка релевантности направления
- `src/shared/query-parser.ts` — нормализация направлений, месяцев и городов вылета

## Примеры вызова инструментов

Один тур:

```json
{
  "tool": "find_any_tour",
  "arguments": {
    "destination": "Турция",
    "departureCity": "Москва",
    "adults": 2,
    "nights": 7,
    "month": "июнь",
    "rawQuery": "Найди тур в Турцию из Москвы на июнь на 7 ночей для 2 взрослых"
  }
}
```

Подборка:

```json
{
  "tool": "find_tour_options",
  "arguments": {
    "destination": "Турция",
    "departureCity": "Москва",
    "adults": 2,
    "nights": 7,
    "month": "июнь",
    "rawQuery": "Подбери несколько туров в Турцию из Москвы на июнь на 7 ночей для 2 взрослых"
  }
}
```

Пример ответа для подборки:

```json
{
  "tours": [
    {
      "category": "budget",
      "title": "Budget Hotel",
      "price": "90 000 RUB",
      "url": "https://example.com/budget"
    },
    {
      "category": "optimal",
      "title": "Comfort Hotel",
      "price": "115 000 RUB",
      "url": "https://example.com/optimal"
    },
    {
      "category": "premium",
      "title": "Luxury Resort",
      "price": "180 000 RUB",
      "url": "https://example.com/premium"
    }
  ]
}
```

## Проверка и разработка

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Проверка через Inspector для локального режима:

```bash
npx @modelcontextprotocol/inspector node ./dist/index.js
```

Что стоит проверить:

- видны оба tools: `find_any_tour` и `find_tour_options`
- single-tool возвращает одну карточку
- multi-tool возвращает подборку из нескольких карточек, если сайт их отдал
- при нехватке критичных данных сервер просит уточнение
- при нерелевантной карточке сервер не подменяет курорт другим регионом

## Важные нюансы

- сайт `eto.travel/search/` использует внешний виджет `tourvisor.ru`
- стабильность зависит от DOM-структуры виджета и доступности стороннего контента
- итоговая ссылка на карточку может вести не на `eto.travel`, а на `tourcart.ru` — это штатное поведение виджета
- для долгих поисков у MCP-клиента лучше ставить `timeout` не меньше `180000` мс

## Что публиковать на GitHub

Для публичной раздачи проекта достаточно оставить в репозитории:

- исходный код
- `Dockerfile`
- `docker-compose.yml`
- `.env.example`
- `nginx.mcp-eto-travel.conf`
- `examples/opencode.local.json`
- `examples/opencode.remote.json`

И не публиковать:

- временные IP
- приватные dev-домены
- локальные override-файлы под конкретный сервер

В таком виде любой пользователь сможет либо подключить локальный MCP, либо поднять remote MCP у себя почти без ручной доработки.
