/**
 * TOC:
 * - RuntimeConfig: startup configuration for stdio or HTTP transports
 * - createRuntimeConfig: normalizes environment variables into runtime config
 */

export interface RuntimeConfig {
  transportMode: 'stdio' | 'http';
  http?: {
    host: string;
    port: number;
    mcpPath: string;
    allowedHosts: string[];
  };
}

const DEFAULT_HTTP_HOST = '127.0.0.1';
const DEFAULT_HTTP_PORT = 3000;
const DEFAULT_MCP_PATH = '/mcp';

export function createRuntimeConfig(env: NodeJS.ProcessEnv): RuntimeConfig {
  // По умолчанию сохраняем совместимость с существующим stdio-сценарием для локальных MCP-клиентов.
  if (env.TRANSPORT_MODE !== 'http') {
    return {
      transportMode: 'stdio'
    };
  }

  // HTTP-настройки нормализуем централизованно, чтобы entrypoint не содержал размазанной env-логики.
  return {
    transportMode: 'http',
    http: {
      host: env.HOST?.trim() || DEFAULT_HTTP_HOST,
      port: parsePort(env.PORT),
      mcpPath: normalizeMcpPath(env.MCP_PATH),
      allowedHosts: parseAllowedHosts(env.ALLOWED_HOSTS)
    }
  };
}

function parsePort(rawPort: string | undefined): number {
  // Порт валидируем строго, потому что контейнерный запуск должен падать сразу при неправильной конфигурации.
  if (!rawPort) {
    return DEFAULT_HTTP_PORT;
  }

  const parsedPort = Number.parseInt(rawPort, 10);

  if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
    throw new Error('PORT must be a valid integer when TRANSPORT_MODE=http');
  }

  return parsedPort;
}

function normalizeMcpPath(rawPath: string | undefined): string {
  // Путь MCP приводим к формату с ведущим slash, чтобы роутинг Express был предсказуемым.
  const trimmedPath = rawPath?.trim();

  if (!trimmedPath) {
    return DEFAULT_MCP_PATH;
  }

  return trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`;
}

function parseAllowedHosts(rawHosts: string | undefined): string[] {
  // Разрешенные host-заголовки фильтруем от пустых значений, чтобы не передавать мусор в защиту SDK.
  if (!rawHosts?.trim()) {
    return [];
  }

  return rawHosts
    .split(',')
    .map((host) => host.trim())
    .filter((host) => host.length > 0);
}
