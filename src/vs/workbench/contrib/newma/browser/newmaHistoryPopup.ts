/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { $, addDisposableListener, append, EventHelper, EventType, getWindow } from '../../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { Emitter } from '../../../../base/common/event.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { AnchorAlignment } from '../../../../base/browser/ui/contextview/contextview.js';
import './newmaHistoryPopup.css';

export interface IHistoryAction {
	id: string;
	label: string;
	icon?: ThemeIcon;
	enabled?: boolean;
}

export interface IHistoryPopupOptions {
	actions: IHistoryAction[];
	onActionSelected: (actionId: string) => void;
}

export class NewmaHistoryPopup extends Disposable {
	private readonly _onDidSelectAction = this._register(new Emitter<string>());
	readonly onDidSelectAction = this._onDidSelectAction.event;

	private currentContextView: { close: () => void } | undefined;
	private globalKeydownDisposable: { dispose: () => void } | undefined;
	private options: IHistoryPopupOptions;

	constructor(
		options: IHistoryPopupOptions,
		@IContextViewService private readonly contextViewService: IContextViewService
	) {
		super();
		this.options = options;
	}

	show(anchor: HTMLElement): void {
		if (this.currentContextView) {
			this.currentContextView.close();
			this.currentContextView = undefined;
			return;
		}

		this.currentContextView = this.contextViewService.showContextView({
			getAnchor: () => anchor,
			anchorAlignment: AnchorAlignment.LEFT,
			render: (container: HTMLElement) => {
				container.classList.add('newma-history-popup');
				container.setAttribute('role', 'menu');

				// Create action items
				let firstFocusable: HTMLElement | undefined;
				for (const action of this.options.actions) {
					const actionItem = append(container, $('div.newma-history-action'));
					actionItem.setAttribute('role', 'menuitem');
					actionItem.setAttribute('data-action-id', action.id);
					actionItem.classList.toggle('disabled', action.enabled === false);
					actionItem.tabIndex = action.enabled === false ? -1 : 0;
					if (!firstFocusable && action.enabled !== false) {
						firstFocusable = actionItem;
					}

					// Icon
					if (action.icon) {
						const icon = append(actionItem, $('span.codicon'));
						icon.classList.add(...ThemeIcon.asClassNameArray(action.icon));
					}

					// Label
					const label = append(actionItem, $('span.newma-history-action-label'));
					label.textContent = action.label;

					// Click handler
					if (action.enabled !== false) {
						this._register(addDisposableListener(actionItem, EventType.CLICK, (e) => {
							EventHelper.stop(e, true);
							this.selectAction(action.id);
							this.hide();
						}));
					}

					// Keyboard handler
					this._register(addDisposableListener(actionItem, EventType.KEY_DOWN, (e) => {
						const event = new StandardKeyboardEvent(e);
						if (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) {
							if (action.enabled !== false) {
								EventHelper.stop(e, true);
								this.selectAction(action.id);
								this.hide();
							}
						} else if (event.equals(KeyCode.Escape)) {
							EventHelper.stop(e, true);
							this.hide();
						}
					}));

					// Hover effect
					if (action.enabled !== false) {
						this._register(addDisposableListener(actionItem, EventType.MOUSE_ENTER, () => {
							actionItem.classList.add('hover');
						}));
						this._register(addDisposableListener(actionItem, EventType.MOUSE_LEAVE, () => {
							actionItem.classList.remove('hover');
						}));
					}
				}

				// Click outside to close
				const targetWindow = getWindow(container);
				if (targetWindow) {
					this._register(addDisposableListener(targetWindow.document, EventType.MOUSE_DOWN, (e) => {
						if (!container.contains(e.target as Node) && !anchor.contains(e.target as Node)) {
							this.hide();
						}
					}));
				}

				// Global escape to close
				const keydownHandler = (e: KeyboardEvent) => {
					if (e.key === 'Escape') {
						this.hide();
					}
				};
				if (targetWindow) {
					targetWindow.addEventListener('keydown', keydownHandler, true);
					this.globalKeydownDisposable = { dispose: () => targetWindow.removeEventListener('keydown', keydownHandler, true) };
				}

				// Focus first actionable item
				setTimeout(() => firstFocusable?.focus(), 0);

				return {
					dispose: () => {
						// Cleanup handled by hide()
					}
				};
			}
		});
	}

	hide(): void {
		if (this.currentContextView) {
			this.currentContextView.close();
			this.currentContextView = undefined;
		}
		if (this.globalKeydownDisposable) {
			this.globalKeydownDisposable.dispose();
			this.globalKeydownDisposable = undefined;
		}
	}

	private selectAction(actionId: string): void {
		this.options.onActionSelected(actionId);
		this._onDidSelectAction.fire(actionId);
	}

	updateOptions(newOptions: Partial<IHistoryPopupOptions>): void {
		this.options = { ...this.options, ...newOptions };
	}
}

