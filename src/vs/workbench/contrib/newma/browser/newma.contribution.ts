/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Registry, Registry as PlatformRegistry } from '../../../../platform/registry/common/platform.js';
import { registerAction2, Action2, MenuId, MenuRegistry } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { INewmaAiService } from '../../../../platform/newmaAi/common/newmaAi.js';
// IQuickInputService and INotificationService are already imported at top-level of this file
import { Codicon } from '../../../../base/common/codicons.js';
import { IChatAgentService } from '../../chat/common/chatAgents.js';
import { ChatAgentLocation, ChatModeKind } from '../../chat/common/constants.js';
import { ExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IPreferencesService } from '../../../services/preferences/common/preferences.js';
import { ITerminalService } from '../../terminal/browser/terminal.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { NewmaFileInterception } from './newmaFileInterception.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { CHAT_CONFIG_MENU_ID, CHAT_CATEGORY } from '../../chat/browser/actions/chatActions.js';
import { ChatViewId } from '../../chat/browser/chat.js';
import { ChatContextKeys } from '../../chat/common/chatContextKeys.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { IActionViewItemService } from '../../../../platform/actions/browser/actionViewItemService.js';
import { ActionViewItem, BaseActionViewItem, IActionViewItemOptions } from '../../../../base/browser/ui/actionbar/actionViewItems.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { NewmaModeSelector, IModeOption } from './newmaModeSelector.js';
import { IAction } from '../../../../base/common/actions.js';
import { NewmaHistoryPopup } from './newmaHistoryPopup.js';
import { addDisposableListener, EventType, getWindow, $, append, EventHelper, EventLike } from '../../../../base/browser/dom.js';
import { StandardMouseEvent } from '../../../../base/browser/mouseEvent.js';
import { AnchorAlignment } from '../../../../base/browser/ui/contextview/contextview.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { IChatService } from '../../chat/common/chatService.js';
import { ChatViewPane } from '../../chat/browser/chatViewPane.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';

// Commands (no-op placeholders)
/* class NewmaAgentCommand extends Action2 {
	constructor() {
		super({ id: 'newma.agent', title: localize2('newma.agent', 'Newma: Agent Mode'), f1: true, menu: { id: MenuId.CommandPalette } });
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const productService = accessor.get(IProductService) as unknown as { newma?: { enableCore?: boolean } };
		if (!productService.newma?.enableCore) { return; }
		const ai = accessor.get(INewmaAiService) as unknown as INewmaAiService;
		const quick = accessor.get(IQuickInputService);
		const notifications = accessor.get(INotificationService);
		const prompt = await quick.input({ prompt: 'Newma Agent prompt' });
		if (!prompt) { return; }
		try {
			const text = await ai.generateResponse(prompt);
			notifications.notify({ severity: Severity.Info, message: text && text.trim() ? `Newma Agent: ${text}` : 'Newma Agent: (empty response)' });
		} catch (err) {
			notifications.notify({ severity: Severity.Error, message: `Newma Agent failed: ${String(err)}` });
		}
	}
} */

/* class NewmaAskCommand extends Action2 {
	constructor() {
		super({ id: 'newma.ask', title: localize2('newma.ask', 'Newma: Ask'), f1: true, menu: { id: MenuId.CommandPalette } });
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const productService = accessor.get(IProductService) as unknown as { newma?: { enableCore?: boolean } };
		if (!productService.newma?.enableCore) { return; }
		const ai = accessor.get(INewmaAiService) as unknown as INewmaAiService;
		const quick = accessor.get(IQuickInputService);
		const notifications = accessor.get(INotificationService);
		const prompt = await quick.input({ prompt: 'Ask Newma' });
		if (!prompt) { return; }
		try {
			const text = await ai.generateResponse(prompt);
			notifications.notify({ severity: Severity.Info, message: text && text.trim() ? text : 'Newma: (empty response)' });
		} catch (err) {
			notifications.notify({ severity: Severity.Error, message: `Newma: ${String(err)}` });
		}
	}
} */

class NewmaPlanCommand extends Action2 {
	constructor() {
		super({ id: 'newma.plan', title: localize2('newma.plan', 'Newma: Plan'), f1: true, menu: { id: MenuId.CommandPalette } });
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const productService = accessor.get(IProductService) as unknown as { newma?: { enableCore?: boolean } };
		if (!productService.newma?.enableCore) { return; }
		const ai = accessor.get(INewmaAiService) as unknown as INewmaAiService;
		const quick = accessor.get(IQuickInputService);
		const notifications = accessor.get(INotificationService);
		const prompt = await quick.input({ prompt: 'Plan with Newma' });
		if (!prompt) { return; }
		const steps = await ai.buildPlan(prompt);
		notifications.notify({ severity: Severity.Info, message: `Plan created: ${steps.length} step(s)` });
	}
}

