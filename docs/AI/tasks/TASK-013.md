# TASK-013: Discover Screen & DApp Browser WebView with EIP-1193 Bridge

## Objective
实现“发现 (Discover)”Tab 页面，构建类似 MetaMask 的内置 DApp 浏览器，支持离线聚合主页与 EIP-1193 标准 Web3 Provider 注入及交易签名交互。

## Scope
- 实现 `DiscoverScreen`（Web3 常用生态导航、搜索/输入网址栏、书签管理）。
- 实现 `DAppBrowserScreen`（WebView 容器、加载进度条、刷新/回退控制）。
- 实现 EIP-1193 JS Bridge 注入脚本（处理 `eth_requestAccounts`, `personal_sign`, `eth_sendTransaction` 等）。
- 实现签名/交易审批弹窗 `SignApprovalSheet`。
- 编写 EIP-1193 RPC 协议解析与 Bridge 模拟测试。

## Allowed Files
- `src/features/discover/screens/DiscoverScreen.tsx`
- `src/features/discover/screens/DAppBrowserScreen.tsx`
- `src/features/discover/bridge/eip1193Bridge.ts`
- `src/features/discover/components/SignApprovalSheet.tsx`
- `test/features/discover.test.ts`

## Dependencies
- TASK-003
- TASK-004
- TASK-007

## Inputs and Outputs
- **Inputs**: 外部 DApp 网址与 JSON-RPC 请求。
- **Outputs**: 安全的沙箱化 DApp 交互体验。

## Acceptance Criteria
- [x] 离线主页快速展示常用 DApp。
- [x] Provider 规范支持 EIP-1193。
- [x] 交易发起前必须经用户显式确认。
- [x] 单元测试通过。

## Verification Commands
- `pnpm typecheck`
- `pnpm test test/features/discover.test.ts`

## Risks and Assumptions
- 严格校验 DApp 域名与方法调用权限，防范钓鱼与未经授权转账。

## Status
DONE
