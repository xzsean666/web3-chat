# TASK-003: BSC Testnet & Multi-Chain evm-call Integration Service

## Objective
基于 `/ssd0/git/evm-call` 封装 App 层的 EVM 客户端接入服务，配置默认 BSC Testnet 网络，实现多节点负载均衡、RPC 故障避退与代币余额查询。

## Scope
- 配置 BSC Testnet 核心常量（Chain ID 97, RPC 节点池, 符号 tBNB, 浏览器 URL）。
- 配置预留的多链切换结构（Ethereum, Base 等）。
- 封装 `EvmService`，统一调用 `evm-call` 进行 `eth_blockNumber`, `eth_getBalance`, Multicall3 批量 ERC-20 读取。
- 编写 `EvmService` 模拟 RPC 与实际调用测试。

## Allowed Files
- `src/constants/chains.ts`
- `src/services/evm/EvmService.ts`
- `src/services/evm/index.ts`
- `test/services/evm.test.ts`

## Dependencies
- TASK-001
- TASK-002

## Inputs and Outputs
- **Inputs**: `evm-call` 包能力与 BSC Testnet 节点配置。
- **Outputs**: 高可用 `EvmService` 实例与多链配置模块。

## Acceptance Criteria
- [x] 严格复用 `evm-call`，不引入冗余 Web3 库。
- [x] 默认网络为 BSC Testnet。
- [x] 支持查询原生币余额与 Multicall3 批量查询 ERC-20。
- [x] 单元测试通过。

## Verification Commands
- `pnpm typecheck`
- `pnpm test test/services/evm.test.ts`

## Risks and Assumptions
- React Native 环境下 `evm-call` 的存储/网络适配，确保无 Node 原生模块强绑定报错。

## Status
DONE
