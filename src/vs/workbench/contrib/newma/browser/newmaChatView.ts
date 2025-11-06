/*---------------------------------------------------------------------------------------------
 *  Newma AI - Enhanced Chat View with Streaming Support
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IAction, Action } from '../../../../base/common/actions.js';
import { INewmaAiService } from '../../../../platform/newmaAi/common/newmaAi.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { renderIcon } from '../../../../base/browser/ui/iconLabel/iconLabels.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number; // Store as number for serialization
    isStreaming?: boolean;
}

interface ChatMessageSerializable {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

export class NewmaChatView extends ViewPane {
    static readonly ID = 'workbench.view.newma.chat';
    static readonly TITLE = localize('newmaChatView.title', 'Newma Chat');

    private messagesEl!: HTMLElement;
    private inputEl!: HTMLTextAreaElement;
    private sendBtn!: HTMLButtonElement;
    private modeSelect!: HTMLSelectElement;
    private disposables = new DisposableStore();
    private messageHistory: ChatMessage[] = [];
    private currentStreamingMessage: ChatMessage | null = null;
    private isProcessing = false;

    private static readonly STORAGE_KEY = 'newma.chat.history';

    constructor(
        options: { id: string; title: string },
        @IKeybindingService keybindingService: IKeybindingService,
        @IContextMenuService contextMenuService: IContextMenuService,
        @IConfigurationService configurationService: IConfigurationService,
        @IContextKeyService contextKeyService: any,
        @IViewDescriptorService viewDescriptorService: IViewDescriptorService,
        @IInstantiationService instantiationService: IInstantiationService,
        @IOpenerService openerService: IOpenerService,
        @IThemeService themeService: IThemeService,
        @IHoverService hoverService: IHoverService,
        @IStorageService private readonly storageService: IStorageService,
    ) {
        super(options as any, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
        this.loadHistory();
    }

    override renderBody(container: HTMLElement): void {
        super.renderBody(container);

        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.height = '100%';

        // Messages container with styling
        this.messagesEl = document.createElement('div');
        this.messagesEl.className = 'newma-chat-messages';
        this.messagesEl.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            background: var(--vscode-editor-background);
        `;
        container.appendChild(this.messagesEl);

        // Load and render history or show welcome message
        if (this.messageHistory.length > 0) {
            this.renderHistory();
        } else {
            this.appendWelcomeMessage();
        }

        // Input bar with improved styling
        const inputBar = document.createElement('div');
        inputBar.className = 'newma-chat-input-bar';
        inputBar.style.cssText = `
            display: flex;
            gap: 8px;
            padding: 12px;
            border-top: 1px solid var(--vscode-panel-border);
            background: var(--vscode-editor-background);
        `;
        container.appendChild(inputBar);

        // Mode selector
        this.modeSelect = document.createElement('select');
        this.modeSelect.style.cssText = `
            padding: 6px 8px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
        `;
        const modes = [
            { value: 'ask', label: localize('newma.mode.ask', 'Ask') },
            { value: 'plan', label: localize('newma.mode.plan', 'Plan') },
            { value: 'agent', label: localize('newma.mode.agent', 'Agent') },
        ];
        for (const m of modes) {
            const opt = document.createElement('option');
            opt.value = m.value; opt.textContent = m.label; this.modeSelect.appendChild(opt);
        }
        inputBar.appendChild(this.modeSelect);

        // Textarea input
        this.inputEl = document.createElement('textarea');
        this.inputEl.className = 'newma-chat-input';
        this.inputEl.rows = 2;
        this.inputEl.placeholder = localize('newmaChat.input.ph', 'Ask Newma...');
        this.inputEl.style.cssText = `
            flex: 1;
            resize: none;
            padding: 8px 12px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            border-radius: 4px;
        `;

        // Handle Enter key (Shift+Enter for new line)
        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !this.isProcessing) {
                e.preventDefault();
                this.handleSend();
            }
        });

        inputBar.appendChild(this.inputEl);

        // Send button
        this.sendBtn = document.createElement('button');
        this.sendBtn.className = 'newma-chat-send';
        this.sendBtn.textContent = localize('newmaChat.send', 'Send');
        this.sendBtn.style.cssText = `
            padding: 8px 16px;
            border: none;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
            border-radius: 4px;
            font-weight: 500;
        `;
        this.sendBtn.addEventListener('click', () => this.handleSend());
        this.sendBtn.addEventListener('mouseenter', () => {
            if (!this.isProcessing) {
                this.sendBtn.style.background = 'var(--vscode-button-hoverBackground)';
            }
        });
        this.sendBtn.addEventListener('mouseleave', () => {
            if (!this.isProcessing) {
                this.sendBtn.style.background = 'var(--vscode-button-background)';
            }
        });
        inputBar.appendChild(this.sendBtn);

        this.disposables.add({ dispose: () => { /* no-op */ } });
    }

    private appendWelcomeMessage(): void {
        const welcomeEl = document.createElement('div');
        welcomeEl.className = 'newma-chat-welcome';
        welcomeEl.style.cssText = `
            text-align: center;
            padding: 32px 16px;
            color: var(--vscode-descriptionForeground);
        `;
        const iconEl = document.createElement('div');
        iconEl.style.cssText = 'font-size: 24px; margin-bottom: 8px;';
        iconEl.appendChild(renderIcon(Codicon.sparkle));
        welcomeEl.appendChild(iconEl);

        const titleEl = document.createElement('div');
        titleEl.style.cssText = 'font-size: 16px; font-weight: 500; margin-bottom: 4px;';
        titleEl.textContent = localize('newmaChat.welcome.title', 'Welcome to Newma AI');
        welcomeEl.appendChild(titleEl);

        const subtitleEl = document.createElement('div');
        subtitleEl.style.cssText = 'font-size: 13px;';
        subtitleEl.textContent = localize('newmaChat.welcome.subtitle', 'Ask me anything about your code');
        welcomeEl.appendChild(subtitleEl);
        this.messagesEl.appendChild(welcomeEl);
    }

    private createMessageElement(message: ChatMessage): HTMLElement {
        const messageEl = document.createElement('div');
        messageEl.className = `newma-chat-message newma-chat-message-${message.role}`;
        messageEl.dataset.messageId = message.id;

        const isUser = message.role === 'user';
        messageEl.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding: 12px 16px;
            border-radius: 8px;
            max-width: 85%;
            ${isUser
                ? `align-self: flex-end; background: var(--vscode-button-background); color: var(--vscode-button-foreground);`
                : `align-self: flex-start; background: var(--vscode-textBlockQuote-background); border-left: 4px solid var(--vscode-textBlockQuote-border);`}
        `;

        const headerEl = document.createElement('div');
        headerEl.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            font-weight: 500;
            opacity: 0.8;
            margin-bottom: 4px;
        `;
        headerEl.textContent = isUser
            ? localize('newmaChat.message.you', 'You')
            : localize('newmaChat.message.newma', 'Newma AI');
        messageEl.appendChild(headerEl);

        const contentEl = document.createElement('div');
        contentEl.className = 'newma-chat-message-content';
        contentEl.style.cssText = `
            white-space: pre-wrap;
            word-wrap: break-word;
            line-height: 1.5;
            font-size: 13px;
        `;
        contentEl.textContent = message.content;
        messageEl.appendChild(contentEl);

        const timeEl = document.createElement('div');
        timeEl.style.cssText = `
            font-size: 11px;
            opacity: 0.6;
            margin-top: 4px;
        `;
        const timestamp = typeof message.timestamp === 'number' ? new Date(message.timestamp) : new Date(message.timestamp);
        timeEl.textContent = timestamp.toLocaleTimeString();
        messageEl.appendChild(timeEl);

        if (message.isStreaming) {
            const indicatorEl = document.createElement('span');
            indicatorEl.className = 'newma-chat-streaming-indicator codicon codicon-loading codicon-modifier-spin';
            indicatorEl.style.cssText = `
                display: inline-block;
                margin-left: 8px;
            `;
            headerEl.appendChild(indicatorEl);
        }

        return messageEl;
    }

    private updateMessageElement(messageId: string, content: string): void {
        const messageEl = this.messagesEl.querySelector(`[data-message-id="${messageId}"]`) as HTMLElement;
        if (messageEl) {
            const contentEl = messageEl.querySelector('.newma-chat-message-content') as HTMLElement;
            if (contentEl) {
                contentEl.textContent = content;
                this.scrollToBottom();
            }
        }
    }

    private finishStreamingMessage(messageId: string): void {
        const messageEl = this.messagesEl.querySelector(`[data-message-id="${messageId}"]`) as HTMLElement;
        if (messageEl) {
            const indicatorEl = messageEl.querySelector('.newma-chat-streaming-indicator') as HTMLElement;
            if (indicatorEl) {
                indicatorEl.remove();
            }
            const message = this.messageHistory.find(m => m.id === messageId);
            if (message) {
                message.isStreaming = false;
            }
        }
    }

    private appendMessage(message: ChatMessage): void {
        // Remove welcome message if present
        const welcomeEl = this.messagesEl.querySelector('.newma-chat-welcome');
        if (welcomeEl) {
            welcomeEl.remove();
        }

        this.messageHistory.push(message);
        const messageEl = this.createMessageElement(message);
        this.messagesEl.appendChild(messageEl);
        this.scrollToBottom();
    }

    private scrollToBottom(): void {
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }

    private loadHistory(): void {
        const stored = this.storageService.get(NewmaChatView.STORAGE_KEY, StorageScope.WORKSPACE);
        if (stored) {
            try {
                const serializable: ChatMessageSerializable[] = JSON.parse(stored);
                this.messageHistory = serializable.map(msg => ({
                    id: msg.id,
                    role: msg.role,
                    content: msg.content,
                    timestamp: msg.timestamp
                }));
            } catch (e) {
                // Invalid data, clear it
                this.storageService.remove(NewmaChatView.STORAGE_KEY, StorageScope.WORKSPACE);
            }
        }
    }

    private saveHistory(): void {
        const serializable: ChatMessageSerializable[] = this.messageHistory
            .filter(msg => !msg.isStreaming) // Don't save streaming messages
            .map(msg => ({
                id: msg.id,
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp // Already a number
            }));
        this.storageService.store(
            NewmaChatView.STORAGE_KEY,
            JSON.stringify(serializable),
            StorageScope.WORKSPACE,
            StorageTarget.USER
        );
    }

    private renderHistory(): void {
        // Remove welcome message if present
        const welcomeEl = this.messagesEl.querySelector('.newma-chat-welcome');
        if (welcomeEl) {
            welcomeEl.remove();
        }

        // Render all messages
        for (const message of this.messageHistory) {
            const messageEl = this.createMessageElement(message);
            this.messagesEl.appendChild(messageEl);
        }
        this.scrollToBottom();
    }

    private generateMessageId(): string {
        return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private async handleSend(): Promise<void> {
        const prompt = (this.inputEl.value || '').trim();
        if (!prompt || this.isProcessing) { return; }

        this.isProcessing = true;
        this.inputEl.value = '';
        this.inputEl.disabled = true;
        this.sendBtn.disabled = true;
        this.sendBtn.textContent = localize('newmaChat.sending', 'Sending...');
        this.sendBtn.style.opacity = '0.6';
        this.sendBtn.style.cursor = 'not-allowed';

        // Create user message
        const userMessage: ChatMessage = {
            id: this.generateMessageId(),
            role: 'user',
            content: prompt,
            timestamp: Date.now()
        };
        this.appendMessage(userMessage);

        // Create assistant message placeholder for streaming
        const assistantMessage: ChatMessage = {
            id: this.generateMessageId(),
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            isStreaming: true
        };
        this.appendMessage(assistantMessage);
        this.currentStreamingMessage = assistantMessage;

        try {
            const ai = (this as any).instantiationService.invokeFunction((accessor: ServicesAccessor) => accessor.get(INewmaAiService));

            const mode = this.modeSelect.value;
            if (mode === 'plan') {
                // For plan mode, call buildPlan and render summary
                const steps = await ai.buildPlan(prompt);
                const summary = steps.map((s: { index: number; title: string }) => `${s.index}. ${s.title}`).join('\n');
                this.currentStreamingMessage!.content = summary;
                this.updateMessageElement(this.currentStreamingMessage!.id, summary);
            } else if (mode === 'agent') {
                // Placeholder for agent mode
                const text = localize('newma.agent.placeholder', '[Agent] Planning and execution will be implemented in MVP.');
                this.currentStreamingMessage!.content = text;
                this.updateMessageElement(this.currentStreamingMessage!.id, text);
            } else {
                // Ask mode: streaming generate
                let accumulatedContent = '';
                await ai.generateResponse(prompt, {
                    onProgress: (chunk: string) => {
                        if (this.currentStreamingMessage && chunk) {
                            accumulatedContent += chunk;
                            this.currentStreamingMessage.content = accumulatedContent;
                            this.updateMessageElement(this.currentStreamingMessage.id, accumulatedContent);
                        }
                    }
                });
            }

            // Finalize the message
            if (this.currentStreamingMessage) {
                this.finishStreamingMessage(this.currentStreamingMessage.id);
                if (!this.currentStreamingMessage.content.trim()) {
                    this.currentStreamingMessage.content = localize('newmaChat.message.empty', '(empty response)');
                    this.updateMessageElement(this.currentStreamingMessage.id, this.currentStreamingMessage.content);
                }
                this.currentStreamingMessage = null;
                this.saveHistory(); // Save after message completes
            }
        } catch (e) {
            // Show error message
            if (this.currentStreamingMessage) {
                this.finishStreamingMessage(this.currentStreamingMessage.id);
                this.currentStreamingMessage.content = localize('newmaChat.message.error', 'Error: {0}', String(e));
                this.updateMessageElement(this.currentStreamingMessage.id, this.currentStreamingMessage.content);
                this.currentStreamingMessage = null;
            }
        } finally {
            this.isProcessing = false;
            this.inputEl.disabled = false;
            this.sendBtn.disabled = false;
            this.sendBtn.textContent = localize('newmaChat.send', 'Send');
            this.sendBtn.style.opacity = '1';
            this.sendBtn.style.cursor = 'pointer';
            this.inputEl.focus();
        }
    }

    getActions(): ReadonlyArray<IAction> {
        return [
            new Action('newma.chat.clear', localize('newmaChat.clear', 'Clear'), undefined, true, async () => {
                this.messageHistory = [];
                this.currentStreamingMessage = null;
                this.messagesEl.innerHTML = '';
                this.appendWelcomeMessage();
                this.storageService.remove(NewmaChatView.STORAGE_KEY, StorageScope.WORKSPACE);
            })
        ];
    }

    override dispose(): void {
        this.disposables.dispose();
        super.dispose();
    }
}


