import { SocialContractService } from './SocialContractService';
import { evmService } from '../../services/evm';
import { storageEngine } from '../../services/storage';

export * from './SocialContractService';
export * from './screens/ContactsScreen';
export * from './screens/AddFriendScreen';

export const socialContractService = new SocialContractService(evmService, storageEngine);
