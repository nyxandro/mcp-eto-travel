FROM mcr.microsoft.com/playwright:v1.58.2-noble

# Рабочая директория контейнера совпадает с layout проекта для предсказуемых путей сборки.
WORKDIR /app

# Сначала копируем манифесты, чтобы Docker кэшировал слой установки зависимостей.
COPY package.json package-lock.json ./

# Прод-зависимости и dev-зависимости нужны внутри контейнера, потому что мы собираем TypeScript на старте образа.
RUN npm ci

# После установки зависимостей копируем исходники и конфиги сборки.
COPY tsconfig.json eslint.config.js ./
COPY src ./src
COPY README.md ./README.md

# Сборку выполняем внутри образа, чтобы рантайм использовал канонический dist.
RUN npm run build

# HTTP transport слушает 3000 внутри контейнера.
EXPOSE 3000

# Запускаем собранную версию, а режим транспорта задается env-переменными compose.
CMD ["node", "dist/index.js"]
