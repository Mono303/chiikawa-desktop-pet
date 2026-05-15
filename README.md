# 🐹 吉伊桌宠 (Chiikawa Desktop Pet)

一个在 Windows 桌面上显示吉伊 (Chiikawa) 角色的桌宠应用。角色置顶显示，透明背景，支持拖拽和点击互动，每分钟自动播放不同动画。

![Preview](preview.png)

## 特性

- **置顶显示** — 角色始终在桌面最上层
- **透明背景** — 只显示角色像素，其余区域穿透点击
- **定时动画** — 每 60 秒自动切换一个随机动作
- **点击互动** — 点击触发随机动画，连点 3 次触发哭泣
- **音效反馈** — 每次点击随机播放合成音效或自定义 MP3
- **自由拖拽** — 按住角色拖动到任意位置
- **右键菜单** — 重置位置 / 退出
- **托盘图标** — 系统托盘显示运行状态，右键快速退出

## 动画状态

| 状态 | 文件 | 触发方式 |
|------|------|---------|
| 🏠 待机 | `nomal.gif` | 默认循环 |
| 🎭 随机动作 1-7 | `1.gif` ~ `7.gif` | 每 60s / 点击 |
| 😢 哭泣 | `cry.gif` | 3s 内连点 3 次 |

## 快速启动

**方式一：双击运行**
```
start.bat
```

**方式二：命令行**
```bash
npm install
npm start
```

**方式三：构建便携 exe**
```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run build
# 产物在 dist/ChiikawaPet 1.0.0.exe
```

## 替换 GIF 素材

1. 去 [GIPHY 搜 Chiikawa](https://giphy.com/search/chiikawa/) 找喜欢的 GIF
2. 右键 → "图片另存为" → 保存到 `assets/` 目录
3. 文件名保持不变（`nomal.gif`, `1.gif` ~ `7.gif`, `cry.gif`）

**注意：** GIF 尺寸不宜过大（建议 < 2MB），背景透明效果最佳。

## 自定义音效

在 `assets/` 目录放入任意 `.mp3` 文件即可替换合成音（文件名不限，中文也行）：

- 音效文件与动画状态**解耦**，每次点击随机播放
- 音效数量可以多于（或少于）动作状态数 7 个
- 如有 `cry.mp3`，哭泣动画也会播放该文件（否则使用固定合成音）
- 不放 MP3 文件则使用内置合成音（12 种变体）

## 项目结构

```
chiikawa-pet/
├── main.js                # Electron 主进程
├── preload.js             # 安全桥接（gifuct + IPC）
├── renderer/
│   ├── index.html         # 宠物窗口页面
│   ├── style.css          # 样式
│   └── app.js             # 核心逻辑
├── assets/                # GIF 素材 + 可选音效
│   ├── nomal.gif
│   ├── 1.gif ~ 7.gif
│   ├── cry.gif
│   └── *.mp3                    # 自定义音效（可选，任意文件名）
├── package.json
├── preview.html           # 素材预览
├── skill/                 # Claude Code Skill 定义
│   ├── SKILL.md
│   └── assets/
├── start.bat
└── README.md
```

## Skill

本项目同时是一个 [Claude Code Skill](skill/SKILL.md)，安装后可以说"帮我做一个吉伊桌宠"即可自动重建整个项目。

## 技术栈

- **Electron 33** — 桌面应用框架
- **gifuct-js** — GIF 解码与逐帧渲染
- **HTML/CSS/JS** — 界面与交互逻辑

## 更新日志

### v1.2.0 — 2026-05-15

- **系统托盘图标** — 任务栏右侧显示运行状态，右键可快速退出
- **MP3 动态扫描** — 自动识别 `assets/` 下所有 `.mp3` 文件（不再限定命名格式）
- **支持中文文件名** — MP3 文件可以是任意名称，包括中文
- **cry.mp3 独立支持** — 如有 `cry.mp3`，哭泣动画会播放此文件
- 修复 MP3 播放全程淡出导致的音量递减问题

### v1.1.0 — 2026-05-14

- **音效系统重构** — 点击音效与动画状态解耦，改为随机音效池
- **自定义 MP3 支持** — 放入 `sound1.mp3` ~ `soundN.mp3` 自动替换合成音，数量不限
- **内联合成音池** — 无 MP3 时使用 12 种内置合成音随机播放
- **cry 音效独立** — 哭泣动画使用固定低频音效，不影响随机池
- 新增 README 自定义音效说明

### v1.0.1 — 2026-05-13

- 动画循环改为 2 遍后返回待机
- 新增 Web Audio API 合成音效系统
- Chromium 自动播放策略适配（首次交互初始化 AudioContext）

### v1.0.0 — 2026-05-13

- 初始版本发布
- Electron 透明窗口 GIF 桌宠
- 待机 / 7 种随机动作 / 哭泣 状态机
- 像素级点击检测与拖拽
- 右键菜单（重置位置 / 退出）
- 支持替换 GIF 素材

## License

MIT
