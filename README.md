# TG Tools

基于 `Vue3 + Node.js(Express)` 的 Telegram 个人号管理工具，支持：

- 拉取好友、群组、频道信息
- 手机号验证码登录
- 二维码扫码登录
- 批量删除好友
- 批量退出群组
- 批量取消频道订阅
- 批量清理已注销账号
- 批量清理非好友私聊聊天记录
- 批量清理 Bot 私聊聊天记录（支持按最后使用时间排序）
- 一键清理全部非好友私聊聊天记录
- 危险操作统一 `预览 -> 二次确认 -> 执行`

## 技术栈

- 前端：`Vue3 + Vite + Pinia + Vuetify 3 + TypeScript`
- 后端：`Node.js + Express + TypeScript + GramJS`
- 类型共享：`packages/shared`
- 任务持久化：优先 SQLite（`node:sqlite`），失败时回退 JSON
- 会话持久化：优先 keytar（若安装），否则回退 `apps/server/data/session.json`

## 前端 UI

- 采用 Material Design 2.0 风格主题（蓝色系）
- 支持浅色/暗色模式（系统跟随 + 手动覆盖，持久化到 `tg.ui.themeMode`）
- 响应式导航：桌面侧边导航，移动底部导航

## 目录结构

```text
apps/
  server/   # Express API + Telegram 调用
  web/      # Vue 前端
packages/
  shared/   # 前后端共享类型
```

## 快速开始

```bash
npm install
npm run dev
```

可选：安装 `keytar` 以启用系统安全存储（不安装会自动回退到本地文件）：

```bash
npm install keytar --workspace @tg-tools/server
```

默认地址：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3000`

## 使用流程

1. 打开 `登录配置` 页面。
2. 填写 Telegram `api_id / api_hash`（保存在浏览器 `localStorage`）。
3. 点击 `初始化客户端`。
4. 输入手机号，发送验证码并登录；或点击二维码登录并在手机 Telegram 扫码确认。
5. 若提示 2FA，输入二步密码。
6. 进入好友/群组/频道页面执行批量操作。
7. 在 `Bots` 页面可按最后使用时间排序并批量清理 Bot 私聊记录。
8. 在 `非好友私聊` 页面可批量清理非好友个人聊天记录。
9. 或在 `清理已注销`、`清理非好友私聊` 页面执行一键清理。
10. 在 `任务中心` 查看执行进度、明细并导出 JSON。

## 关键 API

- `POST /api/auth/init`
- `POST /api/auth/send-code`
- `POST /api/auth/sign-in`
- `POST /api/auth/password`
- `POST /api/auth/qr/start`
- `GET /api/auth/qr/status`
- `GET /api/auth/status`
- `POST /api/auth/logout`
- `GET /api/entities?type=friend|group|channel|non_friend_chat|bot_chat&sortBy=title|last_used_at&sortOrder=asc|desc`
- `POST /api/ops/preview`
- `POST /api/ops/execute`
- `GET /api/ops/:jobId`
- `POST /api/cleanup/deleted/preview`
- `POST /api/cleanup/deleted/execute`
- `POST /api/cleanup/non-friends/preview`
- `POST /api/cleanup/non-friends/execute`
- `POST /api/cleanup/bots/preview`
- `POST /api/cleanup/bots/execute`

## 测试与构建

```bash
npm run typecheck
npm run test
npm run build
```

## 风险与说明

- 本项目面向个人账号管理，请遵守 Telegram 平台规则。
- 批量操作存在不可逆风险，务必核对预览列表后再执行。
- 遇到 FloodWait 时会自动等待后继续执行。
