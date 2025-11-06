import * as vscode from 'vscode';

export interface CodeGenerationOptions {
	language?: string;
	framework?: string;
	style?: 'functional' | 'object-oriented' | 'procedural';
	includeComments?: boolean;
	includeTests?: boolean;
}

import { SideEffectGate } from './sideEffectGate';

export class CodeGenerator {
	private config: vscode.WorkspaceConfiguration;
	private sideEffectGate?: SideEffectGate;

	constructor(sideEffectGate?: SideEffectGate) {
		this.config = vscode.workspace.getConfiguration('newma-ai-assistant');
		this.sideEffectGate = sideEffectGate;
	}

	/**
	 * Generate code based on user description
	 */
	async generateCode(
		description: string,
		options: CodeGenerationOptions = {}
	): Promise<string> {
		const {
			language = this.detectLanguage(),
			framework,
			style = 'object-oriented',
			includeComments = true,
			includeTests = false
		} = options;

		// Build enhanced prompt for code generation
		const prompt = this.buildCodeGenerationPrompt(description, {
			language,
			framework,
			style,
			includeComments,
			includeTests
		});

		return prompt;
	}

	/**
	 * Generate code refactoring suggestions
	 */
	async generateRefactoringSuggestions(
		code: string,
		language: string
	): Promise<string> {
		const prompt = `You are a code refactoring expert. Analyze the following ${language} code and provide refactoring suggestions:

\`\`\`${language}
${code}
\`\`\`

Please provide:
1. Current issues and code smells
2. Specific refactoring suggestions
3. Improved code examples
4. Performance optimizations
5. Best practices recommendations

Format your response with clear sections and code examples.`;

		return prompt;
	}

	/**
	 * Generate code optimization suggestions
	 */
	async generateOptimizationSuggestions(
		code: string,
		language: string
	): Promise<string> {
		const prompt = `You are a code optimization expert. Analyze the following ${language} code for performance improvements:

\`\`\`${language}
${code}
\`\`\`

Please provide:
1. Performance bottlenecks identified
2. Optimization strategies
3. Optimized code examples
4. Memory usage improvements
5. Algorithm efficiency suggestions

Focus on practical, measurable improvements.`;

		return prompt;
	}

	/**
	 * Generate error fixing suggestions
	 */
	async generateErrorFixes(
		code: string,
		error: string,
		language: string
	): Promise<string> {
		const prompt = `You are a debugging expert. Help fix the following error in ${language} code:

**Error:** ${error}

**Code:**
\`\`\`${language}
${code}
\`\`\`

Please provide:
1. Root cause analysis
2. Step-by-step fix instructions
3. Corrected code
4. Prevention strategies
5. Additional debugging tips

Make the solution clear and actionable.`;

		return prompt;
	}

	/**
	 * Extract code from AI response
	 */
	extractCodeFromResponse(response: string): { code: string; language: string }[] {
		const codeBlocks: { code: string; language: string }[] = [];
		const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;

		let match;
		while ((match = codeBlockRegex.exec(response)) !== null) {
			const language = match[1] || 'text';
			const code = match[2].trim();
			codeBlocks.push({ code, language });
		}

		return codeBlocks;
	}

	/**
	 * Insert code into editor
	 */
	async insertCodeIntoEditor(code: string, language: string): Promise<void> {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor found');
			return;
		}

		const position = editor.selection.active;
		const apply = async () => {
			await editor.edit(editBuilder => {
				editBuilder.insert(position, code);
			});
			vscode.window.showInformationMessage(`Code inserted successfully`);
		};
		if (this.sideEffectGate) {
			await this.sideEffectGate.confirmAndApply({ type: 'insert', targetDescription: editor.document.uri.fsPath, previewContent: code }, apply);
		} else {
			await apply();
		}
	}

	/**
	 * Replace selected code
	 */
	async replaceSelectedCode(code: string): Promise<void> {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor found');
			return;
		}

		const selection = editor.selection;
		const original = editor.document.getText(selection);
		const apply = async () => {
			await editor.edit(editBuilder => {
				editBuilder.replace(selection, code);
			});
			vscode.window.showInformationMessage(`Code replaced successfully`);
		};
		if (this.sideEffectGate) {
			await this.sideEffectGate.confirmAndApply({ type: 'replace', targetDescription: editor.document.uri.fsPath, previewContent: `旧内容:\n${original}\n\n新内容:\n${code}` }, apply);
		} else {
			await apply();
		}
	}

	/**
	 * Create new file with generated code
	 */
	async createFileWithCode(code: string, language: string, filename?: string): Promise<void> {
		const extension = this.getFileExtension(language);
		const defaultFilename = filename || `generated.${extension}`;

		const apply = async () => {
			const uri = vscode.Uri.file(defaultFilename);
			const document = await vscode.workspace.openTextDocument(uri);
			const editor = await vscode.window.showTextDocument(document);
			await editor.edit(editBuilder => {
				editBuilder.insert(new vscode.Position(0, 0), code);
			});
			vscode.window.showInformationMessage(`File created: ${defaultFilename}`);
		};
		if (this.sideEffectGate) {
			await this.sideEffectGate.confirmAndApply({ type: 'create', targetDescription: defaultFilename, previewContent: code }, apply);
		} else {
			await apply();
		}
	}

	private buildCodeGenerationPrompt(
		description: string,
		options: CodeGenerationOptions
	): string {
		const { language, framework, style, includeComments, includeTests } = options;

		let prompt = `You are an expert ${language} developer. Generate high-quality code based on the following description:

**Description:** ${description}

**Requirements:**
- Language: ${language}
- Style: ${style}
- Include comments: ${includeComments ? 'Yes' : 'No'}
- Include tests: ${includeTests ? 'Yes' : 'No'}`;

		if (framework) {
			prompt += `\n- Framework: ${framework}`;
		}

		prompt += `\n\nPlease provide:
1. Clean, well-structured code
2. Clear comments explaining the logic
3. Error handling where appropriate
4. Best practices implementation
5. Usage examples
6. Performance considerations

Format your response with proper code blocks and explanations.`;

		return prompt;
	}

	private detectLanguage(): string {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			return editor.document.languageId;
		}
		return 'javascript';
	}

	private getFileExtension(language: string): string {
		const extensions: { [key: string]: string } = {
			'javascript': 'js',
			'typescript': 'ts',
			'python': 'py',
			'java': 'java',
			'csharp': 'cs',
			'cpp': 'cpp',
			'c': 'c',
			'go': 'go',
			'rust': 'rs',
			'php': 'php',
			'ruby': 'rb',
			'swift': 'swift',
			'kotlin': 'kt',
			'scala': 'scala',
			'html': 'html',
			'css': 'css',
			'scss': 'scss',
			'less': 'less',
			'json': 'json',
			'xml': 'xml',
			'yaml': 'yml',
			'markdown': 'md'
		};

		return extensions[language] || 'txt';
	}
}
