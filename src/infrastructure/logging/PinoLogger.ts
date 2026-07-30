import pino from 'pino';
import { injectable } from 'tsyringe';
import type { Logger as LoggerInterface } from '../../domain/interfaces/Logger.js';

function createPinoLogger(bindings?: Record<string, unknown>) {
  const isDev = process.env.NODE_ENV !== 'production';
  const level = process.env.LOG_LEVEL ?? 'info';

  const transport = isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined;

  return pino({
    level,
    ...(bindings ? { base: bindings } : {}),
    ...(transport ? { transport } : {}),
  });
}

@injectable()
export class PinoLogger implements LoggerInterface {
  private logger: pino.Logger;

  constructor() {
    this.logger = createPinoLogger();
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.logger.info(context ?? {}, message);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.logger.warn(context ?? {}, message);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    const ctx = {
      ...(context ?? {}),
      ...(error ? { err: error } : {}),
    };
    this.logger.error(ctx, message);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.logger.debug(context ?? {}, message);
  }

  child(bindings: Record<string, unknown>): LoggerInterface {
    const childLogger = new PinoLogger();
    childLogger.logger = this.logger.child(bindings);
    return childLogger;
  }
}
