import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SideEffectGate } from './sideEffectGate';
import { OperationLogger } from './operationLogger';

export interface FileOperationOptions {
	createDirectories?: boolean;
	overwrite?: boolean;
	backup?: boolean;
}

export class FileOperations {
	private config: vscode.WorkspaceConfiguration;
	private sideEffectGate?: SideEffectGate;
	private operationLogger?: OperationLogger;

	constructor(sideEffectGate?: SideEffectGate, operationLogger?: OperationLogger) {
		this.config = vscode.workspace.getConfiguration('newma-ai-assistant');
		this.sideEffectGate = sideEffectGate;
		this.operationLogger = operationLogger;
	}

	/**
	 * Read file content
	 */
	async readFile(filePath: string): Promise<string> {
		try {
			const uri = vscode.Uri.file(filePath);
			const document = await vscode.workspace.openTextDocument(uri);
			return document.getText();
		} catch (error) {
			throw new Error(`Failed to read file ${filePath}: ${error}`);
		}
	}

	/**
	 * Write content to file
	 */
	async writeFile(filePath: string, content: string, options: FileOperationOptions = {}): Promise<void> {
		try {
			const { createDirectories = true, overwrite = true, backup = false } = options;

			// Create directories if needed
			if (createDirectories) {
				const dir = path.dirname(filePath);
				if (!fs.existsSync(dir)) {
					fs.mkdirSync(dir, { recursive: true });
				}
			}

			// Backup existing file if requested
			if (backup && fs.existsSync(filePath)) {
				const backupPath = `${filePath}.backup.${Date.now()}`;
				fs.copyFileSync(filePath, backupPath);
				vscode.window.showInformationMessage(`Backup created: ${backupPath}`);
			}

			// Check if file exists and overwrite is not allowed
			if (!overwrite && fs.existsSync(filePath)) {
				throw new Error(`File ${filePath} already exists and overwrite is disabled`);
			}

			// Write file
			const uri = vscode.Uri.file(filePath);
			await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));

