# Newma 重命名脚本使用说明

## 📋 概述

本目录包含了将 VS Code 重命名为 Newma 的完整脚本和配置文件。这些脚本将帮助您：

- 重命名所有可执行文件和目录
- 更新产品信息和配置
- 替换源码中的字符串
- 更新构建脚本和资源文件
- 生成详细的重命名报告

## 🚀 快速开始

### 方法1：使用 Bash 脚本（推荐）

```bash
# 1. 给脚本执行权限
chmod +x rename-to-newma.sh

# 2. 运行重命名脚本
./rename-to-newma.sh
```

### 方法2：使用 TypeScript 脚本

```bash
# 1. 安装依赖（如果需要）
npm install

# 2. 运行 TypeScript 脚本
npx ts-node rename-to-newma.ts
```

## 📁 文件说明

### 核心脚本文件

- **`rename-to-newma.sh`** - Bash 版本的重命名脚本
- **`rename-to-newma.ts`** - TypeScript 版本的重命名脚本
- **`rename-config.json`** - 重命名配置文件
- **`RENAME_INSTRUCTIONS.md`** - 本使用说明文档

### 生成的文件

- **`rename-report.md`** - 重命名完成后生成的报告
- **`.backup/`** - 备份目录（如果创建了备份）

## ⚙️ 配置说明

### 重命名规则

脚本会根据 `rename-config.json` 中的配置进行重命名：

```json
{
  "replacements": {
    "product": {
      "Visual Studio Code": "Newma",
      "VS Code": "Newma",
      "vscode": "newma"
    }
  }
}
```

### 文件操作

脚本会执行以下操作：

1. **重命名文件和目录**
   - `Code - OSS.app` → `Newma.app`
   - `code` → `newma`
   - `.vscode` → `.newma`

2. **更新配置文件**
   - `package.json` - 产品信息
   - `product.json` - 应用配置

3. **替换源码字符串**
   - 所有 `.ts`, `.js`, `.json`, `.md` 等文件
   - 排除 `node_modules`, `.git` 等目录

4. **更新资源文件**
   - 图标文件重命名
   - 构建脚本更新

## 🔧 自定义配置

### 修改重命名规则

编辑 `rename-config.json` 文件：

```json
{
  "replacements": {
    "product": {
      "Visual Studio Code": "YourProductName",
      "VS Code": "YourProductName"
    }
  }
}
```

### 添加新的文件类型

在 `fileTypes` 数组中添加新的文件扩展名：

```json
{
  "fileTypes": [
    ".ts",
    ".js",
    ".json",
    ".md",
    ".html",
    ".css",
    ".yml",
    ".yaml",
    ".xml",
    ".sh",
    ".bat",
    ".py"  // 新增 Python 文件
  ]
}
```

### 排除特定文件或目录

在 `excludeFiles` 或 `excludeDirs` 中添加：

```json
{
  "excludeFiles": [
    "your-custom-file.ts"
  ],
  "excludeDirs": [
    "your-custom-dir"
  ]
}
```

## 📊 重命名过程

### 执行步骤

1. **验证环境** - 检查是否在正确的目录
2. **创建备份** - 备份重要文件
3. **重命名文件** - 重命名可执行文件和目录
4. **更新配置** - 更新 package.json 和 product.json
5. **替换字符串** - 在源码文件中替换字符串
6. **更新资源** - 重命名图标和资源文件
7. **清理临时文件** - 删除临时文件
8. **验证结果** - 验证重命名是否成功
9. **生成报告** - 生成详细的重命名报告

### 进度显示

脚本会显示详细的进度信息：

```
🚀 开始 Newma 重命名过程...
ℹ️  创建备份...
✅ 备份创建完成
ℹ️  重命名可执行文件和目录...
✅ 重命名: Code - OSS.app -> Newma.app
✅ 重命名: code -> newma
...
```

## 🛠️ 故障排除

### 常见问题

#### 1. 权限错误
```bash
# 解决方案：给脚本执行权限
chmod +x rename-to-newma.sh
```

#### 2. 文件被占用
```bash
# 解决方案：关闭所有 VS Code 实例
pkill -f "Code"
# 或者
pkill -f "newma"
```

#### 3. 备份恢复
```bash
# 从备份恢复
cp .backup/package.json package.json
cp .backup/product.json product.json
```

#### 4. 部分重命名失败
```bash
# 检查错误日志
tail -f rename-report.md

# 手动重命名特定文件
mv "Code - OSS.app" "Newma.app"
```

### 验证重命名结果

运行以下命令验证重命名是否成功：

```bash
# 检查 package.json
grep '"name": "newma"' package.json

# 检查 product.json
grep '"nameShort": "Newma"' product.json

# 检查可执行文件
ls -la newma
ls -la Newma.app
```

## 📈 后续步骤

### 1. 编译项目
```bash
npm run compile
```

### 2. 运行测试
```bash
npm test
```

### 3. 启动应用
```bash
./newma
```

### 4. 验证功能
- 检查应用是否正常启动
- 验证所有功能是否正常
- 测试 AI 功能（如果已集成）

## 🔒 安全注意事项

1. **备份重要数据** - 脚本会自动创建备份，但建议手动备份重要文件
2. **测试环境** - 建议先在测试环境中运行脚本
3. **版本控制** - 确保在 Git 仓库中运行，以便回滚
4. **权限检查** - 确保有足够的文件系统权限

## 📞 支持

如果遇到问题：

1. 检查 `rename-report.md` 中的错误信息
2. 查看脚本输出的日志
3. 从 `.backup` 目录恢复原始文件
4. 重新运行脚本

## 🎯 最佳实践

1. **分步执行** - 可以分步执行脚本的各个部分
2. **测试验证** - 每个步骤后都进行验证
3. **文档记录** - 记录所有自定义修改
4. **版本管理** - 使用 Git 管理重命名过程

---

*本脚本基于 VS Code 源码结构设计，适用于将 VS Code 重命名为 Newma 或类似产品。*
