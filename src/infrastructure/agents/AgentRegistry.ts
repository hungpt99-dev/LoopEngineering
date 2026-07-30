import { injectable, inject, injectAll } from 'tsyringe';
import { CodingAgentProvider, CODING_AGENT_PROVIDER } from '../../domain/interfaces/CodingAgentProvider.js';
import { Logger, LOGGER } from '../../domain/interfaces/Logger.js';

export const AGENT_REGISTRY = Symbol('AgentRegistry');

@injectable()
export class AgentRegistry {
  private readonly providers: Map<string, CodingAgentProvider> = new Map();

  constructor(
    @inject(LOGGER) private readonly logger: Logger,
    @injectAll(CODING_AGENT_PROVIDER) providers: CodingAgentProvider[],
  ) {
    for (const provider of providers) {
      this.providers.set(provider.name, provider);
    }

    this.logger.info('AgentRegistry initialized', {
      providerCount: this.providers.size,
      providerNames: this.getProviderNames(),
    });
  }

  getProvider(name: string): CodingAgentProvider | undefined {
    return this.providers.get(name);
  }

  getAllProviders(): CodingAgentProvider[] {
    return [...this.providers.values()];
  }

  async getAvailableProviders(): Promise<CodingAgentProvider[]> {
    const results = await Promise.all(
      [...this.providers.values()].map(async (provider) => {
        const available = await provider.isAvailable();
        return { provider, available };
      }),
    );

    return results
      .filter(({ available }) => available)
      .map(({ provider }) => provider);
  }

  getProviderNames(): string[] {
    return [...this.providers.keys()];
  }
}
