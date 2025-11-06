# Newma 开发指南

本文档记录了 Newma 项目（VS Code 分支）的开发环境设置、依赖库、编译命令和运行命令。

## 项目信息

- **项目名称**: Newma (VS Code 分支)
- **版本**: 1.106.0
- **包名**: code-oss-dev

## 环境要求

### 运行时环境

- **Node.js**: v20.19.5 (LTS)
  - 在 macOS (Homebrew) 上: `/opt/homebrew/opt/node@20/bin/node`
  - 确保 Node 20 在 PATH 的最前面:
    ```bash
    export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
    ```
- **npm**: v10.8.2 (随 Node 20 一起提供)
- **操作系统**: macOS / Linux / Windows

### 验证

```bash
node --version  # 应输出: v20.19.5
npm --version   # 应输出: 10.8.2
```

## 主要依赖库

### 核心依赖

| 包名 | 版本 | 用途 |
|---------|---------|---------|
| `@microsoft/1ds-core-js` | ^3.2.13 | 遥测数据 |
| `@microsoft/1ds-post-js` | ^3.2.13 | 遥测数据发送 |
| `@vscode/ripgrep` | ^1.15.13 | 快速文本搜索 |
| `@vscode/spdlog` | ^0.15.2 | 日志记录 |
| `@vscode/sqlite3` | 5.1.8-vscode | 数据库 |
| `@xterm/xterm` | ^5.6.0-beta.119 | 终端模拟器 |
| `vscode-textmate` | ^9.2.1 | TextMate 语法支持 |
| `vscode-oniguruma` | 1.7.0 | 正则表达式引擎 |
| `node-pty` | 1.1.0-beta35 | 伪终端 |
| `native-keymap` | ^3.3.5 | 键盘映射 |
| `undici` | ^7.9.0 | HTTP 客户端 |

### 开发依赖

| 包名 | 版本 | 用途 |
|---------|---------|---------|
| `@playwright/test` | ^1.55.1 | E2E 测试 |
| `@types/node` | 22.x | TypeScript 类型定义 |
| `@typescript/native-preview` | ^7.0.0-dev.20250812.1 | TypeScript 编译器 |
| `@vscode/gulp-electron` | ^1.38.2 | Electron 构建工具 |
| `@vscode/test-electron` | ^2.4.0 | Electron 测试 |
| `gulp` | (通过 gulpfile) | 构建系统 |

## 编译命令

### 初始设置

```bash
# 确保 Node 20 在 PATH 中
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"

# 安装依赖
npm ci

# 编译项目
npm run compile
```

### 编译命令列表

| 命令 | 说明 |
|---------|-------------|
| `npm run compile` | 完整编译（主程序 + 扩展） |
| `npm run compile-check-ts-native` | TypeScript 类型检查 |
| `npm run watch` | 监听模式（客户端 + 扩展） |
| `npm run watch-client` | 仅监听客户端 |
| `npm run watch-extensions` | 仅监听扩展 |
| `npm run compile-web` | 编译 Web 版本 |
| `npm run compile-cli` | 仅编译 CLI |
| `npm run compile-build` | 生产构建（带代码混淆） |

### 构建系统

- **构建工具**: Gulp
- **入口文件**: `gulpfile.js`
- **主要任务**: `compile`, `watch-client`, `watch-extensions`

## 运行命令

### 开发启动（推荐）

```bash
# 确保 Node 20 在 PATH 中
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"

# 启动（包含 preLaunch：下载 Electron，同步内置扩展）
./scripts/code.sh
```

### 后端服务（Backend Server）启动

用于运行 Newma AI 后端服务（`server/newma-ai-backend`）。

#### 编译后端服务

```bash
# 进入后端服务目录
cd server/newma-ai-backend

# 安装依赖（如果尚未安装）
npm install

# 编译 TypeScript 代码
npm run build
```

#### 启动后端服务

```bash
# 确保 Node 20 在 PATH 中
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"

# 进入后端服务目录
cd server/newma-ai-backend

# 启动服务（生产模式）
npm start

# 或开发模式（带 watch，自动重新编译）
npm run dev
```

说明：
- `npm start` 启动编译后的服务（`dist/server.js`）
- `npm run dev` 启动开发模式，支持自动重新编译和热重载
- 服务默认监听端口由环境变量或配置文件决定

### VS Code Server 启动

用于运行 VS Code Server（即浏览器访问的远程服务端）。

```bash
# 确保 Node 20 在 PATH 中
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"

# 启动服务端（默认端口 9888，可通过 VSCODE_SERVER_PORT 覆盖）
./scripts/code-server.sh --launch

# 或不自动打开浏览器：
./scripts/code-server.sh

# 自定义端口（示例 9000）：
VSCODE_SERVER_PORT=9000 ./scripts/code-server.sh --launch
```

