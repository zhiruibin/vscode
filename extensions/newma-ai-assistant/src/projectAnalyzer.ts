import * as vscode from 'vscode';
import * as path from 'path';

export interface ProjectStructure {
	rootPath: string;
	fileCount: number;
	directoryCount: number;
	mainFiles: string[];
	configFiles: string[];
	codeFiles: string[];
	summary: string;
}

export class ProjectAnalyzer {
	private readonly MAX_FILES_TO_ANALYZE = 50; // 限制分析的文件数量
	private readonly MAX_DIRECTORY_DEPTH = 3; // 限制目录深度
	private readonly EXCLUDED_DIRS = ['node_modules', '.git', 'dist', 'build', '.vscode', 'coverage'];

	/**
	 * 分析项目结构（按 Cursor 标准：显式触发、限量摘要）
	 */
	async analyzeProjectStructure(workspaceRoot: string): Promise<ProjectStructure> {
		console.log('=== ProjectAnalyzer: Starting project analysis ===');

		const structure: ProjectStructure = {
			rootPath: workspaceRoot,
			fileCount: 0,
			directoryCount: 0,
			mainFiles: [],
			configFiles: [],
			codeFiles: [],
			summary: ''
		};

		try {
			// 获取项目基本信息
			await this.analyzeDirectory(workspaceRoot, structure, 0);

			// 生成项目摘要
			structure.summary = this.generateProjectSummary(structure);

			console.log('=== ProjectAnalyzer: Analysis completed ===');
			console.log(`Files analyzed: ${structure.fileCount}, Directories: ${structure.directoryCount}`);

		} catch (error) {
			console.error('Project analysis error:', error);
			structure.summary = `项目分析遇到错误: ${error instanceof Error ? error.message : 'Unknown error'}`;
		}

		return structure;
	}

	/**
	 * 递归分析目录结构（限制深度和文件数量）
	 */
	private async analyzeDirectory(
		dirPath: string,
		structure: ProjectStructure,
		depth: number
	): Promise<void> {
		// 限制目录深度
		if (depth > this.MAX_DIRECTORY_DEPTH) {
			return;
		}

		// 限制分析的文件数量
		if (structure.fileCount >= this.MAX_FILES_TO_ANALYZE) {
			return;
		}

		try {
			const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));

