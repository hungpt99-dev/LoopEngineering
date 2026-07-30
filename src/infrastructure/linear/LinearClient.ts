import { LinearClient } from '@linear/sdk';
import { inject, injectable, singleton } from 'tsyringe';
import type { Logger } from '../../domain/interfaces/Logger.js';
import { LOGGER } from '../../domain/interfaces/Logger.js';

export const LINEAR_CLIENT_FACTORY = Symbol('LinearClientFactory');

@injectable()
@singleton()
export class LinearClientFactory {
  private client: LinearClient | null = null;
  private disposed = false;

  constructor(@inject(LOGGER) private readonly logger: Logger) {}

  getClient(): LinearClient {
    if (this.disposed) {
      throw new Error('LinearClientFactory has been disposed');
    }

    if (!this.client) {
      const apiKey = process.env.LINEAR_API_KEY;
      if (!apiKey) {
        throw new Error(
          'LINEAR_API_KEY environment variable is not set. Please set it in your .env file or environment.',
        );
      }

      this.logger.info('Creating Linear SDK client');
      this.client = new LinearClient({ apiKey });
    }

    return this.client;
  }

  dispose(): void {
    this.client = null;
    this.disposed = true;
    this.logger.info('Linear SDK client disposed');
  }
}
