# AI 社交推理游戏（静态前端）

这是一个前端页面项目，支持两种模式：

- 谁是卧底（`undercover.js`）
- 狼人杀（`werewolf.js`）

页面负责：

- 配置玩家数量、角色与模型
- 调用后端 API 获取模型列表与聊天结果
- 按状态机推进对局并渲染日志

> 注意：当前目录仅包含静态前端文件，不包含后端实现。  
> 你需要自行提供 `/api/models` 与 `/api/chat` 接口。

---

## 1. 目录说明

- `index.html`：主页面
- `style.css`：样式
- `common.js`：公共函数（API 调用、消息渲染、解析等）
- `app.js`：页面逻辑与模式切换
- `undercover.js`：谁是卧底引擎
- `werewolf.js`：狼人杀引擎

---

## 2. 环境准备

建议环境：

- Node.js 18+（仅用于本地静态服务）
- 现代浏览器（Chrome / Edge）
- 可用的大模型 API（OpenAI 兼容接口）

可选工具（用于上传 GitHub）：

- Git
- GitHub CLI（`gh`）

Windows 安装示例（PowerShell）：

```powershell
winget install --id Git.Git -e
winget install --id GitHub.cli -e
```

---

## 3. 本地启动（前端）

在项目目录启动一个静态服务器即可，不建议直接双击 `index.html`。

### 方式 A：Node 内置静态服务

```powershell
cd c:\Users\Administrator\.gemini\antigravity\scratch\ai_undercover\static
npx serve .
```

### 方式 B：Python 静态服务

```powershell
cd c:\Users\Administrator\.gemini\antigravity\scratch\ai_undercover\static
python -m http.server 5500
```

然后浏览器打开：

- `http://localhost:3000`（`serve` 默认）
- 或 `http://localhost:5500`（Python 示例）

---

## 4. 必要后端接口（你需要提供）

前端会请求这两个接口：

### `POST /api/models`

请求体示例：

```json
{
  "api_key": "sk-xxx",
  "api_base": "https://api.openai.com/v1"
}
```

返回体示例：

```json
{
  "models": ["gpt-4o-mini", "gpt-4.1"]
}
```

### `POST /api/chat`

请求体示例：

```json
{
  "api_key": "sk-xxx",
  "api_base": "https://api.openai.com/v1",
  "model": "gpt-4o-mini",
  "messages": [
    {"role":"system","content":"..."},
    {"role":"user","content":"..."}
  ],
  "temperature": 0.7
}
```

返回体示例：

```json
{
  "content": "[mind] ... [answer] ...",
  "reasoning_content": ""
}
```

---

## 5. 使用流程（UI）

1. 填写 `API Base URL`、`API Key`
2. 点击“连接并获取模型”
3. 选择游戏模式（谁是卧底 / 狼人杀）
4. 配置人数、词语或角色
5. 给每位玩家分配模型（可“快捷覆盖全部”）
6. 点击“进入对局”
7. 使用“单步推进”或“自动播放”

---

## 6. 狼人杀规则实现要点（当前版本）

- 夜晚顺序：守卫 -> 狼人 -> 女巫 -> 预言家
- 守卫不可连续两晚守同一人
- 狼人两轮协商后统一落刀
- 女巫解药要求“救X/不救”，且 `X` 必须是当晚刀口
- 支持奶穿（同守同救导致死亡）
- 预言家查验结果会写入私有历史
- 猎人 / 狼王死亡触发技能支持连锁结算
- 白狼王白天可自爆带人并直接进黑夜
- 白痴被票时翻牌免死并失去投票权
- 首夜死亡有遗言占位日志

---

## 7. 常见问题排查

### Q1：点“连接并获取模型”报错

检查：

- `API Base URL` 是否可访问
- `API Key` 是否有效
- 后端是否已实现 `/api/models`
- 控制台/网络面板里是否出现 CORS 或 404

### Q2：能开局但 AI 不回复

检查：

- 后端 `/api/chat` 是否存在
- 返回 JSON 是否包含 `content`
- 玩家是否都选了模型

### Q3：自动播放只走一步

当前已修复为循环推进；若仍异常，先确认：

- `state.isAuto` 是否被异常改回 `false`
- 控制台是否有 JS 报错中断

---

## 8. 上传到 GitHub（完整步骤）

> 若命令提示 `git` 不存在，请先安装 Git 并重开终端。

在项目目录执行：

```powershell
cd c:\Users\Administrator\.gemini\antigravity\scratch\ai_undercover\static
git init
git add .
git commit -m "init: AI social deduction game frontend"
```

### 方案 A：用 GitHub CLI 自动创建仓库（推荐）

先登录：

```powershell
gh auth login
```

创建并推送：

```powershell
gh repo create ai-undercover-static --private --source . --remote origin --push
```

> 想公开仓库，把 `--private` 改成 `--public`。

### 方案 B：在网页先建仓库，再手动绑定远程

```powershell
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

---

## 9. 安全建议

- 不要把真实 API Key 提交到仓库
- 前端仅适合本地/受控环境演示，生产环境建议后端托管密钥

---

## 10. 后续改进建议

- 把规则结算进一步模块化成 `RuleEngine`
- 增加自动化测试（夜晚结算、胜负判定、技能连锁）
- 增加“无 [mind] 自动重试”机制提升输出稳定性

