/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { $, addDisposableListener, append, EventHelper, EventType } from '../../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { Emitter } from '../../../../base/common/event.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { AnchorAlignment } from '../../../../base/browser/ui/contextview/contextview.js';
import './newmaModeSelector.css';

export interface IModeOption {
	id: string;
	label: string;
	icon?: ThemeIcon;
}

export interface IModeSelectorOptions {
	modes: IModeOption[];
	currentMode: string;
	onModeSelected: (modeId: string) => void;
}

export class NewmaModeSelector extends Disposable {
	private readonly _onDidSelectMode = this._register(new Emitter<string>());
	readonly onDidSelectMode = this._onDidSelectMode.event;

	private currentContextView: { close: () => void } | undefined;
	private button: HTMLElement | undefined;
	private options: IModeSelectorOptions;

	constructor(
		private readonly container: HTMLElement,
		options: IModeSelectorOptions,
		@IContextViewService private readonly contextViewService: IContextViewService
	) {
		super();
		console.log('[NewmaModeSelector] constructor called', container, options);
		this.options = options;
		this.renderButton();
		console.log('[NewmaModeSelector] constructor completed');
	}

	updateOptions(newOptions: Partial<IModeSelectorOptions>): void {
		this.options = { ...this.options, ...newOptions };
		if (this.options.currentMode) {
			this.updateButton(this.options.modes.find(m => m.id === this.options.currentMode));
		}
	}

	private renderButton(): void {
		console.log('[NewmaModeSelector] renderButton called', {
			container: this.container,
			containerTag: this.container.tagName,
			containerClass: this.container.className,
			containerId: this.container.id
		});
		const currentMode = this.options.modes.find(m => m.id === this.options.currentMode);
		console.log('[NewmaModeSelector] currentMode:', currentMode);
		this.button = append(this.container, $('button.newma-mode-selector-button'));
		console.log('[NewmaModeSelector] button created:', {
			button: this.button,
			buttonTag: this.button.tagName,
			buttonClass: this.button.className,
			buttonId: this.button.id,
			buttonParent: this.button.parentElement,
			buttonComputedStyle: window.getComputedStyle(this.button).pointerEvents
		});
		this.button.setAttribute('role', 'button');
		this.button.setAttribute('aria-label', 'Select Newma mode');
		this.button.setAttribute('aria-expanded', 'false');
		this.button.style.pointerEvents = 'auto';
		this.button.style.position = 'relative';
		this.button.style.zIndex = '10';

		// Icon
		if (currentMode?.icon) {
			const icon = append(this.button, $('span.codicon'));
			icon.classList.add(...ThemeIcon.asClassNameArray(currentMode.icon));
		}

		// Label
		const label = append(this.button, $('span.newma-mode-label'));
		label.textContent = currentMode?.label || 'Ask';

		// Arrow icon
		const arrow = append(this.button, $('span.codicon.codicon-chevron-right'));
		arrow.classList.add('newma-mode-arrow');

		// Click handler - use capture phase to ensure we handle it first
		const clickHandler = (e: MouseEvent) => {
			console.log('[NewmaModeSelector] Button clicked!', {
				event: e,
				button: this.button,
				target: e.target,
				currentTarget: e.currentTarget,
				buttonElement: this.button,
				buttonVisible: this.button ? window.getComputedStyle(this.button).display !== 'none' : false,
				buttonPointerEvents: this.button ? window.getComputedStyle(this.button).pointerEvents : 'none'
			});
			e.stopPropagation(); // Prevent event from bubbling to container
			e.preventDefault(); // Prevent default behavior
			e.stopImmediatePropagation(); // Prevent other handlers on the same element
			console.log('[NewmaModeSelector] About to call showMenu');
			this.showMenu(this.button!);
		};
		this._register(addDisposableListener(this.button, EventType.CLICK, clickHandler, true)); // Use capture phase
		// Also add a normal phase listener as backup
		this._register(addDisposableListener(this.button, EventType.CLICK, clickHandler, false));

		// Keyboard handler
		this._register(addDisposableListener(this.button, EventType.KEY_DOWN, (e) => {
			const event = new StandardKeyboardEvent(e);
			if (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) {
				console.log('[NewmaModeSelector] Keyboard key pressed', event.keyCode);
				e.stopPropagation(); // Prevent event from bubbling to container
				e.preventDefault(); // Prevent default behavior
				e.stopImmediatePropagation(); // Prevent other handlers
				this.showMenu(this.button!);
			}
		}, true)); // Use capture phase
	}