			for (const [name, type] of entries) {
				// 跳过排除的目录
				if (type === vscode.FileType.Directory && this.EXCLUDED_DIRS.includes(name)) {
					continue;
				}

				const fullPath = path.join(dirPath, name);
				const relativePath = path.relative(structure.rootPath, fullPath);

				if (type === vscode.FileType.Directory) {
					structure.directoryCount++;
					await this.analyzeDirectory(fullPath, structure, depth + 1);
				} else if (type === vscode.FileType.File) {
					structure.fileCount++;
					this.categorizeFile(name, relativePath, structure);
				}
			}
		} catch (error) {
			console.log(`Error reading directory ${dirPath}:`, error);
		}
	}

	/**
	 * 分类文件
	 */
	private categorizeFile(fileName: string, relativePath: string, structure: ProjectStructure): void {
		const ext = path.extname(fileName).toLowerCase();

		// 配置文件
		if (this.isConfigFile(fileName, ext)) {
			structure.configFiles.push(relativePath);
		}
		// 代码文件
		else if (this.isCodeFile(ext)) {
			structure.codeFiles.push(relativePath);
		}
		// 主要文件
		if (this.isMainFile(fileName)) {
			structure.mainFiles.push(relativePath);
		}
	}

	/**
	 * 判断是否为配置文件
	 */
	private isConfigFile(fileName: string, ext: string): boolean {
		const configNames = [
			'package.json', 'tsconfig.json', 'webpack.config.js', 'vite.config.js',
			'.gitignore', '.eslintrc', '.prettierrc', 'dockerfile', 'docker-compose.yml',
			'requirements.txt', 'pom.xml', 'build.gradle', 'cargo.toml'
		];

		return configNames.includes(fileName.toLowerCase()) ||
			ext === '.json' || ext === '.yaml' || ext === '.yml' || ext === '.toml';
	}

	/**
	 * 判断是否为代码文件
	 */
	private isCodeFile(ext: string): boolean {
		const codeExtensions = [
			'.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h',
			'.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala',
			'.html', '.css', '.scss', '.sass', '.less', '.vue', '.svelte'
		];

		return codeExtensions.includes(ext);
	}

	/**
	 * 判断是否为主要文件
	 */
	private isMainFile(fileName: string): boolean {
		const mainNames = [
			'main.js', 'main.ts', 'index.js', 'index.ts', 'app.js', 'app.ts',
			'main.py', 'app.py', 'main.java', 'main.cpp', 'main.c',
			'index.html', 'app.html', 'main.go', 'main.rs'
		];

		return mainNames.includes(fileName.toLowerCase());
	}

	/**
	 * 生成项目摘要
	 */
	private generateProjectSummary(structure: ProjectStructure): string {
		const { fileCount, directoryCount, mainFiles, configFiles, codeFiles } = structure;

		let summary = `项目根目录: ${path.basename(structure.rootPath)}\n`;
		summary += `文件总数: ${fileCount} (限制分析前 ${this.MAX_FILES_TO_ANALYZE} 个)\n`;
		summary += `目录总数: ${directoryCount}\n`;

		if (mainFiles.length > 0) {
			summary += `\n主要文件:\n${mainFiles.slice(0, 5).map(f => `  - ${f}`).join('\n')}`;
			if (mainFiles.length > 5) {
				summary += `\n  ... 还有 ${mainFiles.length - 5} 个文件`;
			}
		}

		if (configFiles.length > 0) {
			summary += `\n\n配置文件:\n${configFiles.slice(0, 5).map(f => `  - ${f}`).join('\n')}`;
			if (configFiles.length > 5) {
				summary += `\n  ... 还有 ${configFiles.length - 5} 个文件`;
			}
		}

		// 分析项目类型
		const projectType = this.detectProjectType(configFiles, codeFiles);
		summary += `\n\n项目类型: ${projectType}`;

		return summary;
	}

	/**
	 * 检测项目类型
	 */
	private detectProjectType(configFiles: string[], codeFiles: string[]): string {
		const configSet = new Set(configFiles.map(f => path.basename(f).toLowerCase()));
		const codeExts = new Set(codeFiles.map(f => path.extname(f).toLowerCase()));

		if (configSet.has('package.json')) {
			if (codeExts.has('.tsx') || codeExts.has('.jsx')) {
				return 'React/TypeScript 项目';
			} else if (codeExts.has('.vue')) {
				return 'Vue.js 项目';
			} else if (codeExts.has('.svelte')) {
				return 'Svelte 项目';
			} else {
				return 'Node.js/JavaScript 项目';
			}
		} else if (configSet.has('pom.xml')) {
			return 'Java Maven 项目';
		} else if (configSet.has('build.gradle')) {
			return 'Java Gradle 项目';
		} else if (configSet.has('cargo.toml')) {
			return 'Rust 项目';
		} else if (configSet.has('requirements.txt')) {
			return 'Python 项目';
		} else if (codeExts.has('.py')) {
			return 'Python 项目';
		} else if (codeExts.has('.java')) {
			return 'Java 项目';
		} else if (codeExts.has('.cpp') || codeExts.has('.c')) {
			return 'C/C++ 项目';
		} else if (codeExts.has('.go')) {
			return 'Go 项目';
		} else {
			return '未知类型项目';
		}
	}

	/**
	 * 获取上下文预览（按 Cursor 标准）
	 */
	getContextPreview(structure: ProjectStructure): string {
		return `项目结构摘要 (${structure.fileCount} 个文件, ${structure.directoryCount} 个目录):\n${structure.summary}`;
	}

	/**
	 * 检查是否需要用户同意（按 Cursor 标准）
	 */
	shouldRequestConsent(structure: ProjectStructure): boolean {
		// 如果文件数量超过阈值，需要用户同意
		return structure.fileCount > 20;
	}
}



