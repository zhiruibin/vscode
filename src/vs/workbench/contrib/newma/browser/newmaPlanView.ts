/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewletViewOptions } from '../../../browser/parts/views/viewsViewlet.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { INewmaAiService, NewmaPlanStep } from '../../../../platform/newmaAi/common/newmaAi.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { ITerminalService } from '../../terminal/browser/terminal.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';

interface PlanStepWithStatus extends NewmaPlanStep {
	status?: 'pending' | 'running' | 'completed' | 'skipped' | 'failed';
	error?: string;
}

export class NewmaPlanView extends ViewPane {
	static readonly ID = 'newma.planView';
	static readonly TITLE: string = localize('newmaPlanView.title', 'Newma Plan');

	private currentSteps: PlanStepWithStatus[] = [];
	private disposables = new DisposableStore();

	constructor(
		options: IViewletViewOptions,
		@IThemeService themeService: IThemeService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@ILabelService labelService: ILabelService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IOpenerService openerService: IOpenerService,
		@IHoverService hoverService: IHoverService,
		@INewmaAiService private readonly newmaAiService: INewmaAiService,
		@IQuickInputService private readonly quickInputService: IQuickInputService,
		@INotificationService private readonly notificationService: INotificationService,
		@ITerminalService private readonly terminalService: ITerminalService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		const root = document.createElement('div');
		root.style.padding = '8px';
		root.style.cssText = `
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        `;

		const controls = document.createElement('div');
		controls.style.cssText = `
            display: flex;
            gap: 8px;
            align-items: center;
        `;

		const planButton = document.createElement('button');
		planButton.textContent = localize('newma.plan.button', 'Create Plan');
		planButton.style.cssText = `
            padding: 8px 16px;
            border: none;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
            border-radius: 4px;
            font-weight: 500;
        `;
		planButton.onclick = async () => {
			const prompt = await this.quickInputService.input({ prompt: 'Plan with Newma' });
			if (!prompt) { return; }
			try {
				const steps = await this.newmaAiService.buildPlan(prompt);
				this.currentSteps = steps.map(s => ({ ...s, status: 'pending' as const }));
				this.renderSteps();
				this.notificationService.notify({ severity: Severity.Info, message: localize('newma.plan.created', "Plan created: {0} step(s)", String(steps.length)) });
			} catch (err) {
				this.notificationService.notify({ severity: Severity.Error, message: String(err) });
			}
		};

		controls.appendChild(planButton);
		root.appendChild(controls);

		const list = document.createElement('ol');
		list.id = 'newma-plan-steps-list';
		list.style.cssText = `
            margin: 0;
            padding: 0;
            list-style: none;
            display: flex;
            flex-direction: column;
            gap: 12px;
        `;
		root.appendChild(list);
		container.appendChild(root);

		// Render existing steps if any
		if (this.currentSteps.length > 0) {
			this.renderSteps();
		}
	}

	private renderSteps(): void {
		const list = document.getElementById('newma-plan-steps-list');
		if (!list) { return; }

		list.innerHTML = '';
		for (const step of this.currentSteps) {
			const li = this.createStepElement(step);
			list.appendChild(li);
		}
	}