class NewmaDiagnosticsCommand extends Action2 {
	constructor() {
		super({ id: 'newma.diagnostics', title: localize2('newma.diagnostics', 'Newma: Diagnostics'), f1: true, menu: { id: MenuId.CommandPalette } });
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const productService = accessor.get(IProductService) as unknown as { newma?: { enableCore?: boolean; backend?: { baseUrl?: string; timeoutMs?: number } } };
		const ai = accessor.get(INewmaAiService) as unknown as INewmaAiService;
		const notifications = accessor.get(INotificationService);
		const configurationService = accessor.get(IConfigurationService);
		const ok = await ai.healthCheck();
		const baseUrl = productService?.newma?.backend?.baseUrl || 'n/a';
		const timeout = productService?.newma?.backend?.timeoutMs || 0;
		const apiKey = configurationService?.getValue<string>('newma.backend.apiKey') || '';
		const model = configurationService?.getValue<string>('newma.backend.model') || 'gpt-4';
		const apiUrl = configurationService?.getValue<string>('newma.backend.apiUrl') || 'https://api.openai.com/v1/chat/completions';
		let msg = `Core=${productService?.newma?.enableCore ? 'on' : 'off'} health=${ok ? 'ok' : 'fail'} baseUrl=${baseUrl} timeoutMs=${timeout} model=${model} apiUrl=${apiUrl} apiKey=${apiKey ? '****' + apiKey.slice(-4) : 'none'}`;
		if (ok) {
			try {
				const probe = await ai.generateResponse('ping');
				msg += ` | probeLen=${probe?.length ?? 0}`;
				if (probe && probe.trim()) {
					msg += ` snippet="${probe.slice(0, 80).replace(/\n/g, ' ')}"`;
				}
			} catch (e) {
				msg += ` | probeError=${String(e)}`;
			}
		}
		// eslint-disable-next-line no-console
		console.log('[Newma Diagnostics]', msg);
		notifications.notify({ severity: ok ? Severity.Info : Severity.Warning, message: msg });
	}
}

class NewmaCutoverInfoCommand extends Action2 {
	constructor() {
		super({ id: 'newma.cutoverInfo', title: localize2('newma.cutoverInfo', 'Newma: Cutover Mode Info'), f1: true, menu: { id: MenuId.CommandPalette } });
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const productService = accessor.get(IProductService) as unknown as { newma?: { enableCore?: boolean; disableBuiltinChat?: boolean } };
		const notifications = accessor.get(INotificationService);
		const coreOn = !!productService?.newma?.enableCore;
		const hideBuiltin = !!productService?.newma?.disableBuiltinChat;
		const mode = coreOn ? 'Core' : 'Extension';
		const hint = coreOn ? 'Core 已启用：脚本会禁用 newma 扩展' : 'Core 未启用：将使用扩展实现';
		notifications.info(`Newma 切换模式：${mode}（disableBuiltinChat=${hideBuiltin}）。${hint}`);
	}
}

