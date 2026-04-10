# AGENT.md

## 项目目标

这个仓库是一个纯前端 Web3 聊天项目：

- 钱包签名即身份，不做传统用户名密码。
- 支持私聊和群聊。
- 聊天传输依赖 WebRTC Data Channel。
- 不引入自建业务后端。
- 允许使用 STUN 服务器辅助 NAT 穿透。
- UI 方向参考微信，追求简洁、明确、低干扰。

## 当前约束

- 不允许引入新的业务后端服务。
- 钱包签名只保存在本地浏览器，不发给业务后端。
- 邀请链接中带有房间口令，导入后应尽量从 URL 清理。
- 群聊当前采用 mesh 拓扑，不适合大群。

## 当前实现摘要

- Vue 3 + Vite 单页应用。
- Pinia 存储本地身份、房间列表和本地消息历史。
- PrimeVue 负责移动端 UI 组件。
- `viem` 负责 EVM 钱包签名。
- `trystero` 负责无自建后端的 WebRTC 初始发现。
- `infra/stun-docker` 提供 Docker 方式部署 TURN / STUN 服务器的示例。

## 后续 AI 工作原则

- 优先保持“纯前端、无业务后端”的架构边界。
- 做安全增强时，先明确是“真实安全收益”还是“表面复杂度”。
- 不要把邀请口令长期暴露在地址栏。
- 不要把钱包签名长期落在 `localStorage`。
- 如果新增群聊能力，必须评估 mesh 拓扑的可扩展性。
- 如果未来要支持更高连通率，可考虑可选 TURN，但那属于网络基础设施，不是业务后端。
- 如果未来要做离线消息、联系人搜索、消息漫游，那将改变架构假设，需要单独讨论。

## 建议优先级

1. 增加单元测试，覆盖邀请解析、签名校验、消息去重。
2. 为房间列表增加未读数与最后一条消息摘要。
3. 为群聊补充成员加入/离开提示优化。
4. 优化 TURN 成功 / 回退状态提示。
5. 评估是否需要对本地消息历史做静态加密。

## 常用命令

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm typecheck
```

## 重点文件

- `src/stores/chatApp.ts`：主状态、房间连接、消息流、钱包身份。
- `src/utils/wallet.ts`：钱包签名与校验。
- `src/utils/invite.ts`：邀请链接生成与解析。
- `src/utils/config.ts`：STUN / relay / 消息限制配置。
- `infra/stun-docker/`：STUN Docker 部署示例。
