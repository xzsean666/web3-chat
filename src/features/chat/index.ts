import { ChatEngineService } from './ChatEngineService';
import { PeriodicSyncService } from './PeriodicSyncService';
import { conversationRepo, messageRepo, syncCheckpointRepo } from '../../services/storage';
import { workerApiClient, authService } from '../../services/worker';

export * from './ChatEngineService';
export * from './PeriodicSyncService';

export const chatEngineService = new ChatEngineService(
  conversationRepo,
  messageRepo,
  workerApiClient,
  authService,
);

export const periodicSyncService = new PeriodicSyncService(
  workerApiClient,
  messageRepo,
  conversationRepo,
  syncCheckpointRepo,
  authService,
);
