import * as vscode from 'vscode';
import { AIService } from './aiService';
import { NewmaChatAgent } from './chatAgent';
import { EditorIntegration } from './editorIntegration';
import { CodeGenerator } from './codeGenerator';
import { SideEffectGate } from './sideEffectGate';
import { FileOperations } from './fileOperations';
import { CodeExplainer } from './codeExplainer';
import { ProjectAnalyzer } from './projectAnalyzer';
import { ErrorDetector } from './errorDetector';
import { OperationLogger } from './operationLogger';
import { PlanManager } from './planManager';
import { PlanTreeProvider } from './planView';
import * as os from 'os';
import * as path from 'path';

export async function activate(context: vscode.ExtensionContext) {
	console.log('Newma AI Assistant extension is now active!');

	try {
		// Initialize services
		const aiService = new AIService();
		const editorIntegration = new EditorIntegration();
		const sideEffectGate = new SideEffectGate();
		const operationLogger = new OperationLogger();
		const codeGenerator = new CodeGenerator(sideEffectGate);
		const fileOperations = new FileOperations(sideEffectGate, operationLogger);
		const planManager = new PlanManager(aiService, sideEffectGate, context.globalState);
		const codeExplainer = new CodeExplainer();
		const projectAnalyzer = new ProjectAnalyzer();
		const errorDetector = new ErrorDetector();

		// Activate editor integration
		editorIntegration.activate(context);

		const chatAgent = new NewmaChatAgent(aiService, editorIntegration, codeGenerator, fileOperations, codeExplainer, projectAnalyzer, errorDetector);

		// Register language model provider (required for chat participants to work)
		console.log('=== Registering language model provider ===');
		const lmProvider = vscode.lm.registerLanguageModelChatProvider('newma', {
			async provideLanguageModelChatInformation(_options, _token) {
				return [{
					id: 'newma-ai-model',
					name: 'Newma AI Model',
					family: 'newma',
					version: '1.0.0',
					maxInputTokens: 4000,
					maxOutputTokens: 2000,
					isDefault: true,
					isUserSelectable: true,
					capabilities: {}
				}];
			},
			async provideLanguageModelChatResponse(model, messages, options, progress, token) {
				// This will be handled by our chat participant
				return undefined;
			},
			async provideTokenCount(model, text, token) {
				// Simple token estimation (roughly 4 characters per token)
				const textStr = typeof text === 'string' ? text : text.content;
				return Math.ceil(textStr.length / 4);
			},
		});
		context.subscriptions.push(lmProvider);
		console.log('=== Language model provider registered successfully ===');

		// Register chat participant
		console.log('=== Registering chat participant: newma-ai ===');
		console.log('Available chat APIs:', Object.keys(vscode.chat));
		const chatParticipant = vscode.chat.createChatParticipant('newma-ai', async (request: vscode.ChatRequest, context: vscode.ChatContext, response: vscode.ChatResponseStream, token: vscode.CancellationToken) => {
			console.log('=== Chat participant handler called ===');
			console.log('Request prompt:', request.prompt);
			console.log('Request command:', request.command);
			console.log('Request references:', request.references);
			console.log('Request tool references:', request.toolReferences);
			console.log('Full request object:', JSON.stringify(request, null, 2));
			// Early ack so the UI reacts immediately
			response.markdown('');
			try {
				const result = await chatAgent.handleRequest(request, context, response, token);
				// Defensive: always return an object
				if (!result) {
					return {
						metadata: { command: 'newma-ai-empty', agentName: 'Newma AI Assistant' }
					};
				}
				return result;
			} catch (err) {
				console.error('Chat participant unhandled error:', err);
				response.markdown(`**Error:** ${err instanceof Error ? err.message : String(err)}`);
				return {
					metadata: { command: 'newma-ai-error', agentName: 'Newma AI Assistant' },
					errorDetails: { message: err instanceof Error ? err.message : 'Unknown error', responseIsFiltered: false }
				};
			}
		});
		context.subscriptions.push(chatParticipant);
		console.log('=== Chat participant registered successfully ===');

		// Register commands
		const configureCommand = vscode.commands.registerCommand('newma-ai-assistant.configure', async () => {
			await vscode.commands.executeCommand('workbench.action.openSettings', 'newma-ai-assistant');
		});

		const testCommand = vscode.commands.registerCommand('newma-ai-assistant.test', async () => {
			try {
				const response = await aiService.generateResponse('Hello, this is a test message.', {
					token: new vscode.CancellationTokenSource().token,
					onProgress: (text: string) => {
						console.log('Test response:', text);
					}
				});
				vscode.window.showInformationMessage(`AI connection test successful! Response: ${response.substring(0, 100)}...`);
			} catch (error) {
				vscode.window.showErrorMessage(`AI connection test failed: ${error}`);
			}
		});

		// Register code action commands
		const copyCodeCommand = vscode.commands.registerCommand('newma-ai.copyCode', async (code: string) => {
			await vscode.env.clipboard.writeText(code);
			vscode.window.showInformationMessage('Code copied to clipboard!');
		});

		const insertCodeCommand = vscode.commands.registerCommand('newma-ai.insertCode', async (code: string) => {
			await codeGenerator.insertCodeIntoEditor(code, '');
		});

		const createFileCommand = vscode.commands.registerCommand('newma-ai.createFile', async (code: string, language: string) => {
			await codeGenerator.createFileWithCode(code, language);
		});

		const replaceCodeCommand = vscode.commands.registerCommand('newma-ai.replaceCode', async (code: string) => {
			await codeGenerator.replaceSelectedCode(code);
		});

		// Register file operation commands
		const listFilesCommand = vscode.commands.registerCommand('newma-ai.listFiles', async () => {
			const workspaceRoot = fileOperations.getWorkspaceRoot();
			if (workspaceRoot) {
				const files = await fileOperations.listFiles(workspaceRoot);
				vscode.window.showInformationMessage(`Found ${files.length} files in workspace`);
			} else {
				vscode.window.showErrorMessage('No workspace folder found');
			}
		});

		const searchFilesCommand = vscode.commands.registerCommand('newma-ai.searchFiles', async (searchTerm: string) => {
			const workspaceRoot = fileOperations.getWorkspaceRoot();
			if (workspaceRoot) {
				const results = await fileOperations.searchInFiles(workspaceRoot, searchTerm);
				vscode.window.showInformationMessage(`Found ${results.length} matches for "${searchTerm}"`);
			} else {
				vscode.window.showErrorMessage('No workspace folder found');
			}
		});

		// New: delete / move / rename commands (all go through Ask via FileOperations)
		const deleteFileCommand = vscode.commands.registerCommand('newma-ai.deleteFile', async (filePathArg?: string) => {
			const workspaceRoot = fileOperations.getWorkspaceRoot();
			if (!workspaceRoot) { vscode.window.showErrorMessage('No workspace folder found'); return; }
			const filePath = filePathArg || await vscode.window.showInputBox({ placeHolder: '输入要删除的文件相对路径' });
			if (!filePath) { return; }
			await fileOperations.deleteFile(fileOperations.getAbsolutePath(filePath), true);
		});

		const moveFileCommand = vscode.commands.registerCommand('newma-ai.moveFile', async (sourceArg?: string, destArg?: string) => {
			const workspaceRoot = fileOperations.getWorkspaceRoot();
			if (!workspaceRoot) { vscode.window.showErrorMessage('No workspace folder found'); return; }
			const source = sourceArg || await vscode.window.showInputBox({ placeHolder: '输入要移动的文件相对路径（源）' });
			if (!source) { return; }
			const dest = destArg || await vscode.window.showInputBox({ placeHolder: '输入目标相对路径（目的地）' });
			if (!dest) { return; }
			await fileOperations.moveFile(fileOperations.getAbsolutePath(source), fileOperations.getAbsolutePath(dest));
		});

		const renameFileCommand = vscode.commands.registerCommand('newma-ai.renameFile', async (filePathArg?: string, newNameArg?: string) => {
			const workspaceRoot = fileOperations.getWorkspaceRoot();
			if (!workspaceRoot) { vscode.window.showErrorMessage('No workspace folder found'); return; }
			const rel = filePathArg || await vscode.window.showInputBox({ placeHolder: '输入要重命名的文件相对路径' });
			if (!rel) { return; }
			const abs = fileOperations.getAbsolutePath(rel);
			const newName = newNameArg || await vscode.window.showInputBox({ placeHolder: '输入新的文件名' });
			if (!newName) { return; }
			const destAbs = require('path').join(require('path').dirname(abs), newName);
			await fileOperations.moveFile(abs, destAbs);
		});

		// Register code explanation commands
		const generateCommentsCommand = vscode.commands.registerCommand('newma-ai.generateComments', async (code: string) => {
			const editor = vscode.window.activeTextEditor;
			if (editor) {
				const language = editor.document.languageId;
				const prompt = await codeExplainer.generateCodeComments(code, { language });
				const aiResponse = await aiService.generateResponse(prompt, {
					onProgress: () => { },
					token: new vscode.CancellationTokenSource().token
				});
				vscode.window.showInformationMessage('Comments generated! Check the chat for details.');
			}
		});

		const generateDocumentationCommand = vscode.commands.registerCommand('newma-ai.generateDocumentation', async (code: string) => {
			const editor = vscode.window.activeTextEditor;
			if (editor) {
				const language = editor.document.languageId;
				const prompt = await codeExplainer.generateFunctionDocumentation(code, language);
				const aiResponse = await aiService.generateResponse(prompt, {
					onProgress: () => { },
					token: new vscode.CancellationTokenSource().token
				});
				vscode.window.showInformationMessage('Documentation generated! Check the chat for details.');
			}
		});

		const codeReviewCommand = vscode.commands.registerCommand('newma-ai.codeReview', async (code: string) => {
			const editor = vscode.window.activeTextEditor;
			if (editor) {
				const language = editor.document.languageId;
				const prompt = await codeExplainer.generateCodeReviewComments(code, language);
				const aiResponse = await aiService.generateResponse(prompt, {
					onProgress: () => { },
					token: new vscode.CancellationTokenSource().token
				});
				vscode.window.showInformationMessage('Code review completed! Check the chat for details.');
			}
		});

		// Register project analysis commands
		const analyzeProjectCommand = vscode.commands.registerCommand('newma-ai.analyzeProject', async () => {
			const workspaceRoot = fileOperations.getWorkspaceRoot();
			if (workspaceRoot) {
				try {
					const projectStructure = await projectAnalyzer.analyzeProjectStructure(workspaceRoot);
					const preview = projectAnalyzer.getContextPreview(projectStructure);
					vscode.window.showInformationMessage(`Project analysis completed! Files: ${projectStructure.fileCount}, Directories: ${projectStructure.directoryCount}`);

					// 显示项目结构预览
					const doc = await vscode.workspace.openTextDocument({
						content: preview,
						language: 'markdown'
					});
					await vscode.window.showTextDocument(doc);
				} catch (error) {
					vscode.window.showErrorMessage(`Project analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
				}
			} else {
				vscode.window.showErrorMessage('No workspace folder found');
			}
		});

		// Register error detection commands
		const detectErrorsCommand = vscode.commands.registerCommand('newma-ai.detectErrors', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showErrorMessage('No active editor found');
				return;
			}

			try {
				const errors = await errorDetector.detectErrors(editor.document);
				if (errors.length === 0) {
					vscode.window.showInformationMessage('No errors found in the current file!');
				} else {
					vscode.window.showInformationMessage(`Found ${errors.length} issues in the current file`);
				}
			} catch (error) {
				vscode.window.showErrorMessage(`Error detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		});

		const applyFixCommand = vscode.commands.registerCommand('newma-ai.applyFix', async (suggestion: any, documentUri: vscode.Uri) => {
			try {
				const document = await vscode.workspace.openTextDocument(documentUri);
				await errorDetector.applyFix(suggestion, document);
				vscode.window.showInformationMessage(`Applied fix: ${suggestion.title}`);
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to apply fix: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		});

		const undoLastCommand = vscode.commands.registerCommand('newma-ai.undoLast', async () => {
			await operationLogger.undoLast();
		});

		// Plan commands
		const planCreate = vscode.commands.registerCommand('newma-ai.plan.create', async () => {
			let prompt = await openStableInput('输入你的目标（将生成执行计划）', 'Newma Plan：请输入你的目标，然后回车生成计划');
			if (!prompt) {
				const ed = vscode.window.activeTextEditor;
				const sel = ed?.document.getText(ed.selection).trim();
				if (sel) { prompt = sel; }
			}
			if (!prompt) { vscode.window.showWarningMessage('未获取到输入；可先在编辑器选中文本后再运行 Plan Create。'); return; }
			await planManager.buildPlanFromPrompt(prompt);
			vscode.window.showInformationMessage(`已生成计划，共 ${planManager.getCurrentPlan().length} 步`);
			planProvider.refresh();
		});
		// Fallback: open an untitled editor for input
		const planOpenInputEditor = vscode.commands.registerCommand('newma-ai.plan.inputEditor', async () => {
			const doc = await vscode.workspace.openTextDocument({ language: 'markdown', content: '# Newma Plan 输入\n\n在此处输入你的目标，然后选择文本运行“Plan: Use Selection as Prompt”。\n' });
			await vscode.window.showTextDocument(doc, { preview: false });
		});
		const planUseSelection = vscode.commands.registerCommand('newma-ai.plan.useSelection', async () => {
			const ed = vscode.window.activeTextEditor;
			if (!ed) { vscode.window.showErrorMessage('没有活动编辑器'); return; }
			const text = ed.document.getText(ed.selection).trim() || ed.document.lineAt(ed.selection.active.line).text.trim();
			if (!text) { vscode.window.showWarningMessage('未找到选中文本或当前行内容'); return; }
			await planManager.buildPlanFromPrompt(text);
			vscode.window.showInformationMessage(`已生成计划，共 ${planManager.getCurrentPlan().length} 步`);
			planProvider.refresh();
		});
		const planRun = vscode.commands.registerCommand('newma-ai.plan.run', async () => {
			await planManager.runPlanInteractively();
			planProvider.refresh();
		});
		const planCreateAndRun = vscode.commands.registerCommand('newma-ai.plan.createAndRun', async () => {
			let prompt = await openStableInput('输入你的目标（生成并执行计划）', 'Newma Plan：请输入你的目标，然后回车生成并执行');
			if (!prompt) {
				const ed = vscode.window.activeTextEditor;
				const sel = ed?.document.getText(ed.selection).trim();
				if (sel) { prompt = sel; }
			}
			if (!prompt) { vscode.window.showWarningMessage('未获取到输入；可先在编辑器选中文本后再运行 Plan Create and Run。'); return; }
			await planManager.buildPlanFromPrompt(prompt);
			await planManager.runPlanInteractively();
			planProvider.refresh();
		});
		const planResume = vscode.commands.registerCommand('newma-ai.plan.resume', async () => {
			await planManager.runPlanInteractively();
			planProvider.refresh();
		});
		const planClear = vscode.commands.registerCommand('newma-ai.plan.clear', async () => {
			planManager.clear();
			vscode.window.showInformationMessage('已清空当前计划');
			planProvider.refresh();
		});

		// Plan view
		const planProvider = new PlanTreeProvider(planManager);
		const planView = vscode.window.createTreeView('newmaPlanView', { treeDataProvider: planProvider });
		context.subscriptions.push(planView);
		const executeStepCmd = vscode.commands.registerCommand('newma-ai.plan.executeStep', async (index: number) => {
			await planManager.runSingleStep(index);
			planProvider.refresh();
		});
		const skipStepCmd = vscode.commands.registerCommand('newma-ai.plan.skipStep', async (index: number) => {
			const steps = planManager.getCurrentPlan();
			if (index >= 0 && index < steps.length) { steps[index].status = 'skipped'; }
			planProvider.refresh();
		});

		context.subscriptions.push(configureCommand, testCommand, copyCodeCommand, insertCodeCommand, createFileCommand, replaceCodeCommand, listFilesCommand, searchFilesCommand, deleteFileCommand, moveFileCommand, renameFileCommand, generateCommentsCommand, generateDocumentationCommand, codeReviewCommand, analyzeProjectCommand, detectErrorsCommand, applyFixCommand, undoLastCommand, planCreate, planRun, planCreateAndRun, planResume, planClear, executeStepCmd, skipStepCmd, planOpenInputEditor, planUseSelection);

		// Register refine commands for quick actions
		const refineCommand = vscode.commands.registerCommand('newma-ai.refine', async (mode: 'retry' | 'shorter' | 'detailed' | 'optimize', lastPrompt?: string) => {
			const suffixMap: Record<string, string> = {
				retry: '请在相同要求下再回答一次，确保更清晰、避免重复。',
				shorter: '请将上面的回答压缩为不超过 5 条要点，去除赘述。',
				detailed: '请在保持结构的前提下更详细，补充关键步骤与示例代码。',
				optimize: '请给出更优化、更实用的实现与权衡，突出可执行步骤。'
			};
			const editorPrompt = lastPrompt || (await vscode.window.showInputBox({ placeHolder: '输入要基于其优化的原始提示（留空则取消）' }));
			if (!editorPrompt) { return; }
			const prompt = `${editorPrompt}\n\n${suffixMap[mode] || ''}`.trim();
			await aiService.generateResponse(prompt, { onProgress: () => { }, token: new vscode.CancellationTokenSource().token });
			vscode.window.showInformationMessage('已发送精炼请求，查看聊天面板以获取结果。');
		});
		context.subscriptions.push(refineCommand);

		// Status bar mode toggle (move to right with very high priority)
		const modeStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 10000);
		modeStatus.command = 'newma-ai.selectMode';
		const updateModeStatus = () => {
			const cfg = vscode.workspace.getConfiguration('newma-ai-assistant');
			const mode = cfg.get<string>('interactionMode', 'agent');
			modeStatus.text = `$(gear) Mode: ${mode}`;
			modeStatus.tooltip = 'Click to switch Agent/Ask/Plan';
			modeStatus.show();
		};
		updateModeStatus();
		context.subscriptions.push(modeStatus);
		context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('newma-ai-assistant.interactionMode')) {
				updateModeStatus();
			}
		}));

		// Mode selector (Auto / Ask / Plan)
		const selectModeCommand = vscode.commands.registerCommand('newma-ai.selectMode', async () => {
			const options = [
				{ label: 'Agent', value: 'agent', description: '自动执行（受保护）' },
				{ label: 'Ask', value: 'ask', description: '涉及改动前先确认' },
				{ label: 'Plan', value: 'plan', description: '先生成计划再执行' }
			];
			const picked = await vscode.window.showQuickPick(options, { placeHolder: '选择交互模式' });
			if (!picked) { return; }
			const cfg = vscode.workspace.getConfiguration('newma-ai-assistant');
			await cfg.update('interactionMode', picked.value, vscode.ConfigurationTarget.Global);
			vscode.window.showInformationMessage(`Newma 交互模式已切换为：${picked.label}`);
		});
		context.subscriptions.push(selectModeCommand);

		// Note: slash commands are declared via chat participant commands; no extra API needed here

		// Diagnostics status bar (left side, high priority)
		const diagStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10000);
		diagStatus.command = 'newma-ai.diagnostics';
		context.subscriptions.push(diagStatus);

		// Run startup diagnostics and update status bar
		const diag = await runStartupDiagnostics();
		updateDiagnosticsStatusBar(diagStatus, diag);

		// Register Diagnostics command
		const diagnosticsCmd = vscode.commands.registerCommand('newma-ai.diagnostics', async () => {
			const d = await runStartupDiagnostics();
			updateDiagnosticsStatusBar(diagStatus, d);
			const details = formatDiagnostics(d);
			const picked = await vscode.window.showInformationMessage(details, { modal: true }, 'Repair', 'Close');
			if (picked === 'Repair') {
				await vscode.commands.executeCommand('newma-ai.repair');
			}
		});
		context.subscriptions.push(diagnosticsCmd);

		// Register Repair command (opens a terminal with correct Node 20 PATH and relaunch instructions)
		const repairCmd = vscode.commands.registerCommand('newma-ai.repair', async () => {
			const term = vscode.window.createTerminal({ name: 'Newma Repair' });
			term.show(true);
			const node20Path = '/opt/homebrew/opt/node@20/bin';
			const repoRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
			const electronCmd = `${path.join(repoRoot, 'build/lib/electron')}`;
			const enableProp = '--enable-proposed-api=newma.newma-ai-assistant';
			const lines: string[] = [];
			// Enforce Node 20 in PATH and precompile
			lines.push(`export PATH="${node20Path}:$PATH"`);
			lines.push(`node -v`);
			lines.push(`cd ${repoRoot} && npm run compile`);
			// Kill previous Electron/Code - OSS
			lines.push(`pkill -f "Code - OSS" || true; pkill -f "Electron" || true; pkill -f "build/lib/electron" || true`);
			// Relaunch dev host via Node 20 explicitly
			lines.push(`cd ${repoRoot} && ${path.join(node20Path, 'node')} ${electronCmd} ${enableProp}`);
			term.sendText(lines.join('\n'));
			vscode.window.showInformationMessage('Repair commands sent to terminal "Newma Repair". Follow the terminal to relaunch.');
		});
		context.subscriptions.push(repairCmd);

		// Show welcome message after diagnostics
		vscode.window.showInformationMessage('Newma AI Assistant is ready! Use @newma-ai in chat to get started.');

		console.log('Newma AI Assistant extension activated successfully!');
	} catch (error) {
		console.error('Error activating Newma AI Assistant extension:', error);
		vscode.window.showErrorMessage(`Failed to activate Newma AI Assistant: ${error}`);
	}
}

