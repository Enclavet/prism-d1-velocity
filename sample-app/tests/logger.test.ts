import { createLogger, logger } from '../src/lib/logger';

describe('createLogger', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleDebugSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleDebugSpy.mockRestore();
  });

  describe('with default options', () => {
    it('logs info messages with default prefix', () => {
      const log = createLogger();
      log.info('Test message');
      expect(consoleLogSpy).toHaveBeenCalledWith('[APP] [INFO] Test message');
    });

    it('logs warn messages with default prefix', () => {
      const log = createLogger();
      log.warn('Warning message');
      expect(consoleWarnSpy).toHaveBeenCalledWith('[APP] [WARN] Warning message');
    });

    it('logs error messages with default prefix', () => {
      const log = createLogger();
      log.error('Error message');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[APP] [ERROR] Error message');
    });

    it('logs debug messages with default prefix', () => {
      const log = createLogger();
      log.debug('Debug message');
      expect(consoleDebugSpy).toHaveBeenCalledWith('[APP] [DEBUG] Debug message');
    });
  });

  describe('with custom prefix', () => {
    it('logs with custom prefix', () => {
      const log = createLogger({ prefix: '[API]' });
      log.info('Request received');
      expect(consoleLogSpy).toHaveBeenCalledWith('[API] [INFO] Request received');
    });

    it('logs with custom prefix for all levels', () => {
      const log = createLogger({ prefix: '[DB]' });

      log.info('Connection established');
      expect(consoleLogSpy).toHaveBeenCalledWith('[DB] [INFO] Connection established');

      log.warn('Slow query detected');
      expect(consoleWarnSpy).toHaveBeenCalledWith('[DB] [WARN] Slow query detected');

      log.error('Connection failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[DB] [ERROR] Connection failed');

      log.debug('Query executed');
      expect(consoleDebugSpy).toHaveBeenCalledWith('[DB] [DEBUG] Query executed');
    });
  });

  describe('with timestamp enabled', () => {
    it('includes ISO timestamp in log messages', () => {
      const log = createLogger({ timestamp: true });
      const beforeTime = new Date().toISOString();

      log.info('Test message');

      const loggedMessage = consoleLogSpy.mock.calls[0][0];
      expect(loggedMessage).toMatch(/^\[APP\] \[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] Test message$/);
    });

    it('includes timestamp with custom prefix', () => {
      const log = createLogger({ prefix: '[WORKER]', timestamp: true });

      log.warn('Job started');

      const loggedMessage = consoleWarnSpy.mock.calls[0][0];
      expect(loggedMessage).toMatch(/^\[WORKER\] \[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[WARN\] Job started$/);
    });
  });

  describe('without timestamp', () => {
    it('does not include timestamp by default', () => {
      const log = createLogger();
      log.info('Test message');

      const loggedMessage = consoleLogSpy.mock.calls[0][0];
      expect(loggedMessage).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(loggedMessage).toBe('[APP] [INFO] Test message');
    });

    it('does not include timestamp when explicitly disabled', () => {
      const log = createLogger({ timestamp: false });
      log.info('Test message');

      const loggedMessage = consoleLogSpy.mock.calls[0][0];
      expect(loggedMessage).toBe('[APP] [INFO] Test message');
    });
  });

  describe('edge cases', () => {
    it('handles empty messages', () => {
      const log = createLogger();
      log.info('');
      expect(consoleLogSpy).toHaveBeenCalledWith('[APP] [INFO] ');
    });

    it('handles messages with special characters', () => {
      const log = createLogger({ prefix: '[TEST]' });
      log.info('Message with "quotes" and \'apostrophes\'');
      expect(consoleLogSpy).toHaveBeenCalledWith('[TEST] [INFO] Message with "quotes" and \'apostrophes\'');
    });

    it('handles multi-line messages', () => {
      const log = createLogger();
      log.info('Line 1\nLine 2\nLine 3');
      expect(consoleLogSpy).toHaveBeenCalledWith('[APP] [INFO] Line 1\nLine 2\nLine 3');
    });

    it('handles unicode characters', () => {
      const log = createLogger();
      log.info('日本語 emoji 🚀');
      expect(consoleLogSpy).toHaveBeenCalledWith('[APP] [INFO] 日本語 emoji 🚀');
    });
  });

  describe('real-world usage patterns', () => {
    it('creates logger for API module', () => {
      const apiLogger = createLogger({ prefix: '[API]', timestamp: true });

      apiLogger.info('Server starting on port 3000');
      apiLogger.warn('Rate limit approaching');
      apiLogger.error('Failed to process request');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('creates logger for database operations', () => {
      const dbLogger = createLogger({ prefix: '[DATABASE]' });

      dbLogger.info('Migration started');
      dbLogger.debug('Executing query: SELECT * FROM users');
      dbLogger.info('Migration completed');

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
    });
  });
});

describe('default logger instance', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('exports a default logger instance', () => {
    expect(logger).toBeDefined();
    expect(logger.info).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.error).toBeDefined();
    expect(logger.debug).toBeDefined();
  });

  it('default logger uses [APP] prefix', () => {
    logger.info('Test message');
    expect(consoleLogSpy).toHaveBeenCalledWith('[APP] [INFO] Test message');
  });
});