说明：
- 脚本会先执行 `build/lib/preLaunch.js`，确保 Electron/内置扩展与 Node 运行时就绪；随后调用 `out/server-main.js` 启动服务端。
- `--launch` 会在启动完成后自动打开浏览器；不带 `--launch` 仅打印地址（日志中包含 `Web UI available at ...`）。

### Web（纯 Web 形态）启动

使用内置的 `@vscode/test-web` 启动本地 Web 形态（无需 Electron）。

```bash
# 确保 Node 20 在 PATH 中
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"

# 启动 Web（默认 host=localhost, port=8080）
./scripts/code-web.sh

# 指定 host 与端口
./scripts/code-web.sh --host 0.0.0.0 --port 8081

# 启用 playground（会下载 vscode-web-playground）
./scripts/code-web.sh --playground
```

### 直接启动

```bash
# 确保 Node 20 在 PATH 中
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"

# 预启动（如需要则下载 Electron，同步内置扩展）
node build/lib/preLaunch.js

# 直接启动
"./.build/electron/Newma.app/Contents/MacOS/Electron" . --disable-extension=vscode.vscode-api-tests
```

### 启动脚本说明

`./scripts/code.sh` 脚本执行以下操作：
1. 设置 Node 20 PATH（macOS）
2. 运行 `preLaunch.js`（下载 Electron，同步内置扩展）
3. 使用开发标志启动 Electron：
   - `NODE_ENV=development`
   - `VSCODE_DEV=1`
   - `VSCODE_CLI=1`
   - `ELECTRON_ENABLE_STACK_DUMPING=1`
   - `ELECTRON_ENABLE_LOGGING=1`

## 其他有用命令

### 测试

```bash
npm run test              # 运行测试（查看 scripts 文件夹）
npm run test-browser      # 浏览器测试（带 Playwright 安装）
npm run test-node         # Node.js 单元测试
npm run test-extension    # 扩展测试
npm run smoketest         # 冒烟测试
```

### 代码质量

```bash
npm run eslint            # 运行 ESLint
npm run stylelint         # 运行 Stylelint
npm run hygiene           # 运行代码规范检查
npm run precommit         # 提交前检查
```

### 扩展管理

```bash
npm run download-builtin-extensions    # 下载内置扩展
npm run download-builtin-extensions-cg # 使用 CG manifest 下载
```

### 开发工具

```bash
npm run gulp              # 直接运行 gulp
npm run electron          # Electron 辅助工具
npm run update-grammars   # 更新语言语法
npm run update-localization-extension  # 更新本地化
```

## 项目结构

```
.
├── build/              # 构建脚本和配置
├── src/                # 源代码
├── scripts/            # 工具脚本
│   └── code.sh        # 主启动脚本
├── resources/          # 资源文件（图标等）
├── out/                # 编译输出
├── .build/             # 构建产物
│   └── electron/      # Electron 二进制文件
├── package.json        # 项目清单
└── gulpfile.js         # 构建配置
```

## 常见问题及解决方案

### Node 版本不匹配

**错误**: `TypeError: Cannot read properties of undefined (reading 'exports')`

**解决方案**: 使用 Node 20 LTS (v20.19.5)。确保 PATH 指向 Node 20：
```bash
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
```

### 缺少构建依赖

**错误**: 缺少 `ternary-stream`、`gulp-sort` 等包

**解决方案**: 在项目根目录运行 `npm ci`，然后重新运行 `npm run compile`

### 缺少本地化文件

**错误**: `ENOENT: out/nls.messages.json`

**解决方案**: 运行 `npm run compile` 生成本地化资源

### Electron 下载超时

**解决方案**: 如需要，设置 `ELECTRON_MIRROR` 环境变量

## 快速开始清单

1. ✅ 确保 Node 20 在 PATH 中: `export PATH="/opt/homebrew/opt/node@20/bin:$PATH"`
2. ✅ 安装依赖: `npm ci`
3. ✅ 编译项目: `npm run compile`
4. ✅ 启动: `./scripts/code.sh`

## 其他文档

- `NEWMA_DEV_RUNBOOK.md` - 详细开发运行手册
- `LOCAL_RUN_NOTES.md` - 本地运行笔记
- `RENAME_INSTRUCTIONS.md` - 重命名说明

## 注意事项

- 开发时始终使用 Node 20 LTS
- 项目使用 npm（不使用 yarn）
- 开发运行不需要 Git 子模块
- macOS 图标资源: `resources/darwin/newma.icns`
- 产品品牌配置: `product.json`
