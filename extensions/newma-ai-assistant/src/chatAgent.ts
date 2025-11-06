/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { AIService } from './aiService';
import { EditorIntegration } from './editorIntegration';
import { CodeGenerator } from './codeGenerator';
import { FileOperations } from './fileOperations';
import { CodeExplainer } from './codeExplainer';
import { ProjectAnalyzer } from './projectAnalyzer';
import { ErrorDetector } from './errorDetector';

export class NewmaChatAgent {
	readonly id = 'newma-ai';
	readonly name = 'Newma AI Assistant';
	readonly publisherName = 'Newma';

	constructor(
		private aiService: AIService,
		private editorIntegration: EditorIntegration,
		private codeGenerator: CodeGenerator,
		private fileOperations: FileOperations,
		private codeExplainer: CodeExplainer,
		private projectAnalyzer: ProjectAnalyzer,
		private errorDetector: ErrorDetector
	) { }

	async handleRequest(
		request: vscode.ChatRequest,
		context: vscode.ChatContext,
		response: vscode.ChatResponseStream,
		token: vscode.CancellationToken
	): Promise<vscode.ChatResult> {

		try {
			console.log('=== NewmaChatAgent.handleRequest called ===');
			console.log('Prompt:', request.prompt);

			// Read interaction mode and hint UI
			const cfg = vscode.workspace.getConfiguration('newma-ai-assistant');
			const mode = cfg.get<'agent' | 'ask' | 'plan'>('interactionMode', 'agent');
			response.markdown(`当前模式：**${mode}**  `);
			response.button({ command: 'newma-ai.selectMode', arguments: [], title: '切换模式' });

			// Analyze the request to determine the type
			const requestType = this.analyzeRequestType(request.prompt);
			console.log('Request type:', requestType);

			let result: vscode.ChatResult;

			switch (requestType) {
				case 'regular':
					if (request.command === 'mode') {
						await vscode.commands.executeCommand('newma-ai.selectMode');
						response.markdown('已打开模式选择。');
						return { metadata: { command: 'newma-ai-mode', agentName: 'Newma AI Assistant' } };
					}
				case 'code-generation':
					result = await this.handleCodeGeneration(request, context, response, token);
					break;
				case 'file-operation':
					result = await this.handleFileOperation(request, context, response, token);
					break;
				case 'code-explanation':
					result = await this.handleCodeExplanation(request, context, response, token);
					break;
				case 'error-detection':
					result = await this.handleErrorDetection(request, context, response, token);
					break;
				case 'project-analysis':
					result = await this.handleProjectAnalysis(request, context, response, token);
					break;
				default:
					result = await this.handleRegularChat(request, context, response, token);
					break;
			}

			console.log('=== Chat request completed successfully ===');
			console.log('Result metadata:', result.metadata);
			return result;

		} catch (error) {
			console.error('Error in handleRequest:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			response.markdown(`**Error:** ${errorMessage}`);
			console.log('Chat request completed with error');

			// Return error result
			return {
				metadata: {
					command: 'newma-ai-error',
					agentName: 'Newma AI Assistant'
				},
				errorDetails: {
					message: errorMessage,
					responseIsFiltered: false
				}
			};
		}
	}

	private analyzeRequestType(prompt: string): 'code-generation' | 'file-operation' | 'code-explanation' | 'project-analysis' | 'error-detection' | 'regular' {
		const codeKeywords = [
			'生成代码', '写代码', '创建函数', '实现', '编写',
			'generate code', 'write code', 'create function', 'implement', 'write',
			'代码', '函数', '类', '方法', '算法',
			'code', 'function', 'class', 'method', 'algorithm',
			'重构', '优化', '修复', '调试',
			'refactor', 'optimize', 'fix', 'debug'
		];

		const fileKeywords = [
			'创建文件', '删除文件', '读取文件', '写入文件', '复制文件', '移动文件',
			'create file', 'delete file', 'read file', 'write file', 'copy file', 'move file',
			'文件', '目录', '文件夹',
			'file', 'directory', 'folder', 'path'
		];

		const explanationKeywords = [
			'解释代码', '代码说明', '注释', '文档', '说明',
			'explain code', 'code explanation', 'comment', 'documentation', 'explain',
			'代码分析', '代码审查', '代码质量',
			'code analysis', 'code review', 'code quality'
		];

		const errorKeywords = [
			'错误', 'bug', '问题', '修复', '调试', '诊断',
			'error', 'fix', 'debug', 'diagnose', 'issue', 'problem',
			'报错', '异常', '警告', 'warning', 'exception'
		];

		const projectKeywords = [
			'项目结构', '项目分析', '工程结构', '代码结构', '项目概览', '分析项目', '分析工程',
			'当前项目', '当前工程', '打开的项目', '打开的工程', '工程结构分析', '项目结构分析',
			'project structure', 'project analysis', 'codebase analysis', 'project overview',
			'项目文件', '工程文件', '代码组织', '项目布局', '文件夹结构', '目录结构',
			'project files', 'codebase structure', 'project layout', 'folder structure',
			'analyze project', 'analyze codebase', 'project overview'
		];

		const lowerPrompt = prompt.toLowerCase();
		console.log('=== Analyzing request type ===');
		console.log('Prompt:', prompt);
		console.log('Lowercase prompt:', lowerPrompt);

		if (codeKeywords.some(keyword => lowerPrompt.includes(keyword.toLowerCase()))) {
			console.log('Matched code generation keywords');
			return 'code-generation';
		}

		if (fileKeywords.some(keyword => lowerPrompt.includes(keyword.toLowerCase()))) {
			console.log('Matched file operation keywords');
			return 'file-operation';
		}

		if (explanationKeywords.some(keyword => lowerPrompt.includes(keyword.toLowerCase()))) {
			console.log('Matched code explanation keywords');
			return 'code-explanation';
		}

		if (errorKeywords.some(keyword => lowerPrompt.includes(keyword.toLowerCase()))) {
			console.log('Matched error detection keywords');
			return 'error-detection';
		}

		if (projectKeywords.some(keyword => lowerPrompt.includes(keyword.toLowerCase()))) {
			console.log('Matched project analysis keywords');
			return 'project-analysis';
		}

		console.log('No specific keywords matched, using regular chat');
		return 'regular';
	}

	private async handleCodeGeneration(
		request: vscode.ChatRequest,
		context: vscode.ChatContext,
		response: vscode.ChatResponseStream,
		token: vscode.CancellationToken
	): Promise<vscode.ChatResult> {
		// Collect context from editor
		const editorContext = await this.editorIntegration.getCurrentContext();

		// Build enhanced prompt for code generation
		const enhancedPrompt = this.buildCodeGenerationPrompt(request.prompt, editorContext);

		// Generate AI response with code focus
		const aiResponse = await this.aiService.generateResponse(
			enhancedPrompt,
			{
				onProgress: (chunk: string) => {
					response.markdown(chunk);
				},
				token
			}
		);

		// Quick refine buttons
		response.button({ command: 'newma-ai.refine', arguments: ['retry', request.prompt], title: '🔁 重试' });
		response.button({ command: 'newma-ai.refine', arguments: ['shorter', request.prompt], title: '✂️ 更短' });
		response.button({ command: 'newma-ai.refine', arguments: ['detailed', request.prompt], title: '🔎 更详细' });
		response.button({ command: 'newma-ai.refine', arguments: ['optimize', request.prompt], title: '⚙️ 优化' });

		// Quick refine buttons
		response.button({ command: 'newma-ai.refine', arguments: ['retry', request.prompt], title: '🔁 重试' });
		response.button({ command: 'newma-ai.refine', arguments: ['shorter', request.prompt], title: '✂️ 更短' });
		response.button({ command: 'newma-ai.refine', arguments: ['detailed', request.prompt], title: '🔎 更详细' });
		response.button({ command: 'newma-ai.refine', arguments: ['optimize', request.prompt], title: '⚙️ 优化' });

		// Extract code blocks from response
		const codeBlocks = this.codeGenerator.extractCodeFromResponse(aiResponse);

		// Add action buttons for each code block
		codeBlocks.forEach((block, index) => {
			response.button({
				command: 'newma-ai.copyCode',
				arguments: [block.code],
				title: `Copy ${block.language} Code`
			});

			response.button({
				command: 'newma-ai.insertCode',
				arguments: [block.code],
				title: `Insert ${block.language} Code`
			});

			response.button({
				command: 'newma-ai.createFile',
				arguments: [block.code, block.language],
				title: `Create ${block.language} File`
			});
		});

		return {
			metadata: {
				command: 'newma-ai-code-generation',
				agentName: 'Newma AI Assistant',
				codeGenerated: true,
				codeBlocksCount: codeBlocks.length
			}
		};
	}

	private async handleFileOperation(
		request: vscode.ChatRequest,
		context: vscode.ChatContext,
		response: vscode.ChatResponseStream,
		token: vscode.CancellationToken
	): Promise<vscode.ChatResult> {
		// Collect context from editor
		const editorContext = await this.editorIntegration.getCurrentContext();

		// Build enhanced prompt for file operations
		const enhancedPrompt = this.buildFileOperationPrompt(request.prompt, editorContext);

		// Generate AI response with file operation focus
		const aiResponse = await this.aiService.generateResponse(
			enhancedPrompt,
			{
				onProgress: (chunk: string) => {
					response.markdown(chunk);
				},
				token
			}
		);

		// Add file operation buttons
		response.button({
			command: 'newma-ai.createFile',
			arguments: [request.prompt],
			title: 'Create File'
		});

		response.button({
			command: 'newma-ai.listFiles',
			arguments: [],
			title: 'List Files'
		});

		response.button({
			command: 'newma-ai.searchFiles',
			arguments: [request.prompt],
			title: 'Search Files'
		});

		return {
			metadata: {
				command: 'newma-ai-file-operation',
				agentName: 'Newma AI Assistant',
				fileOperation: true
			}
		};
	}

	private async handleCodeExplanation(
		request: vscode.ChatRequest,
		context: vscode.ChatContext,
		response: vscode.ChatResponseStream,
		token: vscode.CancellationToken
	): Promise<vscode.ChatResult> {
		// Collect context from editor
		const editorContext = await this.editorIntegration.getCurrentContext();

		// Build enhanced prompt for code explanation
		const enhancedPrompt = this.buildCodeExplanationPrompt(request.prompt, editorContext);

		// Generate AI response with code explanation focus
		const aiResponse = await this.aiService.generateResponse(
			enhancedPrompt,
			{
				onProgress: (chunk: string) => {
					response.markdown(chunk);
				},
				token
			}
		);

		// Add code explanation buttons
		response.button({
			command: 'newma-ai.generateComments',
			arguments: [editorContext.selectedText || ''],
			title: 'Generate Comments'
		});

		response.button({
			command: 'newma-ai.generateDocumentation',
			arguments: [editorContext.selectedText || ''],
			title: 'Generate Documentation'
		});

		response.button({
			command: 'newma-ai.codeReview',
			arguments: [editorContext.selectedText || ''],
			title: 'Code Review'
		});

		return {
			metadata: {
				command: 'newma-ai-code-explanation',
				agentName: 'Newma AI Assistant',
				codeExplanation: true
			}
		};
	}

	private async handleErrorDetection(
		request: vscode.ChatRequest,
		context: vscode.ChatContext,
		response: vscode.ChatResponseStream,
		token: vscode.CancellationToken
	): Promise<vscode.ChatResult> {
		// 获取当前编辑器
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			response.markdown('❌ 没有打开的编辑器，无法进行错误检测。');
			return {
				metadata: {
					command: 'newma-ai-error-detection',
					agentName: 'Newma AI Assistant',
					errorDetection: false,
					error: 'No active editor'
				}
			};
		}

		response.markdown('🔍 **正在检测代码错误...**\n\n');

		try {
			// 检测错误
			const errors = await this.errorDetector.detectErrors(editor.document);

			if (errors.length === 0) {
				response.markdown('✅ **未发现明显的代码错误！**\n\n代码看起来是健康的。');
				return {
					metadata: {
						command: 'newma-ai-error-detection',
						agentName: 'Newma AI Assistant',
						errorDetection: true,
						errorCount: 0
					}
				};
			}

			// 显示错误信息
			response.markdown(`❌ **发现 ${errors.length} 个问题：**\n\n`);

			for (const error of errors) {
				const severityIcon = error.severity === 'error' ? '🔴' :
					error.severity === 'warning' ? '🟡' : '🔵';

				response.markdown(`${severityIcon} **${error.message}** (第 ${error.line} 行)\n`);
				response.markdown(`   来源: ${error.source}\n\n`);

				// 为每个错误生成修复建议
				const suggestions = await this.errorDetector.generateFixSuggestions(error, editor.document);

				if (suggestions.length > 0) {
					response.markdown('**修复建议：**\n');

					for (let i = 0; i < suggestions.length; i++) {
						const suggestion = suggestions[i];
						response.button({
							command: 'newma-ai.applyFix',
							arguments: [suggestion, editor.document.uri],
							title: `🔧 ${suggestion.title}`
						});
						response.markdown(`- ${suggestion.description}\n`);
					}
					response.markdown('\n');
				}
			}

			// 添加通用操作按钮
			response.button({
				command: 'newma-ai.refine',
				arguments: ['retry', request.prompt],
				title: '🔁 重新检测'
			});
			response.button({
				command: 'newma-ai.refine',
				arguments: ['detailed', request.prompt],
				title: '🔎 详细分析'
			});

			return {
				metadata: {
					command: 'newma-ai-error-detection',
					agentName: 'Newma AI Assistant',
					errorDetection: true,
					errorCount: errors.length
				}
			};

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			response.markdown(`❌ **错误检测失败:** ${errorMessage}`);

			return {
				metadata: {
					command: 'newma-ai-error-detection',
					agentName: 'Newma AI Assistant',
					errorDetection: false,
					error: errorMessage
				}
			};
		}
	}