	updateButton(mode: IModeOption | undefined): void {
		if (!this.button) { return; }

		const label = this.button.querySelector('span.newma-mode-label');
		if (label) {
			label.textContent = mode?.label || 'Ask';
		}

		// Update icon
		const icon = this.button.querySelector('span.codicon:not(.newma-mode-arrow)');
		if (icon) {
			if (mode?.icon) {
				icon.className = 'codicon ' + ThemeIcon.asClassNameArray(mode.icon).join(' ');
			} else {
				icon.remove();
			}
		} else if (mode?.icon) {
			// Insert icon before label if it doesn't exist
			const labelEl = this.button.querySelector('span.newma-mode-label');
			if (labelEl) {
				const newIcon = append(this.button, $('span.codicon'));
				newIcon.classList.add(...ThemeIcon.asClassNameArray(mode.icon));
				this.button.insertBefore(newIcon, labelEl);
			}
		}
	}

	private showMenu(anchor: HTMLElement): void {
		console.log('[NewmaModeSelector] showMenu called', anchor, 'currentContextView:', this.currentContextView);

		if (this.currentContextView) {
			this.currentContextView.close();
			this.currentContextView = undefined;
			if (this.button) {
				this.button.setAttribute('aria-expanded', 'false');
			}
			return;
		}

		if (this.button) {
			this.button.setAttribute('aria-expanded', 'true');
		}

		console.log('[NewmaModeSelector] Calling contextViewService.showContextView');
		this.currentContextView = this.contextViewService.showContextView({
			getAnchor: () => {
				console.log('[NewmaModeSelector] getAnchor called, returning:', anchor);
				return anchor;
			},
			anchorAlignment: AnchorAlignment.LEFT,
			render: (container: HTMLElement) => {
				console.log('[NewmaModeSelector] render called, container:', container);
				container.classList.add('newma-mode-selector-popup');

				// Create mode options
				for (const mode of this.options.modes) {
					const option = append(container, $('div.newma-mode-option'));
					option.setAttribute('role', 'menuitem');
					option.setAttribute('data-mode-id', mode.id);

					if (mode.id === this.options.currentMode) {
						option.classList.add('selected');
					}

					// Icon
					if (mode.icon) {
						const icon = append(option, $('span.codicon'));
						icon.classList.add(...ThemeIcon.asClassNameArray(mode.icon));
					}

					// Label
					const label = append(option, $('span.newma-mode-option-label'));
					label.textContent = mode.label;

					// Click handler
					this._register(addDisposableListener(option, EventType.CLICK, (e) => {
						EventHelper.stop(e, true);
						this.selectMode(mode.id);
						this.hideMenu();
					}));

					// Keyboard handler
					this._register(addDisposableListener(option, EventType.KEY_DOWN, (e) => {
						const event = new StandardKeyboardEvent(e);
						if (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) {
							EventHelper.stop(e, true);
							this.selectMode(mode.id);
							this.hideMenu();
						} else if (event.equals(KeyCode.Escape)) {
							EventHelper.stop(e, true);
							this.hideMenu();
						}
					}));

					// Hover effect
					this._register(addDisposableListener(option, EventType.MOUSE_ENTER, () => {
						option.classList.add('hover');
					}));
					this._register(addDisposableListener(option, EventType.MOUSE_LEAVE, () => {
						option.classList.remove('hover');
					}));
				}

				// Click outside to close
				this._register(addDisposableListener(window, EventType.MOUSE_DOWN, (e) => {
					if (!container.contains(e.target as Node) && !anchor.contains(e.target as Node)) {
						this.hideMenu();
					}
				}));

				return {
					dispose: () => {
						if (this.button) {
							this.button.setAttribute('aria-expanded', 'false');
						}
					}
				};
			}
		});
	}

	private hideMenu(): void {
		if (this.currentContextView) {
			this.currentContextView.close();
			this.currentContextView = undefined;
		}
		if (this.button) {
			this.button.setAttribute('aria-expanded', 'false');
		}
	}

	private selectMode(modeId: string): void {
		this.options.currentMode = modeId;
		this.options.onModeSelected(modeId);
		this._onDidSelectMode.fire(modeId);
		const mode = this.options.modes.find(m => m.id === modeId);
		if (mode) {
			this.updateButton(mode);
		}
	}
}

