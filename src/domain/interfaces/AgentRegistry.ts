import type { CodingAgentProvider } from './CodingAgentProvider.js';

export interface IAgentRegistry {
  getProvider(name: string): CodingAgentProvider | undefined;
  getAllProviders(): CodingAgentProvider[];
  getAvailableProviders(): Promise<CodingAgentProvider[]>;
  getProviderNames(): string[];
}

export const AGENT_REGISTRY = Symbol('AgentRegistry');