	private async handleProjectAnalysis(
		request: vscode.ChatRequest,
		context: vscode.ChatContext,
		response: vscode.ChatResponseStream,
		token: vscode.CancellationToken
	): Promise<vscode.ChatResult> {
		// 按 Cursor 标准：显式触发项目分析
		response.markdown('🔍 **正在分析项目结构...**\n\n');

		const workspaceRoot = this.fileOperations.getWorkspaceRoot();
		if (!workspaceRoot) {
			response.markdown('❌ 未找到工作区根目录，无法进行项目分析。');
			return {
				metadata: {
					command: 'newma-ai-project-analysis',
					agentName: 'Newma AI Assistant',
					projectAnalysis: false,
					error: 'No workspace found'
				}
			};
		}

		try {
			// 执行项目分析（限量摘要）
			const projectStructure = await this.projectAnalyzer.analyzeProjectStructure(workspaceRoot);

			// 按 Cursor 标准：显示上下文预览
			const contextPreview = this.projectAnalyzer.getContextPreview(projectStructure);
			response.markdown('📋 **项目结构预览:**\n');
			response.markdown('```\n' + contextPreview + '\n```\n');

			// 检查是否需要用户同意（按 Cursor 标准）
			if (this.projectAnalyzer.shouldRequestConsent(projectStructure)) {
				response.markdown('⚠️ **注意:** 项目包含大量文件，分析结果已限制为前 50 个文件。\n\n');
			}

			// 构建增强的提示
			const enhancedPrompt = this.buildProjectAnalysisPrompt(request.prompt, projectStructure);

			// 生成 AI 响应
			const aiResponse = await this.aiService.generateResponse(
				enhancedPrompt,
				{
					onProgress: (chunk: string) => {
						response.markdown(chunk);
					},
					token
				}
			);

			// 添加项目分析操作按钮
			response.button({
				command: 'newma-ai.listFiles',
				arguments: [],
				title: '📁 列出所有文件'
			});

			response.button({
				command: 'newma-ai.searchFiles',
				arguments: [request.prompt],
				title: '🔍 搜索文件'
			});

			return {
				metadata: {
					command: 'newma-ai-project-analysis',
					agentName: 'Newma AI Assistant',
					projectAnalysis: true,
					fileCount: projectStructure.fileCount,
					directoryCount: projectStructure.directoryCount
				}
			};

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			response.markdown(`❌ **项目分析失败:** ${errorMessage}`);

			return {
				metadata: {
					command: 'newma-ai-project-analysis',
					agentName: 'Newma AI Assistant',
					projectAnalysis: false,
					error: errorMessage
				}
			};
		}
	}

