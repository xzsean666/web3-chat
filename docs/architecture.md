# 架构说明

## 总览

项目采用纯前端架构：

- 浏览器负责钱包连接、身份签名、房间管理、消息收发。
- WebRTC Data Channel 负责点对点消息传输。
- TURN / STUN 服务器负责 NAT 穿透与中继。
- 外部公开 relay 只用于初始发现和握手，不承担业务消息存储。

## 身份层

- 用户通过 EVM 钱包签名生成本地身份证明。
- 身份证明包含地址、签名、随机 nonce、sessionId、签名时间，以及会话临时公钥。
- 证明只保存在浏览器 `sessionStorage`。
- 对等节点先用 `viem.verifyMessage` 验证结构化签名，再执行房间级 challenge-response 验证会话私钥持有权。
- 后续每条消息都会使用会话临时私钥签名，由接收方用会话公钥验证。
- 该会话签名机制不等同于每条消息的独立钱包签名，但比共享 HMAC 更适合防止房间内冒名发送。

## 房间层

房间有两种：

- 私聊：`peerLimit = 2`
- 群聊：`peerLimit = 8`

房间由以下要素决定：

- `roomId`
- `kind`
- `title`
- `secret`
- `peerLimit`
- `expiresAt`

邀请链接会携带这些信息。导入后会马上持久化到本地，并尽快从地址栏移除 `secret`。

## 连接层

当前使用 `trystero`：

- 房间口令作为 `password`
- `appId` 作为应用命名空间
- `rtcConfig.iceServers` 来自 `.env`
- 若配置 TURN，则先尝试 `iceTransportPolicy = relay`
- 若 TURN 不可用或超时，再回退到 TURN + STUN 混合模式

连接步骤：

1. 创建或导入房间。
2. 使用 relay 完成初始发现。
3. 使用 relay-only 或 TURN/STUN 混合候选收集 ICE candidate。
4. 在 `onPeerHandshake` 中交换结构化钱包证明和一次性 challenge。
5. 完成 challenge-response 后建立可信会话。
6. 使用 `makeAction('chat-message')` 收发消息。
7. 对每条消息校验会话签名与时间窗口。

## 存储层

本地持久化内容：

- 最近房间列表
- 当前选中房间

仅会话持久化内容：

- 钱包身份
- 房间 `secret`
- 邀请链接
- 每个房间的本地消息历史

不持久化内容：

- WebRTC 连接对象
- 远端 peer runtime
- 服务端会话状态

## 为什么没有后端

用户要求“不使用自建业务后端”。在这个前提下：

- 无法做中心化联系人搜索。
- 无法做服务端离线消息。
- 无法做后台风控和审计。
- 无法在服务端做挑战-应答式防重放控制。

这不是实现缺失，而是架构边界。
