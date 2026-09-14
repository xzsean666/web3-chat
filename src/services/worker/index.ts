import { WorkerApiClient } from './WorkerApiClient';
import { AuthService } from './AuthService';
import { walletCoreService, keyStoreService } from '../wallet';

export * from './WorkerApiClient';
export * from './AuthService';

export const authService = new AuthService(walletCoreService, keyStoreService);
export const workerApiClient = authService.getClient();
