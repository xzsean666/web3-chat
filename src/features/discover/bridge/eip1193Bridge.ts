import { hexToString, isHex } from 'viem';
import type { WalletCoreService } from '../../../services/wallet/WalletCoreService';
import type { EvmService } from '../../../services/evm/EvmService';

export interface Eip1193Request {
  id: string | number;
  method: string;
  params?: any[];
}

export interface Eip1193Response {
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

export interface BridgeContext {
  walletAddress: string;
  chainId: number;
  walletCore: WalletCoreService;
  evmService: EvmService;
  origin?: string;
  requestUserApproval: (method: string, params: any[], origin?: string) => Promise<boolean>;
}

/**
 * Generate in-page JavaScript string to inject window.ethereum conforming to EIP-1193
 */
export function createEip1193InpageScript(chainIdHex: string, activeAddress: string): string {
  // Sanitize input variables to prevent script injection / template breaking
  const safeChainId = (chainIdHex || '').replace(/[^a-zA-Z0-9x]/g, '');
  const safeAddress = (activeAddress || '').replace(/[^a-zA-Z0-9x]/g, '');

  return `
(function() {
  if (window.ethereum) return;

  const listeners = {};
  let currentChainId = '${safeChainId}';
  let currentSelectedAddress = '${safeAddress}';

  function emit(event, ...args) {
    if (listeners[event]) {
      listeners[event].forEach(fn => {
        try { fn(...args); } catch(e) { console.error(e); }
      });
    }
  }

  window.ethereum = {
    isMetaMask: true,
    isWeb3Chat: true,
    chainId: currentChainId,
    selectedAddress: currentSelectedAddress,

    request: function(args) {
      return new Promise((resolve, reject) => {
        const id = 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

        function handleMessage(event) {
          try {
            const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            if (data && data.__web3_chat_response && data.id === id) {
              window.removeEventListener('message', handleMessage);
              if (data.error) {
                const err = new Error(data.error.message || 'RPC Error');
                err.code = data.error.code || 4001;
                reject(err);
              } else {
                resolve(data.result);
              }
            }
          } catch(e) {}
        }

        window.addEventListener('message', handleMessage);

        const payload = JSON.stringify({
          __web3_chat_request: true,
          id: id,
          method: args.method,
          params: args.params || [],
          origin: window.location.origin
        });

        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(payload);
        } else {
          window.postMessage(payload, '*');
        }
      });
    },

    on: function(event, callback) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(callback);
    },

    removeListener: function(event, callback) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter(fn => fn !== callback);
    }
  };
})();
`;
}

/**
 * Handle incoming EIP-1193 RPC requests from the WebView sandbox
 */
export async function handleEip1193Request(
  req: Eip1193Request,
  context: BridgeContext,
): Promise<Eip1193Response> {
  const { id, method, params = [] } = req;
  const { walletAddress, chainId, walletCore, evmService, origin, requestUserApproval } = context;

  const hexChainId = `0x${chainId.toString(16)}`;

  try {
    switch (method) {
      case 'eth_requestAccounts':
      case 'eth_accounts': {
        return { id, result: [walletAddress] };
      }

      case 'eth_chainId': {
        return { id, result: hexChainId };
      }

      case 'net_version': {
        return { id, result: String(chainId) };
      }

      case 'personal_sign': {
        // Handle both standard EIP-1193 [challenge, address] and legacy [address, challenge]
        const isEthAddress = (val: any): boolean =>
          typeof val === 'string' && /^0x[0-9a-fA-F]{40}$/i.test(val);

        let rawMessage: any;
        let targetSignerAddress = walletAddress;

        if (isEthAddress(params[0]) && !isEthAddress(params[1])) {
          // Legacy format: [address, message]
          targetSignerAddress = params[0];
          rawMessage = params[1];
        } else {
          // Standard EIP-1193: [message, address]
          rawMessage = params[0];
          if (isEthAddress(params[1])) {
            targetSignerAddress = params[1];
          }
        }

        const approved = await requestUserApproval(method, params, origin);
        if (!approved) {
          return { id, error: { code: 4001, message: 'User rejected the request' } };
        }

        let messageText = typeof rawMessage === 'string' ? rawMessage : String(rawMessage ?? '');
        if (isHex(messageText)) {
          try {
            messageText = hexToString(messageText);
          } catch {
            // Keep raw hex if decoding as utf8 fails
          }
        }

        const signature = await walletCore.signMessage(messageText, targetSignerAddress);
        return { id, result: signature };
      }

      case 'eth_signTypedData':
      case 'eth_signTypedData_v4': {
        const approved = await requestUserApproval(method, params, origin);
        if (!approved) {
          return { id, error: { code: 4001, message: 'User rejected the request' } };
        }
        const typedData = typeof params[1] === 'string' ? JSON.parse(params[1]) : params[1];
        const signature = await walletCore.signTypedData(typedData, walletAddress);
        return { id, result: signature };
      }

      case 'eth_sendTransaction': {
        const txObj = params[0];
        const approved = await requestUserApproval(method, params, origin);
        if (!approved) {
          return { id, error: { code: 4001, message: 'User rejected the transaction' } };
        }

        const signedTx = await walletCore.signTransaction(txObj, walletAddress);
        const txHash = await evmService.sendRawTransaction(signedTx);
        return { id, result: txHash };
      }

      case 'eth_blockNumber': {
        const bn = await evmService.getBlockNumber();
        return { id, result: `0x${bn.toString(16)}` };
      }

      case 'eth_getBalance': {
        const target = params[0] || walletAddress;
        const balWei = await evmService.getNativeBalance(target, params[1] || 'latest');
        return { id, result: `0x${BigInt(balWei).toString(16)}` };
      }

      case 'eth_call': {
        const callRes = await evmService.call({
          to: params[0]?.to,
          data: params[0]?.data || '0x',
          blockTag: params[1],
        });
        return { id, result: callRes };
      }

      case 'eth_estimateGas': {
        const gas = await evmService.estimateGas(params[0]);
        return { id, result: `0x${gas.toString(16)}` };
      }

      default: {
        // Fallback proxy to RPC client
        const client = evmService.getClient();
        const res = await client.call<any>({ method, params });
        return { id, result: res };
      }
    }
  } catch (err: any) {
    return {
      id,
      error: {
        code: -32603,
        message: err.message || 'Internal JSON-RPC error',
      },
    };
  }
}