class NewmaConfigureCommand extends Action2 {
	constructor() {
		super({
			id: 'newma.configure',
			title: localize2('newma.configure', 'Newma: Configure'),
			shortTitle: localize2('newma.configure.short', 'Configure Newma AI'),
			category: CHAT_CATEGORY,
			f1: true,
			menu: [
				{ id: MenuId.CommandPalette }
			]
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const preferencesService = accessor.get(IPreferencesService);
		await preferencesService.openUserSettings({ jsonEditor: false, query: '@id:newma.backend' });
	}
}

// Status bar contribution (simple toggle entry)
/* class NewmaStatusContribution extends Disposable implements IWorkbenchContribution {
	constructor(
		@IStatusbarService private readonly statusbarService: IStatusbarService,
	) {
		super();
		const props: IStatusbarEntry = {
			name: 'Newma',
			text: '$(sparkle) Newma',
			ariaLabel: 'Newma AI',
			tooltip: 'Newma AI',
			command: 'newma.ask'
		};
		this._register(this.statusbarService.addEntry(props, 'status.newma', StatusbarAlignment.RIGHT, { location: { id: 'status.editor.mode', priority: 100.2 }, alignment: StatusbarAlignment.RIGHT }));
	}
} */

// Hide Copilot UI early before ChatStatusBarEntry initializes
class NewmaHideCopilotContribution implements IWorkbenchContribution {
	constructor(
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IProductService private readonly productService: IProductService & { newma?: { enableCore?: boolean; disableBuiltinChat?: boolean } }
	) {
		const disableBuiltinChat = !!(this.productService?.newma && this.productService.newma.disableBuiltinChat);
		if (disableBuiltinChat || this.productService?.newma?.enableCore) {
			// Do not hide Chat globally; only rely on contribution gating to avoid Copilot status entry
			// Keep a context key for our own conditions if needed
			this.contextKeyService.createKey('newma.coreEnabled', true);
			// Initialize chat mode context key
			this.contextKeyService.createKey('newma.chat.mode', 'ask');
		}
	}
}

// Early bootstrap: register Newma chat agent at startup to avoid UI races
class NewmaAgentBootstrapContribution implements IWorkbenchContribution {
	constructor(
		@IChatAgentService chatAgents: IChatAgentService,
		@INewmaAiService ai: INewmaAiService,
		@IProductService productService: IProductService & { newma?: { enableCore?: boolean; agent?: { displayName?: string; sampleRequest?: string; isSticky?: boolean } } },
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IQuickInputService private readonly quickInputService: IQuickInputService,
		@ITerminalService private readonly terminalService: ITerminalService,
		@IFileService private readonly fileService: IFileService,
	) {
		try {

			const id = 'newma-ai';
			const name = 'newma-ai';
			const fullName = productService?.newma?.agent?.displayName || 'Newma AI';
			const isDefault = !!productService?.newma?.enableCore;
			const sampleRequest = productService?.newma?.agent?.sampleRequest;
			const isSticky = productService?.newma?.agent?.isSticky;

			const extensionDisplayName = productService?.nameShort || 'Newma';
			const extId = (productService?.nameShort ? productService.nameShort.toLowerCase() : 'newma') + '.core';

			const agentEnabled = !!configurationService?.getValue<boolean>('newma.agent.enabled');
			const data = {
				id,
				name,
				fullName,
				description: 'Newma Core Chat Agent',
				isDefault,
				isCore: true,
				isDynamic: true,
				slashCommands: [],
				locations: [ChatAgentLocation.Chat],
				modes: agentEnabled ? [ChatModeKind.Ask, ChatModeKind.Agent] : [ChatModeKind.Ask],
				disambiguation: [],
				metadata: Object.assign({}, sampleRequest ? { sampleRequest } : {}, typeof isSticky === 'boolean' ? { isSticky } : {}, { themeIcon: Codicon.sparkle }),
				extensionId: new ExtensionIdentifier(extId),
				extensionVersion: (productService as any)?.version || '0.0.0',
				extensionDisplayName,
				extensionPublisherId: (productService as any)?.publisher || 'newma'
			} as any;

			const quickInputService = this.quickInputService;
			const terminalService = this.terminalService;
			const fileService = this.fileService;
			const contextKeyService = this.contextKeyService;

			chatAgents.registerDynamicAgent(data, {
				async invoke(request, progress, _history, token) {
					if (token.isCancellationRequested) {
						return { errorDetails: { message: 'Cancelled' } } as any;
					}
					// Determine current mode from context key
					const mode = contextKeyService.getContextKeyValue('newma.chat.mode') || 'ask';
					const msg: string = request.message || '';

					if (String(mode) === 'plan' || msg.startsWith('[Plan]')) {
						const steps = await ai.buildPlan(msg.replace(/^\[Plan\]\s*/i, ''));
						const summary = steps.map((s: any) => `${s.index}. ${s.title}`).join('\n');
						progress([{ kind: 'markdownContent', content: new MarkdownString(summary) }]);
						return {} as any;
					} else if (String(mode) === 'agent' || msg.startsWith('[Agent]')) {
						// In Agent mode, use AI model to determine if this is a task request or just a conversation
						const cleanMsg = msg.replace(/^\[Agent\]\s*/i, '');
						const isTask = await ai.isTaskRequest(cleanMsg);
						if (!isTask) {
							// Treat as regular conversation in Agent mode
							await ai.generateResponse(cleanMsg, {
								onProgress: (chunk) => {
									if (token.isCancellationRequested) { return; }
									progress([{ kind: 'markdownContent', content: new MarkdownString(chunk) }]);
								}
							});
							return {} as any;
						}
						// This is a task request: proceed with plan + execute
						// 1) Plan
						const steps = await ai.buildPlan(cleanMsg);
						if (!steps?.length) {
							progress([{ kind: 'markdownContent', content: new MarkdownString('No steps generated.') }]);
							return {} as any;
						}
						// 2) Ask for approval of the next step
						const choice = await quickInputService.pick(steps.map((s: any) => ({ id: String(s.index), label: `${s.index}. ${s.title}`, detail: s.instruction })), { canPickMany: false, placeHolder: 'Select a step to execute' });
						if (!choice) {
							progress([{ kind: 'markdownContent', content: new MarkdownString('Agent cancelled.') }]);
							return {} as any;
						}
						const sel = steps.find((s: any) => String(s.index) === choice.id);
						const instruction: string = sel?.instruction || '';
						// 3) Execute minimal actions
						let executed = false;
						// run command
						const runMatch = instruction.match(/^(?:run|execute)\s+(.+)/i) || instruction.match(/^(npm|yarn|git|cd|mkdir|ls|cat|echo)\b.*$/i);
						if (runMatch) {
							const cmd = runMatch[1] || runMatch[0];
							const t = await terminalService.getActiveOrCreateInstance();
							await t.focusWhenReady(true);
							t.runCommand(cmd, false);
							executed = true;
							progress([{ kind: 'markdownContent', content: new MarkdownString(`Executing in terminal:\n\n\`\`\`${cmd}\`\`\``) }]);
						}
						// write file (very simple pattern: write <relativePath>: <content> )
						const writeMatch = instruction.match(/^write\s+([^:]+):\s*[\n\r]?([\s\S]+)$/i);
						if (!executed && writeMatch) {
							try {
								const rel = writeMatch[1].trim();
								const content = writeMatch[2];
								if (!rel.startsWith('/') && !/^\w:\\/.test(rel)) {
									progress([{ kind: 'markdownContent', content: new MarkdownString('Write failed: use absolute path for now.') }]);
								} else {
									const uri = URI.file(rel);
									await fileService.writeFile(uri, VSBuffer.fromString(content));
								}
								progress([{ kind: 'markdownContent', content: new MarkdownString(`Wrote file: \`${rel}\``) }]);
								executed = true;
							} catch (e) {
								progress([{ kind: 'markdownContent', content: new MarkdownString(`Write failed: ${String(e)}`) }]);
							}
						}
						if (!executed) {
							progress([{ kind: 'markdownContent', content: new MarkdownString(`Approved step:\n\n- ${sel?.title}\n\nInstruction:\n\n${instruction}`) }]);
						}
						return {} as any;
					} else {
						// Ask mode with streaming
						await ai.generateResponse(msg, {
							onProgress: (chunk) => {
								if (token.isCancellationRequested) { return; }
								progress([{ kind: 'markdownContent', content: new MarkdownString(chunk) }]);
							}
						});
						return {} as any;
					}
				}
			});

			// Ensure ChatContextKeys.enabled is set when we register a default agent
			// This is needed for New Chat button to be enabled
			// Note: registerDynamicAgent doesn't automatically update ChatContextKeys.enabled like registerAgentImplementation does
			if (data.isDefault) {
				ChatContextKeys.enabled.bindTo(this.contextKeyService).set(true);
			}
		} catch {
			// ignore if chat not available
		}
	}
}

// Gate everything on product flag
(function registerContributions() {
	const productService = Registry.as<any>(WorkbenchExtensions.Workbench).instantiationService?.invokeFunction((accessor: ServicesAccessor) => accessor.get(IProductService));
	// Fall back to reading via global accessor later during workbench startup if not available
	// Enable Newma contributions unconditionally to avoid early init race
	const disableBuiltinChat = !!(productService?.newma && productService.newma.disableBuiltinChat);

	// Register Newma configuration schema
	const configurationRegistry = PlatformRegistry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
	configurationRegistry.registerConfiguration({
		id: 'newma',
		order: 100,
		title: localize('newma.config.title', 'Newma AI'),
		properties: {
			'newma.backend.apiKey': {
				type: 'string',
				default: '',
				description: localize('newma.backend.apiKey', 'API key for AI provider (OpenAI/DeepSeek/Anthropic)'),
				markdownDescription: localize('newma.backend.apiKey.md', 'API key used to authenticate requests to AI provider. If empty, environment variables NEWMA_API_KEY/OPENAI_API_KEY/DEEPSEEK_API_KEY/ANTHROPIC_API_KEY will be used when available.'),
				order: 1
			},
			'newma.backend.model': {
				type: 'string',
				default: 'gpt-4',
				description: localize('newma.backend.model', 'AI model name (e.g., gpt-4, gpt-3.5-turbo, deepseek-chat)'),
				order: 2
			},
			'newma.backend.apiUrl': {
				type: 'string',
				default: 'https://api.openai.com/v1/chat/completions',
				description: localize('newma.backend.apiUrl', 'AI provider API endpoint URL'),
				markdownDescription: localize('newma.backend.apiUrl.md', 'AI provider API endpoint URL. Examples:\n- OpenAI: https://api.openai.com/v1/chat/completions\n- DeepSeek: https://api.deepseek.com/v1/chat/completions\n- Anthropic: https://api.anthropic.com/v1/messages'),
				order: 3
			},
			'newma.backend.baseUrl': {
				type: 'string',
				default: productService?.newma?.backend?.baseUrl ?? 'http://127.0.0.1:3901',
				description: localize('newma.backend.baseUrl', 'Newma backend service base URL (localhost service)'),
				markdownDescription: localize('newma.backend.baseUrl.md', 'Local backend service URL. This is the Newma AI backend server that proxies requests to AI providers. Default: http://127.0.0.1:3901'),
				order: 4
			},
			'newma.backend.timeoutMs': {
				type: 'number',
				minimum: 5000,
				maximum: 600000,
				default: productService?.newma?.backend?.timeoutMs ?? 180000,
				description: localize('newma.backend.timeoutMs', 'Newma backend request timeout in milliseconds'),
				order: 5
			}
			,
			'newma.agent.enabled': {
				type: 'boolean',
				default: false,
				description: localize('newma.agent.enabled', 'Enable Newma Agent mode (experimental). When enabled, the Newma chat participant supports Agent mode in addition to Ask.'),
				order: 10
			},
			'newma.agent.maxSteps': {
				type: 'number',
				default: 10,
				minimum: 1,
				maximum: 100,
				description: localize('newma.agent.maxSteps', 'Maximum number of steps the Agent can execute in a single run.'),
				order: 11
			},
			'newma.agent.autoApprove': {
				type: 'boolean',
				default: false,
				description: localize('newma.agent.autoApprove', 'Automatically approve Agent steps without prompting (use with caution).'),
				order: 12
			}
		}
	});

	// Commands: hide quick input based Ask/Agent flows to avoid弹窗
	// registerAction2(NewmaAgentCommand);
	// registerAction2(NewmaAskCommand);
	registerAction2(NewmaPlanCommand);
	registerAction2(NewmaCutoverInfoCommand);
	registerAction2(NewmaConfigureCommand);

	// Register menu item in Chat settings dropdown
	MenuRegistry.appendMenuItem(CHAT_CONFIG_MENU_ID, {
		command: {
			id: 'newma.configure',
			title: localize2('newma.configure.short', 'Configure Newma AI'),
			icon: Codicon.settingsGear
		},
		when: ContextKeyExpr.equals('view', ChatViewId),
		order: 13,
		group: '0_level'
	});

	// Chat input attachment toolbar (left): Mode selector (custom UI)
	// Register a single action that shows different labels based on context key
	registerAction2(class NewmaSelectMode extends Action2 {
		constructor() {
			super({
				id: 'newma.chat.selectMode',
				title: localize2('newma.selectMode', 'Select Newma Mode'),
				f1: false,
				menu: {
					id: MenuId.ChatInputAttachmentToolbar,
					when: ContextKeyExpr.and(
						ContextKeyExpr.equals('view', ChatViewId),
						ChatContextKeys.location.isEqualTo(ChatAgentLocation.Chat)
					),
					order: 2,
					group: 'navigation'
				}
			});
			console.log('[NewmaSelectMode] Action2 registered with menu:', {
				id: 'newma.chat.selectMode',
				menuId: MenuId.ChatInputAttachmentToolbar.id,
				when: 'view == ChatViewId'
			});
		}
		async run(accessor: ServicesAccessor): Promise<void> {
			console.log('[NewmaSelectMode] run() called - this should not happen, custom ActionViewItem should handle it');
			// This is handled by the custom ActionViewItem
		}
	});

	// Workbench Contribution to register ActionViewItem at the right time
	class NewmaModeSelectorContribution extends Disposable implements IWorkbenchContribution {
		static readonly ID = 'newma.modeSelectorContribution';

		constructor(
			@IActionViewItemService private readonly actionViewItemService: IActionViewItemService,
			@IContextKeyService private readonly contextKeyService: IContextKeyService,
			@IContextViewService private readonly contextViewService: IContextViewService,
		) {
			super();
			const menuIdStr = MenuId.ChatInputAttachmentToolbar.id;
			const commandId = 'newma.chat.selectMode';
			const key = `${menuIdStr}/${commandId}`;
			console.log('[NewmaModeSelector] Registering ActionViewItem via WorkbenchContribution', {
				menuId: MenuId.ChatInputAttachmentToolbar,
				menuIdStr,
				commandId,
				key,
				service: this.actionViewItemService.constructor.name
			});

			const registered = this.actionViewItemService.register(MenuId.ChatInputAttachmentToolbar, commandId, (action, options, instantiationService, windowId) => {
				console.log('[NewmaModeSelector] ActionViewItem provider called!', {
					actionId: action.id,
					expectedId: commandId,
					match: action.id === commandId,
					actionType: action.constructor.name,
					actionLabel: action.label,
					options,
					windowId,
					stack: new Error().stack
				});
				const viewItem = new NewmaModeSelectorActionViewItem(this.contextKeyService, action, this.contextViewService);
				console.log('[NewmaModeSelector] Created ActionViewItem:', viewItem);
				return viewItem;
			});
			this._register(registered);

			console.log('[NewmaModeSelector] ActionViewItem registered, disposable:', registered);

			// Also log what we can look up
			const lookupResult = this.actionViewItemService.lookUp(MenuId.ChatInputAttachmentToolbar, commandId);
			console.log('[NewmaModeSelector] Lookup result:', lookupResult ? 'FOUND' : 'NOT FOUND');

			// Listen for when the toolbar is created/updated
			this.actionViewItemService.onDidChange((changedMenuId) => {
				console.log('[NewmaModeSelector] ActionViewItemService changed for menu:', changedMenuId);
				if (changedMenuId === MenuId.ChatInputAttachmentToolbar) {
					const lookupResult2 = this.actionViewItemService.lookUp(MenuId.ChatInputAttachmentToolbar, commandId);
					console.log('[NewmaModeSelector] Lookup result after change:', lookupResult2 ? 'FOUND' : 'NOT FOUND');
				}
			});

			// Debug: Log what MenuWorkbenchToolBar will look for
			console.log('[NewmaModeSelector] Expected lookup key:', `${MenuId.ChatInputAttachmentToolbar.id}/${commandId}`);

			// Listen to ActionViewItemService changes to see if provider is requested
			this._register(this.actionViewItemService.onDidChange(menuId => {
				console.log('[NewmaModeSelector] ActionViewItemService changed for menu:', menuId);
				if (menuId === MenuId.ChatInputAttachmentToolbar) {
					console.log('[NewmaModeSelector] ChatInputAttachmentToolbar menu changed, checking lookup again...');
					const lookupResult2 = this.actionViewItemService.lookUp(MenuId.ChatInputAttachmentToolbar, commandId);
					console.log('[NewmaModeSelector] Lookup result after menu change:', lookupResult2 ? 'FOUND' : 'NOT FOUND');
				}
			}));

			// Also try to manually trigger lookup periodically to see if it works
			setTimeout(() => {
				const lookupResult3 = this.actionViewItemService.lookUp(MenuId.ChatInputAttachmentToolbar, commandId);
				console.log('[NewmaModeSelector] Delayed lookup (1s):', lookupResult3 ? 'FOUND' : 'NOT FOUND');
			}, 1000);

			setTimeout(() => {
				const lookupResult4 = this.actionViewItemService.lookUp(MenuId.ChatInputAttachmentToolbar, commandId);
				console.log('[NewmaModeSelector] Delayed lookup (3s):', lookupResult4 ? 'FOUND' : 'NOT FOUND');
			}, 3000);
		}
	}

	// Custom ActionViewItem that renders the mode selector with custom UI
	class NewmaModeSelectorActionViewItem extends BaseActionViewItem {
		private modeSelector: NewmaModeSelector | undefined;
		private readonly modes: IModeOption[] = [
			{ id: 'ask', label: 'Ask', icon: Codicon.commentDiscussion },
			{ id: 'plan', label: 'Plan', icon: Codicon.listTree },
			{ id: 'agent', label: 'Agent', icon: Codicon.sparkle }
		];

		constructor(
			private readonly contextKeyService: IContextKeyService,
			action: IAction,
			@IContextViewService private readonly contextViewService: IContextViewService
		) {
			super(null, action);
		}

		override render(container: HTMLElement): void {
			console.log('[NewmaModeSelectorActionViewItem] render called', {
				container,
				containerTag: container.tagName,
				containerClass: container.className,
				containerId: container.id,
				actionId: this._action.id,
				actionLabel: this._action.label,
				actionType: this._action.constructor.name
			});

			// Set element directly without calling super.render() to avoid default click handlers
			this.element = container;

			// Get current mode
			const currentMode = this.contextKeyService.getContextKeyValue<string>('newma.chat.mode') || 'ask';
			console.log('[NewmaModeSelectorActionViewItem] currentMode:', currentMode);

			// Create mode selector - this will create the button inside container
			this.modeSelector = new NewmaModeSelector(container, {
				modes: this.modes,
				currentMode,
				onModeSelected: (modeId: string) => {
					console.log('[NewmaModeSelectorActionViewItem] mode selected:', modeId);
					this.contextKeyService.createKey('newma.chat.mode', modeId).set(modeId);
				}
			}, this.contextViewService);
			console.log('[NewmaModeSelectorActionViewItem] modeSelector created:', this.modeSelector);

			// Listen for mode changes to update the selector
			this._register(this.contextKeyService.onDidChangeContext(e => {
				if (e.affectsSome(new Set(['newma.chat.mode']))) {
					const newMode = this.contextKeyService.getContextKeyValue<string>('newma.chat.mode') || 'ask';
					if (this.modeSelector) {
						// Update mode selector's current mode
						this.modeSelector.updateOptions({ currentMode: newMode });
					}
				}
			}));
		}

		override onClick(event: any): void {
			// Prevent default action behavior - we handle clicks in the mode selector itself
			// Do nothing here, let the mode selector handle it
		}

		override dispose(): void {
			if (this.modeSelector) {
				this.modeSelector.dispose();
				this.modeSelector = undefined;
			}
			super.dispose();
		}
	}

	// History Popup Contribution - intercepts history session clicks to show custom popup
	class NewmaHistoryPopupContribution extends Disposable implements IWorkbenchContribution {
		static readonly ID = 'newma.historyPopupContribution';

		private historyPopup: NewmaHistoryPopup | undefined;
		private isIntercepting = false;

		private currentSessionId: string | null = null;

		constructor(
			@IContextKeyService private readonly contextKeyService: IContextKeyService,
			@IContextViewService private readonly contextViewService: IContextViewService,
			@IViewsService private readonly viewsService: IViewsService,
			@IChatService private readonly chatService: IChatService,
			@IQuickInputService private readonly quickInputService: IQuickInputService,
			@INotificationService private readonly notificationService: INotificationService,
		) {
			super();

			// Only intercept if Newma is enabled
			const newmaEnabled = this.contextKeyService.getContextKeyValue('newma.coreEnabled');
			if (!newmaEnabled) {
				return;
			}

			// Initialize history popup
			this.historyPopup = new NewmaHistoryPopup({
				actions: [
					{ id: 'open', label: localize2('newma.history.action.open', 'Open').value, icon: Codicon.goToFile },
					{ id: 'rename', label: localize2('newma.history.action.rename', 'Rename').value, icon: Codicon.edit },
					{ id: 'delete', label: localize2('newma.history.action.delete', 'Delete').value, icon: Codicon.trash },
				],
				onActionSelected: (actionId) => this.handleAction(actionId)
			}, this.contextViewService);

			// Listen for clicks on history items
			// Use capture phase to intercept before default handlers
			const targetWindow = getWindow(document.body);
			this._register(addDisposableListener(targetWindow.document.body, EventType.CLICK, (e) => {
				if (this.isIntercepting) {
					return;
				}

				const target = e.target as HTMLElement;
				if (!target) {
					return;
				}

				// Check if clicked element is a chat session item
				const sessionItem = target.closest('.chat-session-item, .chat-welcome-history-item');
				if (!sessionItem) {
					return;
				}

				// Check if it's a history item (not a current session)
				const isHistoryItem = sessionItem.classList.contains('chat-welcome-history-item') ||
					sessionItem.getAttribute('data-history-item') === 'true' ||
					sessionItem.closest('[data-history-item="true"]') !== null;

				if (!isHistoryItem) {
					return;
				}

				// Prevent default behavior
				e.stopPropagation();
				e.preventDefault();
				this.isIntercepting = true;

				// Get session ID from DOM attributes or parent chain
				const ariaLabel = sessionItem.getAttribute('aria-label');
				let sessionId = (sessionItem as HTMLElement).getAttribute('data-session-id');
				if (!sessionId) {
					sessionId = this.extractSessionId(sessionItem as HTMLElement, ariaLabel);
				}

				if (sessionId) {
					// Store session ID for action handling
					this.currentSessionId = sessionId;
					// Show custom popup
					this.historyPopup?.show(sessionItem as HTMLElement);
				}

				// Reset intercepting flag after a short delay
				setTimeout(() => {
					this.isIntercepting = false;
				}, 100);
			}, true)); // Use capture phase
		}

		private extractSessionId(element: HTMLElement, ariaLabel: string | null): string | null {
			// Try to get from data attribute
			const dataSessionId = element.getAttribute('data-session-id');
			if (dataSessionId) {
				return dataSessionId;
			}

			// Try to find in parent elements
			let current: HTMLElement | null = element.parentElement;
			while (current) {
				const id = current.getAttribute('data-session-id');
				if (id) {
					return id;
				}
				current = current.parentElement;
			}

			// Try to extract from aria-label (last resort)
			// This is not reliable, but better than nothing
			if (ariaLabel) {
				// Extract session ID if it's in the label
				const match = ariaLabel.match(/session[:\s]+([^\s]+)/i);
				if (match) {
					return match[1];
				}
			}

			return null;
		}

		private async handleAction(actionId: string): Promise<void> {
			const sessionId = this.currentSessionId;
			if (!sessionId) {
				return;
			}

			try {
				if (actionId === 'open') {
					// Open session in chat view
					const chatViewPane = await this.viewsService.openView(ChatViewId) as ChatViewPane;
					if (chatViewPane) {
						await chatViewPane.loadSession(sessionId);
					}
				} else if (actionId === 'rename') {
					const currentTitle = this.chatService.getSession(sessionId)?.title
						?? this.chatService.getPersistedSessionTitle(sessionId)
						?? '';
					const title = await this.quickInputService.input({ title: 'Rename chat', value: currentTitle });
					if (title && title.trim().length > 0) {
						this.chatService.setChatSessionTitle(sessionId, title.trim());
						this.notificationService.notify({ severity: Severity.Info, message: 'Chat renamed' });
					}
				} else if (actionId === 'delete') {
					const pick = await this.quickInputService.pick([
						{ label: '$(trash) Delete', id: 'confirm' },
						{ label: '$(close) Cancel', id: 'cancel' }
					], { placeHolder: 'Delete this chat permanently?' });
					if (pick && (pick as any).id === 'confirm') {
						this.chatService.removeHistoryEntry(sessionId);
						this.notificationService.notify({ severity: Severity.Info, message: 'Chat deleted' });
					}
				}
			} catch (error) {
				console.error('[NewmaHistoryPopup] Failed to handle action:', error);
			} finally {
				this.currentSessionId = null;
			}
		}

		override dispose(): void {
			if (this.historyPopup) {
				this.historyPopup.dispose();
				this.historyPopup = undefined;
			}
			super.dispose();
		}
	}

	// Register WorkbenchContribution to register ActionViewItem at the right time
	// This ensures all services are ready when we register
	// Use WorkbenchPhase.BlockRestore to ensure provider is registered before ChatInputPart creates toolbar
	registerWorkbenchContribution2(NewmaModeSelectorContribution.ID, NewmaModeSelectorContribution, WorkbenchPhase.BlockRestore);
	registerWorkbenchContribution2(NewmaHistoryPopupContribution.ID, NewmaHistoryPopupContribution, WorkbenchPhase.Eventually);

	// Custom ActionViewItem for Show Chats button - intercepts click and uses button element directly
	class NewmaShowChatsActionViewItem extends ActionViewItem {
		private button: HTMLElement | undefined;
		private openContextView: { close: () => void } | undefined;
		private closing = false;

		constructor(
			action: IAction,
			options: IActionViewItemOptions,
			@IContextViewService private readonly contextViewService: IContextViewService,
			@IViewsService private readonly viewsService: IViewsService,
			@IChatService private readonly chatService: IChatService
		) {
			super(null, action, options);
			console.log('[NewmaShowChatsActionViewItem] constructor called for action:', action.id, action.label);
		}

		private setPressedState(pressed: boolean) {
			if (this.button) {
				this.button.classList.toggle('pressed', pressed);
				this.button.setAttribute('aria-pressed', String(pressed));
				this.button.setAttribute('aria-expanded', String(pressed));
			}
		}

		override render(container: HTMLElement): void {
			console.log('[NewmaShowChatsActionViewItem] render() called', container);
			super.render(container);
			this.button = this.label as HTMLElement || container.querySelector('.action-label') as HTMLElement || container as HTMLElement;
			if (this.button) {
				this.button.setAttribute('role', 'button');
				this.button.setAttribute('aria-haspopup', 'true');
				this.button.setAttribute('aria-pressed', 'false');
				// mousedown: set pressed but do NOT open (align with settings)
				this.button.addEventListener('mousedown', (e) => {
					this.setPressedState(true);
				}, true);
			}
		}

		override onClick(event: EventLike): void {
			console.log('[NewmaShowChatsActionViewItem] onClick() called', event);
			EventHelper.stop(event, true);
			if (this.openContextView) {
				// Guard: mark closing to avoid immediate reopen via subsequent click processing
				this.closing = true;
				this.contextViewService.hideContextView();
				queueMicrotask(() => { this.closing = false; });
				return;
			}
			if (this.button) {
				this.setPressedState(true);
				this.showPopup(this.button);
			}
		}

		private async showPopup(anchor: HTMLElement): Promise<void> {
			if (this.closing) { return; }
			try {
				await this.viewsService.openView(ChatViewId);
				const history = await this.chatService.getHistory();

				const openHandle = this.contextViewService.showContextView({
					getAnchor: () => anchor,
					anchorAlignment: AnchorAlignment.LEFT,
					render: (container: HTMLElement) => {
						container.classList.add('newma-history-popup');

						const targetWindow = getWindow(container);

						// click outside (capture) but ignore anchor & container
						const handleClickOutside = (e: MouseEvent) => {
							const event = new StandardMouseEvent(targetWindow, e);
							if (event.rightButton) { return; }
							const t = event.target as HTMLElement | null;
							if (t && (anchor.contains(t) || container.contains(t))) { return; }
							this.setPressedState(false);
							this.contextViewService.hideContextView();
						};
						// mousedown handler - match ContextMenuHandler behavior and check for draggable regions
						const handleMouseDown = (e: MouseEvent) => {
							// Check defaultPrevented like ContextMenuHandler does
							if (e.defaultPrevented) {
								return;
							}

							const event = new StandardMouseEvent(targetWindow, e);
							let element: HTMLElement | null = event.target;

							// Don't do anything as we are likely creating a context menu
							if (event.rightButton) {
								return;
							}

							// Check if target is inside container (like ContextMenuHandler does)
							while (element) {
								if (element === container || element === anchor) {
									return; // Inside container or anchor, don't close
								}
								element = element.parentElement;
							}

							// Check if target or any parent has -webkit-app-region: drag (draggable area)
							// This is the key: draggable regions use this CSS property
							let checkElement: HTMLElement | null = event.target;
							while (checkElement) {
								const style = targetWindow.getComputedStyle(checkElement);
								const appRegion = style.getPropertyValue('-webkit-app-region');
								if (appRegion.trim() === 'drag') {
									// Click is in draggable region, close popup
									this.setPressedState(false);
									this.contextViewService.hideContextView();
									return;
								}
								checkElement = checkElement.parentElement;
							}

							// Not inside container, anchor, or draggable region - close
							this.setPressedState(false);
							this.contextViewService.hideContextView();
						};
						// mouseup anywhere: clear pressed
						const handleMouseUpAny = () => {
							this.setPressedState(false);
						};

						const clickDisposable = addDisposableListener(targetWindow, EventType.CLICK, handleClickOutside, true);
						const mouseDownDisposable = addDisposableListener(targetWindow, EventType.MOUSE_DOWN, handleMouseDown, true);
						const mouseUpDisposable = addDisposableListener(targetWindow, EventType.MOUSE_UP, handleMouseUpAny, true);
						const blurDisposable = addDisposableListener(targetWindow, EventType.BLUR, () => { this.setPressedState(false); this.contextViewService.hideContextView(); });
						const escapeKeyDisposable = addDisposableListener(targetWindow.document, EventType.KEY_DOWN, (e: KeyboardEvent) => {
							if (e.key === 'Escape') { this.setPressedState(false); this.contextViewService.hideContextView(); }
						});

						if (!history || history.length === 0) {
							const row = append(container, $('div.newma-history-action'));
							row.tabIndex = 0;
							const label = append(row, $('span.newma-history-action-label'));
							label.textContent = 'No chats yet';
						} else {
							for (const item of history) {
								const row = append(container, $('div.newma-history-action'));
								row.tabIndex = 0;
								const label = append(row, $('span.newma-history-action-label'));
								label.textContent = item.title || `Chat ${item.sessionId}`;
								row.addEventListener('click', async (e: MouseEvent) => {
									e.preventDefault();
									e.stopPropagation();
									const view = await this.viewsService.openView<ChatViewPane>(ChatViewId);
									await view?.loadSession?.(item.sessionId);
									this.setPressedState(false);
									this.contextViewService.hideContextView();
								});
							}
						}

						return {
							dispose: () => {
								clickDisposable.dispose();
								mouseDownDisposable.dispose();
								mouseUpDisposable.dispose();
								blurDisposable.dispose();
								escapeKeyDisposable.dispose();
								this.openContextView = undefined;
								this.setPressedState(false);
							}
						};
					}
				});
				this.openContextView = openHandle;
			} catch (err) {
				console.error('[NewmaShowChatsActionViewItem] showPopup() error:', err);
				this.openContextView = undefined;
				this.setPressedState(false);
			}
		}
	}

	// Register ActionViewItem provider for the Show Chats button
	// We intercept the NATIVE command 'workbench.action.chat.history' instead of creating a new one
	class NewmaShowChatsContribution extends Disposable implements IWorkbenchContribution {
		static readonly ID = 'newma.showChatsContribution';

		constructor(
			@IActionViewItemService private readonly actionViewItemService: IActionViewItemService,
			@IContextViewService private readonly contextViewService: IContextViewService,
			@IViewsService private readonly viewsService: IViewsService,
			@IChatService private readonly chatService: IChatService
		) {
			super();

			console.log('[NewmaShowChatsContribution] Registering ActionViewItem provider for workbench.action.chat.history');

			// Register ActionViewItem provider for the NATIVE command 'workbench.action.chat.history'
			// This intercepts the native button and uses our custom UI
			this._register(this.actionViewItemService.register(
				MenuId.ViewTitle,
				'workbench.action.chat.history',
				(action, options, instantiationService) => {
					console.log('[NewmaShowChatsContribution] ActionViewItem provider called for workbench.action.chat.history', {
						actionId: action.id,
						actionLabel: action.label,
						actionEnabled: action.enabled,
						options,
						instantiationService: !!instantiationService
					});
					try {
						const viewItem = new NewmaShowChatsActionViewItem(
							action,
							options ?? {},
							this.contextViewService,
							this.viewsService,
							this.chatService
						);
						console.log('[NewmaShowChatsContribution] Successfully created ActionViewItem:', viewItem);
						return viewItem;
					} catch (error) {
						console.error('[NewmaShowChatsContribution] Error creating ActionViewItem:', error);
						// Return undefined to fallback to default implementation
						return undefined;
					}
				}
			));

			this._register(this.actionViewItemService.register(
				MenuId.EditorTitle,
				'workbench.action.chat.history',
				(action, options, instantiationService) => {
					console.log('[NewmaShowChatsContribution] ActionViewItem provider called for MenuId.EditorTitle', action.id);
					return new NewmaShowChatsActionViewItem(
						action,
						options ?? {},
						this.contextViewService,
						this.viewsService,
						this.chatService
					);
				}
			));

			this._register(this.actionViewItemService.register(
				MenuId.ChatHistory,
				'workbench.action.chat.history',
				(action, options, instantiationService) => {
					console.log('[NewmaShowChatsContribution] ActionViewItem provider called for MenuId.ChatHistory', action.id);
					return new NewmaShowChatsActionViewItem(
						action,
						options ?? {},
						this.contextViewService,
						this.viewsService,
						this.chatService
					);
				}
			));
		}
	}

	// Register the contribution EARLY to ensure provider is available when toolbar is created
	registerWorkbenchContribution2(NewmaShowChatsContribution.ID, NewmaShowChatsContribution, WorkbenchPhase.BlockRestore);

	// File side-effect interception contribution
	Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(NewmaFileInterception, LifecyclePhase.Eventually);
	registerAction2(NewmaDiagnosticsCommand);

	// Status bar entry removed per design; keep only early bootstrap
	const workbenchRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
	// workbenchRegistry.registerWorkbenchContribution(NewmaStatusContribution, LifecyclePhase.Restored);
	// Register hide Copilot contribution early (before ChatStatusBarEntry which uses BlockRestore)
	workbenchRegistry.registerWorkbenchContribution(NewmaHideCopilotContribution, LifecyclePhase.Restored);
	workbenchRegistry.registerWorkbenchContribution(NewmaAgentBootstrapContribution, LifecyclePhase.Restored);
	// Note: NewmaModeSelectorContribution is already registered above (line 616)

	// Views: Register a minimal Plan panel with a single view
	// const planIcon = registerIcon('newma-plan-view-icon', Codicon.listTree, localize('newmaPlanViewIcon', 'View icon of the Newma plan view.'));

	// Remove Newma side views per latest requirement (keep Chat-native integration only)

	// dynamic agent previously registered here has moved to early bootstrap to avoid races

	// Optionally hide builtin Chat via a context key many chat when-clauses can observe
	if (disableBuiltinChat) {
		Registry.as<any>(WorkbenchExtensions.Workbench).instantiationService?.invokeFunction((accessor: ServicesAccessor) => {
			const contextKeyService = accessor.get(IContextKeyService);
			contextKeyService.createKey('newma.disableBuiltinChat', true);
		});
	}
})();


