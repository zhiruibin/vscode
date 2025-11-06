#!/bin/bash

# 设置Node.js路径
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"

# 设置VS Code开发环境变量
export VSCODE_DEV=1
export ELECTRON_RUN_AS_NODE=1

# 启动Newma应用
echo "启动Newma应用..."
node out-build/main.js "$@"





