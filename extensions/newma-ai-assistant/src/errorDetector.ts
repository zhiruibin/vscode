import * as vscode from 'vscode';

export interface ErrorInfo {
	message: string;
	line: number;
	column: number;
	severity: 'error' | 'warning' | 'info';
	code?: string;
	source: string;
}

export interface FixSuggestion {
	title: string;
	description: string;
	code: string;
	action: 'replace' | 'insert' | 'delete';
	range?: vscode.Range;
}

export class ErrorDetector {
	private diagnostics: vscode.DiagnosticCollection;

	constructor() {
		this.diagnostics = vscode.languages.createDiagnosticCollection('newma-ai-errors');
	}

	async detectErrors(document: vscode.TextDocument): Promise<ErrorInfo[]> {
		const errors: ErrorInfo[] = [];

		// 获取当前文档的诊断信息
		const existingDiagnostics = vscode.languages.getDiagnostics(document.uri);

		// 转换 VS Code 诊断为我们的错误格式
		for (const diagnostic of existingDiagnostics) {
			errors.push({
				message: diagnostic.message,
				line: diagnostic.range.start.line + 1,
				column: diagnostic.range.start.character + 1,
				severity: this.mapSeverity(diagnostic.severity),
				code: diagnostic.code?.toString(),
				source: diagnostic.source || 'unknown'
			});
		}

		// 检测常见的代码问题
		const commonErrors = this.detectCommonErrors(document);
		errors.push(...commonErrors);

		return errors;
	}

	private mapSeverity(severity: vscode.DiagnosticSeverity): 'error' | 'warning' | 'info' {
		switch (severity) {
			case vscode.DiagnosticSeverity.Error:
				return 'error';
			case vscode.DiagnosticSeverity.Warning:
				return 'warning';
			case vscode.DiagnosticSeverity.Information:
			case vscode.DiagnosticSeverity.Hint:
				return 'info';
			default:
				return 'info';
		}
	}

	private detectCommonErrors(document: vscode.TextDocument): ErrorInfo[] {
		const errors: ErrorInfo[] = [];
		const text = document.getText();
		const lines = text.split('\n');

		// 检测常见问题
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const lineNumber = i + 1;

			// 检测未使用的变量
			if (this.detectUnusedVariable(line)) {
				errors.push({
					message: '可能未使用的变量',
					line: lineNumber,
					column: 1,
					severity: 'warning',
					source: 'newma-ai-detector'
				});
			}

			// 检测潜在的空指针
			if (this.detectPotentialNullPointer(line)) {
				errors.push({
					message: '潜在的空指针访问',
					line: lineNumber,
					column: 1,
					severity: 'warning',
					source: 'newma-ai-detector'
				});
			}

			// 检测性能问题
			if (this.detectPerformanceIssue(line)) {
				errors.push({
					message: '可能的性能问题',
					line: lineNumber,
					column: 1,
					severity: 'info',
					source: 'newma-ai-detector'
				});
			}
		}

		return errors;
	}

	private detectUnusedVariable(line: string): boolean {
		// 简单的未使用变量检测
		const patterns = [
			/^\s*const\s+\w+\s*=\s*[^;]+;\s*$/,  // const var = value;
			/^\s*let\s+\w+\s*=\s*[^;]+;\s*$/,    // let var = value;
			/^\s*var\s+\w+\s*=\s*[^;]+;\s*$/     // var var = value;
		];

		return patterns.some(pattern => pattern.test(line)) &&
			!line.includes('console.log') &&
			!line.includes('return');
	}

	private detectPotentialNullPointer(line: string): boolean {
		// 检测可能的空指针访问
		const patterns = [
			/\w+\.\w+\s*$/,  // obj.prop 在行末
			/\w+\[\w+\]\s*$/, // obj[key] 在行末
			/\w+\(\)\.\w+/,   // func().prop
		];

		return patterns.some(pattern => pattern.test(line)) &&
			!line.includes('?.') &&
			!line.includes('!');
	}

	private detectPerformanceIssue(line: string): boolean {
		// 检测性能问题
		const patterns = [
			/for\s*\(\s*let\s+\w+\s*=\s*0\s*;\s*\w+\s*<\s*array\.length\s*;\s*\w+\+\+\s*\)/, // 缓存 length
			/document\.getElementById/, // DOM 查询
			/innerHTML\s*=/, // innerHTML 赋值
		];

		return patterns.some(pattern => pattern.test(line));
	}

	async generateFixSuggestions(error: ErrorInfo, document: vscode.TextDocument): Promise<FixSuggestion[]> {
		const suggestions: FixSuggestion[] = [];
		const line = document.lineAt(error.line - 1).text;

		switch (error.source) {
			case 'newma-ai-detector':
				if (error.message.includes('未使用的变量')) {
					suggestions.push({
						title: '删除未使用的变量',
						description: '删除这个未使用的变量声明',
						code: '',
						action: 'delete',
						range: new vscode.Range(error.line - 1, 0, error.line - 1, line.length)
					});
					suggestions.push({
						title: '添加使用',
						description: '在变量后添加 console.log 或 return 语句',
						code: line.replace(/;\s*$/, '; console.log(' + this.extractVariableName(line) + ');'),
						action: 'replace',
						range: new vscode.Range(error.line - 1, 0, error.line - 1, line.length)
					});
				}
				break;

			case 'typescript':
			case 'javascript':
				if (error.message.includes('Cannot find name')) {
					suggestions.push({
						title: '添加类型声明',
						description: '为未定义的变量添加类型声明',
						code: this.generateTypeDeclaration(error.message),
						action: 'insert',
						range: new vscode.Range(0, 0, 0, 0)
					});
				}
				break;
		}

		return suggestions;
	}

	private extractVariableName(line: string): string {
		const match = line.match(/(?:const|let|var)\s+(\w+)/);
		return match ? match[1] : 'variable';
	}

	private generateTypeDeclaration(errorMessage: string): string {
		// 从错误消息中提取变量名
		const match = errorMessage.match(/Cannot find name '(\w+)'/);
		if (match) {
			const varName = match[1];
			return `declare const ${varName}: any;\n`;
		}
		return '';
	}

	async applyFix(suggestion: FixSuggestion, document: vscode.TextDocument): Promise<void> {
		const editor = await vscode.window.showTextDocument(document);
		const edit = new vscode.WorkspaceEdit();

		switch (suggestion.action) {
			case 'replace':
				if (suggestion.range) {
					edit.replace(document.uri, suggestion.range, suggestion.code);
				}
				break;
			case 'insert':
				if (suggestion.range) {
					edit.insert(document.uri, suggestion.range.start, suggestion.code);
				}
				break;
			case 'delete':
				if (suggestion.range) {
					edit.delete(document.uri, suggestion.range);
				}
				break;
		}

		await vscode.workspace.applyEdit(edit);
	}

	dispose(): void {
		this.diagnostics.dispose();
	}
}



