#!/bin/bash

# Newma 重命名脚本
# 将 VS Code 重命名为 Newma

set -e  # 遇到错误立即退出

echo "🚀 开始 Newma 重命名过程..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 检查是否在正确的目录
if [ ! -f "package.json" ] || [ ! -d "src" ]; then
    log_error "请在 VS Code 源码根目录下运行此脚本"
    exit 1
fi

# 创建备份
log_info "创建备份..."
if [ ! -d ".backup" ]; then
    mkdir -p .backup
    cp -r . .backup/ 2>/dev/null || true
    log_success "备份创建完成"
fi

# 1. 重命名可执行文件和目录
log_info "重命名可执行文件和目录..."

# 重命名应用包
if [ -d "Code - OSS.app" ]; then
    mv "Code - OSS.app" "Newma.app"
    log_success "重命名: Code - OSS.app -> Newma.app"
fi

# 重命名可执行文件
for file in code code-oss; do
    if [ -f "$file" ]; then
        mv "$file" "newma"
        log_success "重命名: $file -> newma"
    fi
done

# 重命名配置文件目录
if [ -d ".vscode" ]; then
    mv ".vscode" ".newma"
    log_success "重命名: .vscode -> .newma"
fi

# 重命名配置文件
for file in vscode.json; do
    if [ -f "$file" ]; then
        mv "$file" "newma.json"
        log_success "重命名: $file -> newma.json"
    fi
done

# 2. 更新 package.json
log_info "更新 package.json..."
if [ -f "package.json" ]; then
    # 备份原始文件
    cp package.json package.json.backup

    # 使用 sed 进行替换
    sed -i.tmp 's/"name": "vscode"/"name": "newma"/g' package.json
    sed -i.tmp 's/"displayName": "Visual Studio Code"/"displayName": "Newma"/g' package.json
    sed -i.tmp 's/"description": "Code editing. Redefined."/"description": "AI-Powered Code Editor"/g' package.json
    sed -i.tmp 's/"homepage": "https:\/\/code.visualstudio.com\/"/"homepage": "https:\/\/newma.top\/"/g' package.json
    sed -i.tmp 's/"repository": {/"repository": {/g' package.json
    sed -i.tmp 's/"url": "https:\/\/github.com\/microsoft\/vscode.git"/"url": "https:\/\/github.com\/newma\/newma.git"/g' package.json
    sed -i.tmp 's/"bugs": {/"bugs": {/g' package.json
    sed -i.tmp 's/"url": "https:\/\/github.com\/microsoft\/vscode\/issues"/"url": "https:\/\/github.com\/newma\/newma\/issues"/g' package.json

    # 删除临时文件
    rm -f package.json.tmp
    log_success "package.json 更新完成"
fi

# 3. 更新 product.json
log_info "更新 product.json..."
if [ -f "product.json" ]; then
    cp product.json product.json.backup

    sed -i.tmp 's/"nameShort": "Code - OSS"/"nameShort": "Newma"/g' product.json
    sed -i.tmp 's/"nameLong": "Code - OSS"/"nameLong": "Newma"/g' product.json
    sed -i.tmp 's/"applicationName": "code-oss"/"applicationName": "newma"/g' product.json
    sed -i.tmp 's/"win32AppId": "com.vscode.oss"/"win32AppId": "com.newma.editor"/g' product.json
    sed -i.tmp 's/"win32x64AppId": "com.vscode.oss"/"win32x64AppId": "com.newma.editor"/g' product.json
    sed -i.tmp 's/"win32arm64AppId": "com.vscode.oss"/"win32arm64AppId": "com.newma.editor"/g' product.json
    sed -i.tmp 's/"darwinBundleIdentifier": "com.vscode.oss"/"darwinBundleIdentifier": "com.newma.editor"/g' product.json
    sed -i.tmp 's/"linuxAppId": "com.vscode.oss"/"linuxAppId": "com.newma.editor"/g' product.json
    sed -i.tmp 's/"urlProtocol": "code-oss"/"urlProtocol": "newma"/g' product.json
    sed -i.tmp 's/"dataFolderName": ".vscode-oss"/"dataFolderName": ".newma"/g' product.json
    sed -i.tmp 's/"serverApplicationName": "code-server-oss"/"serverApplicationName": "newma-server"/g' product.json
    sed -i.tmp 's/"serverDataFolderName": ".vscode-server-oss"/"serverDataFolderName": ".newma-server"/g' product.json
    sed -i.tmp 's/"webUrl": "https:\/\/vscode.dev"/"webUrl": "https:\/\/newma.top"/g' product.json

    rm -f product.json.tmp
    log_success "product.json 更新完成"
fi

# 4. 更新源码文件中的字符串
log_info "更新源码文件中的字符串..."

# 定义要替换的字符串映射
declare -A replacements=(
    ["Visual Studio Code"]="Newma"
    ["VS Code"]="Newma"
    ["Code - OSS"]="Newma"
    ["vscode"]="newma"
    ["code.visualstudio.com"]="newma.top"
    ["vscode.dev"]="newma.top"
    ["microsoft/vscode"]="newma/newma"
    ["Code OSS"]="Newma"
    ["code-oss"]="newma"
)