	private async handleRegularChat(
		request: vscode.ChatRequest,
		context: vscode.ChatContext,
		response: vscode.ChatResponseStream,
		token: vscode.CancellationToken
	): Promise<vscode.ChatResult> {
		// Collect context from editor
		const editorContext = await this.editorIntegration.getCurrentContext();

		// Build the prompt with context
		const prompt = this.buildPrompt(request.prompt, editorContext);

		// Generate AI response
		const aiResponse = await this.aiService.generateResponse(
			prompt,
			{
				onProgress: (chunk: string) => {
					response.markdown(chunk);
				},
				token
			}
		);

		return {
			metadata: {
				command: 'newma-ai-response',
				agentName: 'Newma AI Assistant'
			}
		};
	}

	private buildCodeGenerationPrompt(userPrompt: string, editorContext: any): string {
		let prompt = `You are Newma AI Assistant, a specialized coding assistant integrated into VS Code. The user is requesting code generation or editing.

User Request: ${userPrompt}

`;

		if (editorContext.selectedText) {
			prompt += `Selected Code:
\`\`\`${editorContext.language || ''}
${editorContext.selectedText}
\`\`\`

`;
		}

		if (editorContext.filePath) {
			prompt += `Current File: ${editorContext.filePath}

`;
		}

		if (editorContext.projectStructure) {
			prompt += `Project Structure:
${editorContext.projectStructure}

`;
		}

		prompt += `Please provide:
1. Clear, well-commented code
2. Explanation of the code logic
3. Usage examples if applicable
4. Best practices and tips
5. Any potential improvements or alternatives

Format your response with proper code blocks and markdown formatting.`;

		return prompt;
	}

