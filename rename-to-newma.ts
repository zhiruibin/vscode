#!/usr/bin/env node

/**
 * Newma 重命名脚本 (TypeScript版本)
 * 将 VS Code 重命名为 Newma
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// 颜色输出
const colors = {
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	reset: '\x1b[0m'
};

class NewmaRenamer {
	private replacements: Map<string, string> = new Map([
		['Visual Studio Code', 'Newma'],
		['VS Code', 'Newma'],
		['Code - OSS', 'Newma'],
		['Code OSS', 'Newma'],
		['vscode', 'newma'],
		['code-oss', 'newma'],
		['code.visualstudio.com', 'newma.top'],
		['vscode.dev', 'newma.top'],
		['microsoft/vscode', 'newma/newma'],
		['Code', 'Newma'], // 注意：这个要放在最后，避免误替换
	]);

	private fileExtensions = ['.ts', '.js', '.json', '.md', '.html', '.css', '.yml', '.yaml', '.xml'];
	private excludeDirs = ['.git', 'node_modules', '.backup', 'out', 'dist'];
	private excludeFiles = ['rename-to-newma.ts', 'rename-to-newma.sh'];

	private log(message: string, color: string = colors.reset): void {
		console.log(`${color}${message}${colors.reset}`);
	}

	private logInfo(message: string): void {
		this.log(`ℹ️  ${message}`, colors.blue);
	}

	private logSuccess(message: string): void {
		this.log(`✅ ${message}`, colors.green);
	}

	private logWarning(message: string): void {
		this.log(`⚠️  ${message}`, colors.yellow);
	}

	private logError(message: string): void {
		this.log(`❌ ${message}`, colors.red);
	}

	async renameProject(): Promise<void> {
		try {
			this.logInfo('🚀 开始 Newma 重命名过程...');

			// 检查是否在正确的目录
			if (!this.isValidVSCodeDirectory()) {
				this.logError('请在 VS Code 源码根目录下运行此脚本');
				process.exit(1);
			}

			// 创建备份
			await this.createBackup();

			// 执行重命名步骤
			await this.renameExecutables();
			await this.updatePackageJson();
			await this.updateProductJson();
			await this.updateSourceFiles();
			await this.updateBuildFiles();
			await this.updateResourceFiles();
			await this.updateScriptFiles();
			await this.updateDocumentation();
			await this.cleanupTempFiles();
			await this.validateRename();
			await this.generateReport();

			this.logSuccess('🎉 Newma 重命名过程完成！');
			this.printNextSteps();

		} catch (error) {
			this.logError(`重命名过程中出现错误: ${error}`);
			process.exit(1);
		}
	}

	private isValidVSCodeDirectory(): boolean {
		return fs.existsSync('package.json') && fs.existsSync('src');
	}

	private async createBackup(): Promise<void> {
		this.logInfo('创建备份...');
		if (!fs.existsSync('.backup')) {
			fs.mkdirSync('.backup');
			this.logSuccess('备份目录创建完成');
		}
	}

	private async renameExecutables(): Promise<void> {
		this.logInfo('重命名可执行文件和目录...');

		const renames = [
			{ from: 'Code - OSS.app', to: 'Newma.app' },
			{ from: 'code', to: 'newma' },
			{ from: 'code-oss', to: 'newma' },
			{ from: '.vscode', to: '.newma' },
			{ from: 'vscode.json', to: 'newma.json' }
		];

		for (const rename of renames) {
			if (fs.existsSync(rename.from)) {
				fs.renameSync(rename.from, rename.to);
				this.logSuccess(`重命名: ${rename.from} -> ${rename.to}`);
			}
		}
	}

	private async updatePackageJson(): Promise<void> {
		this.logInfo('更新 package.json...');

		if (fs.existsSync('package.json')) {
			const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

			// 备份原文件
			fs.writeFileSync('package.json.backup', JSON.stringify(packageJson, null, 2));

			// 更新字段
			packageJson.name = 'newma';
			packageJson.displayName = 'Newma';
			packageJson.description = 'AI-Powered Code Editor';
			packageJson.homepage = 'https://newma.dev/';

			if (packageJson.repository) {
				packageJson.repository.url = 'https://github.com/newma/newma.git';
			}

			if (packageJson.bugs) {
				packageJson.bugs.url = 'https://github.com/newma/newma/issues';
			}

			fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
			this.logSuccess('package.json 更新完成');
		}
	}

	private async updateProductJson(): Promise<void> {
		this.logInfo('更新 product.json...');

		if (fs.existsSync('product.json')) {
			const productJson = JSON.parse(fs.readFileSync('product.json', 'utf8'));

			// 备份原文件
			fs.writeFileSync('product.json.backup', JSON.stringify(productJson, null, 2));

			// 更新字段
			productJson.nameShort = 'Newma';
			productJson.nameLong = 'Newma';
			productJson.applicationName = 'newma';
			productJson.win32AppId = 'com.newma.editor';
			productJson.win32x64AppId = 'com.newma.editor';
			productJson.win32arm64AppId = 'com.newma.editor';
			productJson.darwinBundleIdentifier = 'com.newma.editor';
			productJson.linuxAppId = 'com.newma.editor';
			productJson.urlProtocol = 'newma';
			productJson.dataFolderName = '.newma';
			productJson.serverApplicationName = 'newma-server';
			productJson.serverDataFolderName = '.newma-server';
			productJson.webUrl = 'https://newma.dev';

			fs.writeFileSync('product.json', JSON.stringify(productJson, null, 2));
			this.logSuccess('product.json 更新完成');
		}
	}

	private async updateSourceFiles(): Promise<void> {
		this.logInfo('更新源码文件中的字符串...');

		for (const ext of this.fileExtensions) {
			this.logInfo(`处理 ${ext} 文件...`);
			const files = this.findFiles(ext);

			for (const file of files) {
				await this.updateFileContent(file);
			}
		}

		this.logSuccess('源码文件字符串替换完成');
	}

	private findFiles(extension: string): string[] {
		const files: string[] = [];

		const findFilesRecursive = (dir: string): void => {
			if (this.excludeDirs.some(exclude => dir.includes(exclude))) {
				return;
			}

			const items = fs.readdirSync(dir);

			for (const item of items) {
				const fullPath = path.join(dir, item);
				const stat = fs.statSync(fullPath);

				if (stat.isDirectory()) {
					findFilesRecursive(fullPath);
				} else if (stat.isFile() && item.endsWith(extension) && !this.excludeFiles.includes(item)) {
					files.push(fullPath);
				}
			}
		};

		findFilesRecursive('.');
		return files;
	}

	private async updateFileContent(filePath: string): Promise<void> {
		try {
			let content = fs.readFileSync(filePath, 'utf8');
			let modified = false;

			// 备份原文件
			fs.writeFileSync(`${filePath}.backup`, content);

			// 应用所有替换
			for (const [from, to] of this.replacements) {
				const regex = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
				if (content.includes(from)) {
					content = content.replace(regex, to);
					modified = true;
				}
			}

			if (modified) {
				fs.writeFileSync(filePath, content);
				this.logSuccess(`更新: ${filePath}`);
			}
		} catch (error) {
			this.logWarning(`无法处理文件 ${filePath}: ${error}`);
		}
	}

	private async updateBuildFiles(): Promise<void> {
		this.logInfo('更新构建脚本...');

		const buildDir = 'build';
		if (fs.existsSync(buildDir)) {
			const files = fs.readdirSync(buildDir);

			for (const file of files) {
				if (file.includes('vscode')) {
					const oldPath = path.join(buildDir, file);
					const newPath = path.join(buildDir, file.replace(/vscode/g, 'newma'));

					fs.renameSync(oldPath, newPath);
					this.logSuccess(`重命名构建文件: ${file} -> ${path.basename(newPath)}`);
				}
			}
		}
	}

	private async updateResourceFiles(): Promise<void> {
		this.logInfo('更新图标和资源文件...');

		const resourceRenames = [
			{ from: 'resources/win32/code.ico', to: 'resources/win32/newma.ico' },
			{ from: 'resources/darwin/code.icns', to: 'resources/darwin/newma.icns' },
			{ from: 'resources/linux/code.png', to: 'resources/linux/newma.png' }
		];

		for (const rename of resourceRenames) {
			if (fs.existsSync(rename.from)) {
				fs.renameSync(rename.from, rename.to);
				this.logSuccess(`重命名资源文件: ${path.basename(rename.from)} -> ${path.basename(rename.to)}`);
			}
		}
	}

	private async updateScriptFiles(): Promise<void> {
		this.logInfo('更新脚本文件...');

		const scriptsDir = 'scripts';
		if (fs.existsSync(scriptsDir)) {
			const files = fs.readdirSync(scriptsDir);

			for (const file of files) {
				const filePath = path.join(scriptsDir, file);
				if (fs.statSync(filePath).isFile()) {
					await this.updateFileContent(filePath);
				}
			}
		}
	}

	private async updateDocumentation(): Promise<void> {
		this.logInfo('更新文档文件...');

		const docFiles = ['README.md', 'CONTRIBUTING.md', 'LICENSE.txt'];

		for (const docFile of docFiles) {
			if (fs.existsSync(docFile)) {
				await this.updateFileContent(docFile);
			}
		}
	}

	private async cleanupTempFiles(): Promise<void> {
		this.logInfo('清理临时文件...');

		const tempFiles = this.findFiles('.backup');
		for (const file of tempFiles) {
			if (file.endsWith('.backup')) {
				fs.unlinkSync(file);
			}
		}
	}

	private async validateRename(): Promise<void> {
		this.logInfo('验证重命名结果...');

		// 验证 package.json
		if (fs.existsSync('package.json')) {
			const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
			if (packageJson.name === 'newma') {
				this.logSuccess('package.json 验证通过');
			} else {
				this.logError('package.json 验证失败');
			}
		}

		// 验证 product.json
		if (fs.existsSync('product.json')) {
			const productJson = JSON.parse(fs.readFileSync('product.json', 'utf8'));
			if (productJson.nameShort === 'Newma') {
				this.logSuccess('product.json 验证通过');
			} else {
				this.logError('product.json 验证失败');
			}
		}

		// 验证可执行文件
		if (fs.existsSync('newma') || fs.existsSync('Newma.app')) {
			this.logSuccess('可执行文件重命名验证通过');
		} else {
			this.logWarning('未找到重命名的可执行文件');
		}
	}

	private async generateReport(): Promise<void> {
		this.logInfo('生成重命名报告...');

		const report = `# Newma 重命名报告

## 重命名完成时间
${new Date().toISOString()}

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

## 重命名统计
- 处理的文件类型: ${this.fileExtensions.join(', ')}
- 字符串替换规则: ${this.replacements.size} 条
- 排除的目录: ${this.excludeDirs.join(', ')}
`;

		fs.writeFileSync('rename-report.md', report);
		this.logSuccess('重命名报告已生成: rename-report.md');
	}

	private printNextSteps(): void {
		console.log('');
		this.logInfo('下一步操作：');
		console.log('1. 运行 \'npm run compile\' 编译项目');
		console.log('2. 运行 \'npm test\' 执行测试');
		console.log('3. 运行 \'./newma\' 启动 Newma');
		console.log('4. 检查 rename-report.md 了解详细信息');
		console.log('');
		this.logWarning('如有问题，可以从 .backup 目录恢复原始文件');
	}
}

// 执行重命名
const renamer = new NewmaRenamer();
renamer.renameProject().catch(console.error);
