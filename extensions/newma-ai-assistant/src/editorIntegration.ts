import * as vscode from 'vscode';
import * as path from 'path';

export interface EditorContext {
	selectedText?: string;
	filePath?: string;
	language?: string;
	cursorPosition?: vscode.Position;
	projectStructure?: string;
	recentFiles?: string[];
}

export class EditorIntegration {
	private disposables: vscode.Disposable[] = [];
	private lastSelection: vscode.Selection | undefined;
	private projectStructure: string | undefined;

	activate(context: vscode.ExtensionContext): void {
		// Listen to text selection changes
		const selectionListener = vscode.window.onDidChangeTextEditorSelection(
			(event) => {
				this.lastSelection = event.selections[0];
			}
		);

		// Listen to active editor changes
		const editorListener = vscode.window.onDidChangeActiveTextEditor(
			(editor) => {
				if (editor) {
					this.updateProjectStructure();
				}
			}
		);

		// Listen to file changes
		const fileListener = vscode.workspace.onDidChangeTextDocument(
			(event) => {
				// Could be used for real-time context updates
			}
		);

		// Listen to workspace changes
		const workspaceListener = vscode.workspace.onDidChangeWorkspaceFolders(
			() => {
				this.updateProjectStructure();
			}
		);

		this.disposables.push(
			selectionListener,
			editorListener,
			fileListener,
			workspaceListener
		);

		// Initial project structure update
		this.updateProjectStructure();
	}

	async getCurrentContext(): Promise<EditorContext> {
		const editor = vscode.window.activeTextEditor;
		const context: EditorContext = {};

		if (editor) {
			// Get selected text
			if (this.lastSelection && !this.lastSelection.isEmpty) {
				context.selectedText = editor.document.getText(this.lastSelection);
			}

			// Get file information
			context.filePath = editor.document.uri.fsPath;
			context.language = editor.document.languageId;
			context.cursorPosition = editor.selection.active;

			// Get recent files
			context.recentFiles = await this.getRecentFiles();
		}

		// Get project structure
		context.projectStructure = this.projectStructure;

		return context;
	}

	private async updateProjectStructure(): Promise<void> {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			this.projectStructure = undefined;
			return;
		}

		try {
			const structure = await this.buildProjectStructure(workspaceFolders[0].uri.fsPath);
			this.projectStructure = structure;
		} catch (error) {
			console.error('Failed to update project structure:', error);
		}
	}

	private async buildProjectStructure(rootPath: string): Promise<string> {
		const structure: string[] = [];
		const maxDepth = 3;
		const maxFiles = 50;

		await this.buildStructureRecursive(rootPath, '', structure, 0, maxDepth, maxFiles);

		return structure.join('\n');
	}

	private async buildStructureRecursive(
		dirPath: string,
		prefix: string,
		structure: string[],
		depth: number,
		maxDepth: number,
		maxFiles: number
	): Promise<void> {

		if (depth >= maxDepth || structure.length >= maxFiles) {
			return;
		}

		try {
			const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));

			// Sort entries: directories first, then files
			entries.sort((a, b) => {
				if (a[1] === vscode.FileType.Directory && b[1] !== vscode.FileType.Directory) {
					return -1;
				}
				if (a[1] !== vscode.FileType.Directory && b[1] === vscode.FileType.Directory) {
					return 1;
				}
				return a[0].localeCompare(b[0]);
			});

			for (const [name, type] of entries) {
				// Skip hidden files and common ignore patterns
				if (name.startsWith('.') || this.shouldIgnore(name)) {
					continue;
				}

				const fullPath = path.join(dirPath, name);
				const isDirectory = type === vscode.FileType.Directory;

				if (isDirectory) {
					structure.push(`${prefix}📁 ${name}/`);
					await this.buildStructureRecursive(
						fullPath,
						prefix + '  ',
						structure,
						depth + 1,
						maxDepth,
						maxFiles
					);
				} else {
					structure.push(`${prefix}📄 ${name}`);
				}

				if (structure.length >= maxFiles) {
					break;
				}
			}
		} catch (error) {
			// Ignore permission errors
		}
	}

	private shouldIgnore(name: string): boolean {
		const ignorePatterns = [
			'node_modules',
			'.git',
			'.vscode',
			'build',
			'dist',
			'out',
			'target',
			'.next',
			'.nuxt',
			'coverage',
			'.nyc_output',
			'logs',
			'*.log'
		];

		return ignorePatterns.some(pattern => {
			if (pattern.includes('*')) {
				const regex = new RegExp(pattern.replace(/\*/g, '.*'));
				return regex.test(name);
			}
			return name === pattern;
		});
	}

	private async getRecentFiles(): Promise<string[]> {
		const recentFiles: string[] = [];
		const maxRecent = 5;

		// Get recently opened files from workspace
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (workspaceFolders) {
			try {
				const files = await vscode.workspace.findFiles(
					'**/*',
					'**/node_modules/**',
					maxRecent
				);

				recentFiles.push(...files.map(uri => path.relative(workspaceFolders[0].uri.fsPath, uri.fsPath)));
			} catch (error) {
				// Ignore errors
			}
		}

		return recentFiles;
	}

	dispose(): void {
		this.disposables.forEach(d => d.dispose());
	}
}


