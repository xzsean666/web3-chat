# TASK-016: Local Visual E2E & Mobile Emulation Screenshot Suite

## Objective
在本地环境搭建基于 Headless Google Chrome (CDP) 的移动端视觉 E2E 自动化测试与高保真截屏体系，模拟真实手机屏幕（390×844，DPR=3，Touch 事件），走通微信风格 Web3 App 的 4 大 Tab（Chats、Contacts、Discover、Me）以及核心业务子界面与弹窗（聊天详情、LuckyDrop 链上红包卡片与拆解结果、DApp 签名授权抽屉、网络切换面板），自动生成并导出完整手机截图矩阵。

## Scope
1. **视觉状态装配容器 (Visual Harness)**:
   - 编写 `src/visual/VisualHarness.tsx`，以高保真数据驱动装配所有已开发完成的核心界面：
     - 会话列表（带未读徽章、置顶、单聊/群聊头像、格式化时间戳）。
     - 聊天详情（双方消息气泡、30s 阅后即焚倒计时、LuckyDrop 金红红包卡片、底部输入栏）。
     - LuckyDrop 红包拆解弹窗（LuckyDrop Claim 结果、代币数量、链上 Tx 凭证与 Merkle 证明）。
     - 通讯录页面（A-Z 拼音/字母分组列表、好友备注、快速索引栏、新朋友入口）。
     - 发现页面（LuckyDrop、PancakeSwap、BscScan 等 Web3 DApp 列表）。
     - DApp 签名授权抽屉（`personal_sign` 底部升起安全弹窗与危险提示）。
     - “我”个人中心与多链资产看板（截短地址、USD 估值折算、BNB/USDT/LUCKY 余额明细）。
     - 切换网络弹窗（BSC Testnet、Ethereum Sepolia、Polygon 等）。
2. **移动端环境模拟与截屏驱动 (Mobile Emulation & Screenshot Pipeline)**:
   - 编写 `test/visual/runVisualE2E.mjs`，利用本地 `/usr/bin/google-chrome` 的 Chrome DevTools Protocol (CDP)：
     - 设置视口：`390 x 844`（iPhone 15 标准屏宽），`deviceScaleFactor: 3`，`mobile: true`，`hasTouch: true`。
     - 自动化依次切换场景，等待页面渲染与图片就绪。
     - 捕获高分辨率 PNG 截图，输出至 `test/visual/screenshots/`。
3. **工程集成与回归保证**:
   - 在 `package.json` 中配置 `test:visual` 脚本。
   - 保持 `pnpm test` (107 项) 与 `pnpm typecheck` 100% 绿色无损通过。

## Allowed Files
- `package.json`
- `src/visual/VisualHarness.tsx`
- `src/navigation/RootNavigator.tsx`
- `App.tsx`
- `test/visual/runVisualE2E.mjs`
- `test/visual/screenshots/*.png`
- `docs/AI/tasks/TASK-016.md`
- `docs/AI/TASK_INDEX.md`
- `docs/AI/SESSION_STATE.md`

## Status
DONE