			vscode.window.showInformationMessage(`File written: ${filePath}`);
		} catch (error) {
			throw new Error(`Failed to write file ${filePath}: ${error}`);
		}
	}

	/**
	 * Create new file
	 */
	async createFile(filePath: string, content: string = '', options: FileOperationOptions = {}): Promise<void> {
		await this.writeFile(filePath, content, { ...options, overwrite: false });
	}

	/**
	 * Append content to file
	 */
	async appendToFile(filePath: string, content: string): Promise<void> {
		try {
			const existingContent = fs.existsSync(filePath) ? await this.readFile(filePath) : '';
			const newContent = existingContent + content;
			await this.writeFile(filePath, newContent, { overwrite: true });
		} catch (error) {
			throw new Error(`Failed to append to file ${filePath}: ${error}`);
		}
	}

	/**
	 * Delete file
	 */
	async deleteFile(filePath: string, backup: boolean = false): Promise<void> {
		try {
			if (!fs.existsSync(filePath)) {
				throw new Error(`File ${filePath} does not exist`);
			}

			// Create backup if requested
			const backupPath = `${filePath}.deleted.${Date.now()}`;
			fs.copyFileSync(filePath, backupPath);
			if (backup) {
				vscode.window.showInformationMessage(`Backup created: ${backupPath}`);
			}

			const apply = async () => {
				fs.unlinkSync(filePath);
				vscode.window.showInformationMessage(`File deleted: ${filePath}`);
				if (this.operationLogger) {
					this.operationLogger.record({
						description: `delete ${filePath}`,
						undo: async () => {
							fs.copyFileSync(backupPath, filePath);
						}
					});
				}
			};
			if (this.sideEffectGate) {
				await this.sideEffectGate.confirmAndApply({ type: 'delete', targetDescription: filePath }, apply);
			} else {
				await apply();
			}
		} catch (error) {
			throw new Error(`Failed to delete file ${filePath}: ${error}`);
		}
	}

	/**
	 * Copy file
	 */
	async copyFile(sourcePath: string, destinationPath: string, options: FileOperationOptions = {}): Promise<void> {
		try {
			const { createDirectories = true, overwrite = true } = options;

			// Create destination directories if needed
			if (createDirectories) {
				const dir = path.dirname(destinationPath);
				if (!fs.existsSync(dir)) {
					fs.mkdirSync(dir, { recursive: true });
				}
			}

			// Check if destination exists and overwrite is not allowed
			if (!overwrite && fs.existsSync(destinationPath)) {
				throw new Error(`File ${destinationPath} already exists and overwrite is disabled`);
			}

			fs.copyFileSync(sourcePath, destinationPath);
			vscode.window.showInformationMessage(`File copied: ${sourcePath} -> ${destinationPath}`);
		} catch (error) {
			throw new Error(`Failed to copy file ${sourcePath} to ${destinationPath}: ${error}`);
		}
	}

	/**
	 * Move/rename file
	 */
	async moveFile(sourcePath: string, destinationPath: string, options: FileOperationOptions = {}): Promise<void> {
		try {
			const { createDirectories = true, overwrite = true } = options;

			// Create destination directories if needed
			if (createDirectories) {
				const dir = path.dirname(destinationPath);
				if (!fs.existsSync(dir)) {
					fs.mkdirSync(dir, { recursive: true });
				}
			}

			// Check if destination exists and overwrite is not allowed
			if (!overwrite && fs.existsSync(destinationPath)) {
				throw new Error(`File ${destinationPath} already exists and overwrite is disabled`);
			}

			const apply = async () => {
				fs.renameSync(sourcePath, destinationPath);
				vscode.window.showInformationMessage(`File moved: ${sourcePath} -> ${destinationPath}`);
				if (this.operationLogger) {
					this.operationLogger.record({
						description: `move ${sourcePath} -> ${destinationPath}`,
						undo: async () => {
							if (fs.existsSync(destinationPath)) {
								fs.renameSync(destinationPath, sourcePath);
							}
						}
					});
				}
			};
			if (this.sideEffectGate) {
				await this.sideEffectGate.confirmAndApply({ type: 'move', targetDescription: `${sourcePath} -> ${destinationPath}` }, apply);
			} else {
				await apply();
			}
		} catch (error) {
			throw new Error(`Failed to move file ${sourcePath} to ${destinationPath}: ${error}`);
		}
	}

	/**
	 * List files in directory
	 */
	async listFiles(directoryPath: string, pattern?: string): Promise<string[]> {
		try {
			const files = fs.readdirSync(directoryPath);

			if (pattern) {
				const regex = new RegExp(pattern);
				return files.filter(file => regex.test(file));
			}

			return files;
		} catch (error) {
			throw new Error(`Failed to list files in ${directoryPath}: ${error}`);
		}
	}

	/**
	 * Get file information
	 */
	async getFileInfo(filePath: string): Promise<{
		exists: boolean;
		size: number;
		created: Date;
		modified: Date;
		isDirectory: boolean;
		isFile: boolean;
	}> {
		try {
			const stats = fs.statSync(filePath);
			return {
				exists: true,
				size: stats.size,
				created: stats.birthtime,
				modified: stats.mtime,
				isDirectory: stats.isDirectory(),
				isFile: stats.isFile()
			};
		} catch (error) {
			return {
				exists: false,
				size: 0,
				created: new Date(),
				modified: new Date(),
				isDirectory: false,
				isFile: false
			};
		}
	}

	/**
	 * Create directory
	 */
	async createDirectory(directoryPath: string, recursive: boolean = true): Promise<void> {
		try {
			if (!fs.existsSync(directoryPath)) {
				fs.mkdirSync(directoryPath, { recursive });
				vscode.window.showInformationMessage(`Directory created: ${directoryPath}`);
			} else {
				vscode.window.showWarningMessage(`Directory already exists: ${directoryPath}`);
			}
		} catch (error) {
			throw new Error(`Failed to create directory ${directoryPath}: ${error}`);
		}
	}

	/**
	 * Delete directory
	 */
	async deleteDirectory(directoryPath: string, recursive: boolean = false): Promise<void> {
		try {
			if (!fs.existsSync(directoryPath)) {
				throw new Error(`Directory ${directoryPath} does not exist`);
			}

			fs.rmSync(directoryPath, { recursive, force: true });
			vscode.window.showInformationMessage(`Directory deleted: ${directoryPath}`);
		} catch (error) {
			throw new Error(`Failed to delete directory ${directoryPath}: ${error}`);
		}
	}

	/**
	 * Search files by content
	 */
	async searchInFiles(directoryPath: string, searchTerm: string, filePattern?: string): Promise<Array<{
		file: string;
		line: number;
		content: string;
	}>> {
		try {
			const results: Array<{ file: string; line: number; content: string }> = [];
			const files = await this.listFiles(directoryPath, filePattern);

			for (const file of files) {
				const filePath = path.join(directoryPath, file);
				const fileInfo = await this.getFileInfo(filePath);

				if (fileInfo.isFile) {
					try {
						const content = await this.readFile(filePath);
						const lines = content.split('\n');

						lines.forEach((line, index) => {
							if (line.includes(searchTerm)) {
								results.push({
									file: filePath,
									line: index + 1,
									content: line.trim()
								});
							}
						});
					} catch (error) {
						// Skip files that can't be read
						continue;
					}
				}
			}

			return results;
		} catch (error) {
			throw new Error(`Failed to search in files: ${error}`);
		}
	}

	/**
	 * Get workspace root path
	 */
	getWorkspaceRoot(): string | undefined {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		return workspaceFolders ? workspaceFolders[0].uri.fsPath : undefined;
	}

	/**
	 * Get relative path from workspace root
	 */
	getRelativePath(filePath: string): string {
		const workspaceRoot = this.getWorkspaceRoot();
		if (workspaceRoot) {
			return path.relative(workspaceRoot, filePath);
		}
		return filePath;
	}

	/**
	 * Get absolute path from relative path
	 */
	getAbsolutePath(relativePath: string): string {
		const workspaceRoot = this.getWorkspaceRoot();
		if (workspaceRoot) {
			return path.resolve(workspaceRoot, relativePath);
		}
		return relativePath;
	}
}
