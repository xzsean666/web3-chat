# TASK-012: Me Screen & Asset Holdings Breakdown

## Objective
实现“我 (Me)”Tab 页面，集成类似 MetaMask 的资产总览、代币明细列表（Holdings Breakdown）、网络切换面板（默认 BSC Testnet）以及个人设置。

## Scope
- 封装 `AssetService`：调用 `evm-call` Multicall3 批量获取当前地址在 BSC Testnet 上的原生币与主流 ERC-20 代币余额。
- 实现 `MeScreen`（用户信息卡片、总资产折算、代币持仓列表、转账/收款入口）。
- 实现 `ChainSwitchModal`（支持 BSC Testnet 与其他 EVM 链切换）。
- 实现地址复制、二维码收款展示。
- 编写资产聚合查询单元测试。

## Allowed Files
- `src/features/assets/AssetService.ts`
- `src/features/assets/screens/MeScreen.tsx`
- `src/features/assets/components/TokenHoldingItem.tsx`
- `src/features/assets/components/ChainSwitchModal.tsx`
- `test/features/assets.test.ts`

## Dependencies
- TASK-003
- TASK-004
- TASK-007

## Inputs and Outputs
- **Inputs**: 钱包地址与代币列表清单。
- **Outputs**: 资产估值与余额明细展示。

## Acceptance Criteria
- [x] Multicall3 单次批量聚合读取代币余额成功。
- [x] 切换网络时资产列表实时刷新。
- [x] 单元测试通过。

## Verification Commands
- `pnpm typecheck`
- `pnpm test test/features/assets.test.ts`

## Risks and Assumptions
- 避免节点限流，利用 `evm-call` 本地 10s 易变态缓存。

## Status
DONE