	private createStepElement(step: PlanStepWithStatus): HTMLElement {
		const li = document.createElement('li');
		li.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 12px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            background: var(--vscode-editor-background);
        `;

		const header = document.createElement('div');
		header.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        `;

		const index = document.createElement('span');
		index.style.cssText = `
            font-weight: 600;
            color: var(--vscode-foreground);
        `;
		index.textContent = `${step.index}.`;

		const title = document.createElement('span');
		title.style.cssText = `
            flex: 1;
            color: var(--vscode-foreground);
            font-weight: 500;
        `;
		title.textContent = step.title;
		title.title = step.instruction;

		const statusBadge = document.createElement('span');
		statusBadge.style.cssText = `
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 500;
        `;
		this.updateStatusBadge(statusBadge, step.status || 'pending');
		header.appendChild(index);
		header.appendChild(title);
		header.appendChild(statusBadge);

		if (step.instruction) {
			const instruction = document.createElement('div');
			instruction.style.cssText = `
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
                margin-top: 4px;
                padding-left: 16px;
            `;
			instruction.textContent = step.instruction;
			li.appendChild(instruction);
		}

		if (step.error) {
			const error = document.createElement('div');
			error.style.cssText = `
                font-size: 12px;
                color: var(--vscode-errorForeground);
                margin-top: 4px;
                padding-left: 16px;
            `;
			error.textContent = `Error: ${step.error}`;
			li.appendChild(error);
		}

		const actions = document.createElement('div');
		actions.style.cssText = `
            display: flex;
            gap: 8px;
            margin-top: 8px;
        `;

		const execBtn = document.createElement('button');
		execBtn.textContent = step.status === 'running'
			? localize('newma.plan.executing', 'Executing...')
			: localize('newma.plan.execute', 'Execute');
		execBtn.disabled = step.status === 'running' || step.status === 'completed';
		execBtn.style.cssText = `
            padding: 6px 12px;
            border: none;
            background: ${step.status === 'completed' ? 'var(--vscode-button-secondaryBackground)' : 'var(--vscode-button-background)'};
            color: ${step.status === 'completed' ? 'var(--vscode-button-secondaryForeground)' : 'var(--vscode-button-foreground)'};
            cursor: ${step.status === 'running' || step.status === 'completed' ? 'not-allowed' : 'pointer'};
            border-radius: 4px;
            font-size: 12px;
            opacity: ${step.status === 'running' || step.status === 'completed' ? '0.6' : '1'};
        `;
		execBtn.onclick = async () => {
			await this.executeStep(step);
		};

		const skipBtn = document.createElement('button');
		skipBtn.textContent = localize('newma.plan.skip', 'Skip');
		skipBtn.disabled = step.status === 'running' || step.status === 'completed';
		skipBtn.style.cssText = `
            padding: 6px 12px;
            border: 1px solid var(--vscode-button-border);
            background: transparent;
            color: var(--vscode-foreground);
            cursor: ${step.status === 'running' || step.status === 'completed' ? 'not-allowed' : 'pointer'};
            border-radius: 4px;
            font-size: 12px;
            opacity: ${step.status === 'running' || step.status === 'completed' ? '0.6' : '1'};
        `;
		skipBtn.onclick = () => {
			this.skipStep(step);
		};

		actions.appendChild(execBtn);
		actions.appendChild(skipBtn);
		li.appendChild(header);
		li.appendChild(actions);

		return li;
	}

	private updateStatusBadge(badge: HTMLElement, status: string): void {
		const statusConfig: Record<string, { text: string; bg: string; fg: string }> = {
			pending: { text: 'Pending', bg: 'var(--vscode-badge-background)', fg: 'var(--vscode-badge-foreground)' },
			running: { text: 'Running', bg: 'var(--vscode-progressBar-background)', fg: 'var(--vscode-foreground)' },
			completed: { text: 'Completed', bg: 'var(--vscode-testing-iconPassed)', fg: 'var(--vscode-foreground)' },
			skipped: { text: 'Skipped', bg: 'var(--vscode-descriptionForeground)', fg: 'var(--vscode-foreground)' },
			failed: { text: 'Failed', bg: 'var(--vscode-errorForeground)', fg: 'var(--vscode-foreground)' }
		};
		const config = statusConfig[status] || statusConfig.pending;
		badge.textContent = config.text;
		badge.style.background = config.bg;
		badge.style.color = config.fg;
	}

	private async executeStep(step: PlanStepWithStatus): Promise<void> {
		step.status = 'running';
		step.error = undefined;
		this.renderSteps();

		try {
			// Check if instruction contains commands (basic heuristic)
			const instruction = step.instruction.toLowerCase();

			// If it looks like a shell command, run it in terminal
			if (instruction.includes('run ') || instruction.includes('execute ') ||
				instruction.match(/^(npm|yarn|git|cd|mkdir|ls|cat|echo)/)) {
				await this.executeInTerminal(step.instruction);
				step.status = 'completed';
			} else {
				// For other instructions, just mark as completed for now
				// In a full implementation, we might parse and execute specific actions
				step.status = 'completed';
				this.notificationService.notify({
					severity: Severity.Info,
					message: localize('newma.plan.exec.ok', 'Step {0} marked as completed', String(step.index))
				});
			}
		} catch (err) {
			step.status = 'failed';
			step.error = String(err);
			this.notificationService.notify({
				severity: Severity.Error,
				message: localize('newma.plan.exec.failed', 'Step {0} failed: {1}', String(step.index), String(err))
			});
		}

		this.renderSteps();
	}

	private async executeInTerminal(command: string): Promise<void> {
		const terminal = await this.terminalService.getActiveOrCreateInstance();
		await terminal.focusWhenReady(true);
		// Extract actual command from instruction if it contains explanatory text
		const cmdMatch = command.match(/(?:run|execute)\s+(.+)/i) || command.match(/(npm|yarn|git|cd|mkdir|ls|cat|echo)[^\n]*/i);
		const actualCommand = cmdMatch ? cmdMatch[1] || cmdMatch[0] : command;
		terminal.runCommand(actualCommand, false);
	}

	private skipStep(step: PlanStepWithStatus): void {
		step.status = 'skipped';
		this.renderSteps();
		this.notificationService.notify({
			severity: Severity.Info,
			message: localize('newma.plan.skip.ok', 'Step {0} skipped', String(step.index))
		});
	}

	override dispose(): void {
		this.disposables.dispose();
		super.dispose();
	}
}


