import { EvmService } from './EvmService';

export * from './EvmService';

// Singleton instance for app-wide use
export const evmService = new EvmService();
