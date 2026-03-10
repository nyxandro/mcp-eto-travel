# MCP ETO Travel

MCP-сервер для поиска туров на `eto.travel` через браузерную автоматизацию Playwright.

Проект можно использовать в двух режимах:

- `Local / stdio` — пользователь скачивает репозиторий и подключает MCP как локальный процесс.
- `Remote / self-hosted HTTP` — пользователь поднимает сервер у себя на VPS, в Docker или за reverse proxy (обратный прокси, например Nginx).

В репозитории нет привязки к конкретному вашему серверу или IP. После публикации на GitHub его можно раздавать как универсальный MCP-проект.

## Что умеет сервер

- ищет туры через реальный UI сайта `https://eto.travel/search/`
- принимает структурированные фильтры вместо одного свободного текста
- возвращает полную карточку тура: название, цену, рейтинг, локацию, описание, картинку и ссылку
- сообщает клиенту, что долгий поиск начался и может занять около минуты
- просит уточнить критичные данные, если не указан город вылета, направление или число взрослых
- ослабляет только не-критичные фильтры (`month`, `departureCity`, `nights`), если строгий поиск не дал результата
- отбрасывает нерелевантные карточки для точечных направлений вроде `Сочи`, чтобы не подменять курорт другим регионом

## Основной инструмент

- `find_any_tour` — поиск пакетного тура по структурированным аргументам

Входные аргументы:

- `destination` — обязательное направление или курорт на русском языке, например `Турция` или `Сочи`
- `departureCity` — город вылета, например `Москва`
- `adults` — количество взрослых, положительное целое число
- `nights` — количество ночей, положительное целое число или `null`
- `month` — месяц в нормализованном виде (`январь` ... `декабрь`) или `null`
- `rawQuery` — исходная пользовательская формулировка для трассировки или `null`

## Поведение MCP-слоя

- MCP-клиент получает схему инструмента и сам передаёт уже структурированные поля
- сервер не должен выдумывать обязательные значения, если пользователь их не указал
- если обязательных данных недостаточно, сервер возвращает просьбу уточнить параметры вместо случайного поиска
- если поиск долгий, сервер отправляет лог, что работа началась и это не зависание
- если найденная карточка противоречит запрошенному курорту, сервер не возвращает её пользователю

## Архитектура

- `src/index.ts` — entrypoint, переключает режим запуска между `stdio` и `http`
- `src/runtime/config.ts` — нормализация runtime env-конфига
- `src/runtime/http-server.ts` — HTTP transport для remote MCP
- `src/mcp/server.ts` — регистрация MCP tool `find_any_tour`
- `src/mcp/find-any-tour.ts` — MCP handler, стартовое сообщение, валидация критичных полей
- `src/eto-travel/search-service.ts` — orchestration (оркестрация, основной сценарий поиска) через Playwright
- `src/eto-travel/search-plan.ts` — fallback-план ослабления фильтров
- `src/eto-travel/tour-normalizer.ts` — нормализация карточки и проверка релевантности направления
- `src/shared/query-parser.ts` — нормализация направлений, месяцев и городов вылета
- `src/**/tests/*.test.ts` — unit и integration-like тесты
- `examples/opencode.local.json` — пример OpenCode-конфига для локального режима
- `examples/opencode.remote.json` — пример OpenCode-конфига для удалённого режима

## Требования

- Node.js 20+
- npm 10+
- Chromium для Playwright

Если Chromium ещё не установлен:

```bash
npx playwright install chromium
```

## Установка

```bash
npm install
npx playwright install chromium
npm run build
```

Собранные файлы будут в `dist/`.

## Вариант 1. Локальный MCP для OpenCode

Этот режим нужен, если пользователь просто скачал репозиторий и хочет подключить MCP у себя на машине без сервера.

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

Классический MCP-конфиг для клиентов, которые используют стандартный формат `mcpServers`:

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

Если клиент поддерживает массив команды вместо `command` + `args`, используйте эквивалентный вариант:

```json
{
  "mcpServers": {
    "eto-travel": {
      "command": ["node", "/absolute/path/to/mcp-eto-travel/dist/index.js"]
    }
  }
}
```

## Вариант 2. Удалённый MCP как self-hosted HTTP сервис

Этот режим нужен, если пользователь хочет поднять MCP на своём сервере и подключать его по URL.

