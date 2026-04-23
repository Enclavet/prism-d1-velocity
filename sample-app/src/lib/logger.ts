/**
 * Log levels for the logger
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/**
 * Logger configuration options
 */
export interface LoggerOptions {
  prefix?: string;
  timestamp?: boolean;
}

/**
 * Creates a logger instance with a standard prefix
 *
 * @param options - Configuration options for the logger
 * @returns Logger functions for different log levels
 *
 * @example
 * const logger = createLogger({ prefix: '[API]', timestamp: true });
 * logger.info('Server started'); // [API] [2024-04-23T10:30:00.000Z] Server started
 * logger.error('Failed to connect'); // [API] [2024-04-23T10:30:00.000Z] Failed to connect
 */
export function createLogger(options: LoggerOptions = {}) {
  const { prefix = '[APP]', timestamp = false } = options;

  const formatMessage = (level: LogLevel, message: string): string => {
    const parts: string[] = [prefix];

    if (timestamp) {
      parts.push(`[${new Date().toISOString()}]`);
    }

    parts.push(`[${level.toUpperCase()}]`);
    parts.push(message);

    return parts.join(' ');
  };

  return {
    info: (message: string): void => {
      console.log(formatMessage('info', message));
    },
    warn: (message: string): void => {
      console.warn(formatMessage('warn', message));
    },
    error: (message: string): void => {
      console.error(formatMessage('error', message));
    },
    debug: (message: string): void => {
      console.debug(formatMessage('debug', message));
    },
  };
}

/**
 * Default logger instance with '[APP]' prefix
 */
export const logger = createLogger();