# 要处理的文件类型
file_types=("*.ts" "*.js" "*.json" "*.md" "*.html" "*.css" "*.yml" "*.yaml")

# 遍历每种文件类型
for file_type in "${file_types[@]}"; do
    log_info "处理 $file_type 文件..."

    # 查找并处理文件
    find . -name "$file_type" -type f -not -path "./.backup/*" -not -path "./node_modules/*" -not -path "./.git/*" | while read -r file; do
        # 备份原文件
        cp "$file" "$file.backup" 2>/dev/null || true

        # 应用所有替换
        for from in "${!replacements[@]}"; do
            to="${replacements[$from]}"
            sed -i.tmp "s|$from|$to|g" "$file" 2>/dev/null || true
        done

        # 删除临时文件
        rm -f "$file.tmp"
    done
done

log_success "源码文件字符串替换完成"

# 5. 更新构建脚本
log_info "更新构建脚本..."

# 重命名构建文件
for build_file in build/gulpfile.vscode*.js; do
    if [ -f "$build_file" ]; then
        new_name=$(echo "$build_file" | sed 's/vscode/newma/g')
        mv "$build_file" "$new_name"
        log_success "重命名构建文件: $build_file -> $new_name"
    fi
done

# 6. 更新图标和资源文件
log_info "更新图标和资源文件..."

# Windows 图标
if [ -f "resources/win32/code.ico" ]; then
    mv "resources/win32/code.ico" "resources/win32/newma.ico"
    log_success "重命名 Windows 图标"
fi

# macOS 图标
if [ -f "resources/darwin/code.icns" ]; then
    mv "resources/darwin/code.icns" "resources/darwin/newma.icns"
    log_success "重命名 macOS 图标"
fi

# Linux 图标
if [ -f "resources/linux/code.png" ]; then
    mv "resources/linux/code.png" "resources/linux/newma.png"
    log_success "重命名 Linux 图标"
fi

# 7. 更新脚本文件
log_info "更新脚本文件..."

# 更新启动脚本
for script in scripts/*.sh scripts/*.bat; do
    if [ -f "$script" ]; then
        # 备份并更新脚本内容
        cp "$script" "$script.backup"
        sed -i.tmp 's/code/newma/g' "$script"
        sed -i.tmp 's/vscode/newma/g' "$script"
        rm -f "$script.tmp"
        log_success "更新脚本: $script"
    fi
done

# 8. 更新文档文件
log_info "更新文档文件..."

# 更新 README
if [ -f "README.md" ]; then
    cp README.md README.md.backup
    sed -i.tmp 's/Visual Studio Code/Newma/g' README.md
    sed -i.tmp 's/VS Code/Newma/g' README.md
    sed -i.tmp 's/vscode/newma/g' README.md
    rm -f README.md.tmp
    log_success "README.md 更新完成"
fi

# 9. 清理临时文件
log_info "清理临时文件..."
find . -name "*.tmp" -type f -delete 2>/dev/null || true
find . -name "*.backup" -type f -delete 2>/dev/null || true

# 10. 验证重命名结果
log_info "验证重命名结果..."

# 检查关键文件是否存在
if [ -f "package.json" ] && grep -q '"name": "newma"' package.json; then
    log_success "package.json 验证通过"
else
    log_error "package.json 验证失败"
fi

if [ -f "product.json" ] && grep -q '"nameShort": "Newma"' product.json; then
    log_success "product.json 验证通过"
else
    log_error "product.json 验证失败"
fi

# 检查可执行文件
if [ -f "newma" ] || [ -d "Newma.app" ]; then
    log_success "可执行文件重命名验证通过"
else
    log_warning "未找到重命名的可执行文件"
fi

# 11. 生成重命名报告
log_info "生成重命名报告..."

cat > rename-report.md << EOF
# Newma 重命名报告

## 重命名完成时间
$(date)

## 重命名内容
- 产品名称: Visual Studio Code -> Newma
- 可执行文件: code -> newma
- 应用包: Code - OSS.app -> Newma.app
- 配置目录: .vscode -> .newma
- 包名: vscode -> newma

## 主要文件更新
- package.json: 产品信息更新
- product.json: 应用配置更新
- 源码文件: 字符串替换完成
- 构建脚本: 文件名和内容更新
- 图标资源: 重命名完成
- 文档文件: 内容更新完成

## 下一步操作
1. 测试构建: npm run compile
2. 运行测试: npm test
3. 启动应用: ./newma
4. 验证功能: 检查所有功能是否正常

## 注意事项
- 原始文件已备份到 .backup 目录
- 如有问题，可以从备份恢复
- 建议在测试通过后删除备份文件
EOF

log_success "重命名报告已生成: rename-report.md"

echo ""
log_success "🎉 Newma 重命名过程完成！"
echo ""
log_info "下一步操作："
echo "1. 运行 'npm run compile' 编译项目"
echo "2. 运行 'npm test' 执行测试"
echo "3. 运行 './newma' 启动 Newma"
echo "4. 检查 rename-report.md 了解详细信息"
echo ""
log_warning "如有问题，可以从 .backup 目录恢复原始文件"
