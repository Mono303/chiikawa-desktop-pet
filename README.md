# 🐹 吉伊桌宠 (Chiikawa Desktop Pet)

一个在 Windows 桌面上显示吉伊 (Chiikawa) 角色的桌宠应用。角色置顶显示，透明背景，支持拖拽和点击互动，每分钟自动播放不同动画。

![Preview](preview.png)

## 特性

- **置顶显示** — 角色始终在桌面最上层
- **透明背景** — 只显示角色像素，其余区域穿透点击
- **定时动画** — 每 60 秒自动切换一个随机动作
- **点击互动** — 点击触发随机动画，连点 3 次触发哭泣
- **自由拖拽** — 按住角色拖动到任意位置
- **右键菜单** — 重置位置 / 退出

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

## 项目结构

```
chiikawa-pet/
├── main.js                # Electron 主进程
├── preload.js             # 安全桥接（gifuct + IPC）
├── renderer/
│   ├── index.html         # 宠物窗口页面
│   ├── style.css          # 样式
│   └── app.js             # 核心逻辑
├── assets/                # GIF 素材
│   ├── nomal.gif
│   ├── 1.gif ~ 7.gif
│   └── cry.gif
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

## License

MIT