Запуск вручную:

```bash
TRANSPORT_MODE=http HOST=0.0.0.0 PORT=3000 MCP_PATH=/mcp ALLOWED_HOSTS=mcp.example.com,localhost,127.0.0.1 node dist/index.js
```

Health endpoint:

```bash
curl http://127.0.0.1:3000/health
```

MCP endpoint по умолчанию:

```text
http://127.0.0.1:3000/mcp
```

Пример OpenCode-конфига для удалённого сервера:

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

Классический MCP-конфиг для клиентов с remote URL:

```json
{
  "mcpServers": {
    "eto-travel": {
      "url": "https://mcp.example.com/mcp"
    }
  }
}
```

Если клиент поддерживает явное указание HTTP transport, можно использовать такой вариант:

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

## Docker и self-hosted remote deployment

Для удобного развёртывания в репозитории есть `Dockerfile` и `docker-compose.yml`.

Запуск:

```bash
docker-compose up -d --build
```

Что настроено в `docker-compose.yml`:

- контейнер запускается в `http`-режиме
- MCP endpoint доступен внутри контейнера по `/mcp`
- health endpoint доступен по `/health`
- `ALLOWED_HOSTS` использует generic-пример `mcp.example.com`

Если вы поднимаете проект у себя, замените `mcp.example.com` на свой домен.

## Пример Nginx reverse proxy

В репозитории есть шаблон `nginx.mcp-eto-travel.conf`.

Он показывает базовую схему:

- домен `mcp.example.com`
- проксирование в контейнер на `127.0.0.1:3000`
- передача корректного `Host` заголовка
- отключение буферизации для streamable HTTP / SSE

После подстановки своего домена типовой endpoint будет выглядеть так:

```text
https://mcp.example.com/mcp
```

## Рекомендованный сценарий публикации на GitHub

Если вы хотите раздавать проект как публичный MCP:

- оставьте в репозитории оба режима: `local` и `self-hosted remote`
- не публикуйте временные IP, тестовые домены и приватные ссылки
- держите в README только generic-примеры вроде `mcp.example.com`
- если нужен публичный demo endpoint, публикуйте его отдельно и явно помечайте как demo

## Пример вызова инструмента

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

Типовой ответ:

```json
{
  "title": "Viva Магнолия",
  "hotelName": "Viva Магнолия",
  "price": "29 027 RUB",
  "dates": "Адлер, Сочи, 350 м до моря",
  "rating": "3.3",
  "location": "Адлер, Сочи, 350 м до моря",
  "description": "Отель на тихой улице",
  "imageUrl": "https://static.tourvisor.ru/hotel_pics/main400/80505.jpg",
  "url": "https://tourcart.ru/hotel?cd=99414988#!/hotel=viva-magnoliya",
  "appliedFilters": {
    "destination": "Сочи",
    "departureCity": "Москва",
    "adults": 2,
    "nights": 7,
    "month": "апрель"
  },
  "relaxedFilters": [],
  "source": "ui"
}
```

## Ограничения и нюансы

- сайт `eto.travel/search/` использует внешний виджет `tourvisor.ru`
- стабильность зависит от DOM-структуры виджета и доступности стороннего контента
- итоговая ссылка на карточку может вести не на `eto.travel`, а на `tourcart.ru` — это штатное поведение виджета
- поиск по некоторым точечным направлениям требует более строгой проверки релевантности, и сервер теперь отбрасывает явные промахи
- долгие поиски лучше использовать с MCP timeout не меньше `180000` мс

## Проверка и разработка

Полный набор проверок:

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

После этого проверьте:

- инструмент `find_any_tour` виден в списке tools
- схема аргументов структурированная, без одного свободного текстового поля вместо фильтров
- валидный вызов возвращает карточку тура
- при слишком жёстких фильтрах сервер может вернуть `relaxedFilters`
- при нерелевантной карточке по точечному курорту сервер не подменяет направление другим регионом

## Что можно приложить к релизу

Для удобства пользователей при публикации GitHub release или README можно приложить:

- `examples/opencode.local.json`
- `examples/opencode.remote.json`
- `docker-compose.yml`
- `nginx.mcp-eto-travel.conf`

Так пользователи сразу получают две рабочие схемы: локальную и self-hosted удалённую.