	private buildFileOperationPrompt(userPrompt: string, editorContext: any): string {
		let prompt = `You are Newma AI Assistant, a specialized file operations assistant integrated into VS Code. The user is requesting file operations.

User Request: ${userPrompt}

`;

		if (editorContext.filePath) {
			prompt += `Current File: ${editorContext.filePath}

`;
		}

		if (editorContext.projectStructure) {
			prompt += `Project Structure:
${editorContext.projectStructure}

`;
		}

		prompt += `Please provide:
1. Clear instructions for the file operation
2. File paths and content suggestions
3. Safety considerations (backup, overwrite protection)
4. Step-by-step guidance
5. Alternative approaches if applicable

Format your response with clear sections and actionable steps.`;

		return prompt;
	}

	private buildCodeExplanationPrompt(userPrompt: string, editorContext: any): string {
		let prompt = `You are Newma AI Assistant, a specialized code explanation assistant integrated into VS Code. The user is requesting code explanation or documentation.

User Request: ${userPrompt}

`;

		if (editorContext.selectedText) {
			prompt += `Selected Code:
\`\`\`${editorContext.language || ''}
${editorContext.selectedText}
\`\`\`

`;
		}

		if (editorContext.filePath) {
			prompt += `Current File: ${editorContext.filePath}

`;
		}

		if (editorContext.projectStructure) {
			prompt += `Project Structure:
${editorContext.projectStructure}

`;
		}

		prompt += `Please provide:
1. Clear explanation of the code functionality
2. Line-by-line breakdown (if applicable)
3. Key concepts and techniques used
4. Usage examples and scenarios
5. Best practices demonstrated
6. Potential improvements or alternatives
7. Related concepts for further learning

Format your response with clear sections and proper markdown formatting.`;

		return prompt;
	}

