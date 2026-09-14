import { KeyStoreService } from './KeyStoreService';
import { WalletCoreService } from './WalletCoreService';

export * from './KeyStoreService';
export * from './WalletCoreService';

export const keyStoreService = new KeyStoreService();
export const walletCoreService = new WalletCoreService(keyStoreService);