export function deactivate() {
	console.log('Newma AI Assistant extension is deactivated');
}

async function openStableInput(placeHolder: string, prompt?: string): Promise<string | undefined> {
	const input = vscode.window.createInputBox();
	input.ignoreFocusOut = true;
	input.placeholder = placeHolder;
	if (prompt) { input.prompt = prompt; }
	input.value = '';
	let resolved = false;
	return await new Promise<string | undefined>((resolve) => {
		const accept = input.onDidAccept(() => {
			resolved = true;
			const value = input.value.trim();
			input.hide();
			accept.dispose();
			hide.dispose();
			resolve(value || undefined);
		});
		const hide = input.onDidHide(() => {
			if (!resolved) { resolve(undefined); }
			accept.dispose();
			hide.dispose();
			input.dispose();
		});
		input.show();
		// Ensure focus sticks to the input control
		setTimeout(() => { try { input.enabled = true; input.busy = false; } catch { /* noop */ } }, 0);
	});
}

interface StartupDiagnosticsResult {
	usesNode20: boolean;
	chatApiOk: boolean;
	proposedApiHint: string;
	endpoint: string;
}

async function runStartupDiagnostics(): Promise<StartupDiagnosticsResult> {
	const usesNode20 = process.versions?.node?.startsWith('20.') ?? false;
	const chatApiOk = typeof (vscode as any).chat?.createChatParticipant === 'function';
	const proposedApiHint = chatApiOk ? 'OK' : 'Missing or not enabled';
	const cfg = vscode.workspace.getConfiguration('newma-ai-assistant');
	const endpoint = cfg.get<string>('endpoint', 'http://127.0.0.1:3901/v1/chat');
	return { usesNode20, chatApiOk, proposedApiHint, endpoint };
}

function updateDiagnosticsStatusBar(item: vscode.StatusBarItem, d: StartupDiagnosticsResult) {
	const ok = d.usesNode20 && d.chatApiOk;
	item.text = ok ? '$(check) Newma OK' : '$(warning) Newma Needs Repair';
	item.tooltip = `Node: ${process.versions.node} | ChatAPI: ${d.chatApiOk ? 'OK' : 'Not Ready'} | Endpoint: ${d.endpoint}`;
	item.show();
}

function formatDiagnostics(d: StartupDiagnosticsResult): string {
	return `Newma 启动自检结果\n\n- Node 版本: ${process.versions.node} ${d.usesNode20 ? '(OK, 20.x)' : '(需要 20.x)'}\n- Chat API: ${d.chatApiOk ? '可用' : '不可用（需启用 proposed API）'}\n- Proposed API 状态: ${d.proposedApiHint}\n- Backend Endpoint: ${d.endpoint}\n\n如果显示 “Needs Repair”，请点击 Repair 按钮，使用 Node 20 重新启动开发主程序。`;
}