	private buildPrompt(userPrompt: string, editorContext: any): string {
		let prompt = `你是 Newma AI 助手，VS Code 中的编程助手。用中文回答，提供实用解决方案。

用户请求: ${userPrompt}

`;

		if (editorContext.selectedText) {
			prompt += `选中代码:
\`\`\`${editorContext.language || ''}
${editorContext.selectedText}
\`\`\`

`;
		}

		if (editorContext.filePath) {
			prompt += `当前文件: ${editorContext.filePath}

`;
		}

		if (editorContext.projectStructure) {
			prompt += `项目结构:
${editorContext.projectStructure}

`;
		}

		prompt += `请提供实用的回答。如果涉及代码，请提供具体的示例和解释。避免通用模板，专注于实际解决方案。`;

		return prompt;
	}

	private buildProjectAnalysisPrompt(userPrompt: string, projectStructure: any): string {
		let prompt = `你是 Newma AI 助手，专门分析 VS Code 项目结构。用户请求项目分析。

用户请求: ${userPrompt}

项目结构信息:
${projectStructure.summary}

`;

		prompt += `请提供简洁的项目分析（中文回答）:
1. 项目概览（类型、主要技术栈）
2. 关键文件（≤5个，基于实际检测）
3. 配置文件（≤3个，基于实际检测）
4. 项目建议（≤3条，具体可执行）

要求：
- 只基于提供的实际文件信息，不猜测未知内容
- 输出结构化，避免模板化空话
- 重点突出实际发现的问题和改进点`;

		return prompt;
	}

	dispose(): void {
		// Cleanup resources
	}
}
