# TASK-004: Local Secure KeyStore & Wallet Core Service

## Objective
构建非托管钱包核心服务（Wallet Core），支持助记词生成/导入、私钥派生、本地硬件加密持久化（SecureStore）以及 EIP-191 / 交易离线签名。

## Scope
- 实现基于标准 BIP-39 / BIP-44 的助记词生成与地址派生。
- 实现私钥直接导入与验证。
- 封装 `KeyStoreService`（基于平台安全存储或内存加密回退）。
- 封装 `WalletCoreService`（提供 `signMessage`, `signTransaction` 等方法）。
- 编写钱包核心单元测试（助记词正确派生标准测试向量）。

## Allowed Files
- `src/services/wallet/KeyStoreService.ts`
- `src/services/wallet/WalletCoreService.ts`
- `src/services/wallet/index.ts`
- `test/services/wallet.test.ts`

## Dependencies
- TASK-001
- TASK-002

## Inputs and Outputs
- **Inputs**: 助记词或私钥输入。
- **Outputs**: 安全本地密钥存储与合规签名结果。

## Acceptance Criteria
- [x] 支持 BIP-39 12词助记词生成与校验。
- [x] 支持派生标准以太坊地址与公私钥。
- [x] 签名结果符合 EIP-191 规范（可供 SIWE 校验）。
- [x] 单元测试通过。

## Verification Commands
- `pnpm typecheck`
- `pnpm test test/services/wallet.test.ts`

## Risks and Assumptions
- 加密原语在 React Native / Node 环境中的跨平台一致性。

## Status
DONE
