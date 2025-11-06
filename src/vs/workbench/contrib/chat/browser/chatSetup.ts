/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/chatSetup.css';
import { localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { Disposable } from '../../../../base/common/lifecycle.js';

// Chat setup action ID
const CHAT_SETUP_ACTION_ID = 'workbench.action.chat.triggerSetup';

// Chat category for commands
const CHAT_CATEGORY = localize2('chat.category', 'Chat');

// Simple ChatSetupContribution that bypasses authentication
export class ChatSetupContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.chatSetup';

	constructor() {
		super();
		this.registerActions();
	}

	private registerActions(): void {
		// Register only the essential command without full setup context
		// This allows custom AI implementations to work

		class ChatSetupTriggerAction extends Action2 {
			static CHAT_SETUP_ACTION_LABEL = localize2('triggerChatSetup', "Use AI Features with Newma AI for free...");

			constructor() {
				super({
					id: CHAT_SETUP_ACTION_ID,
					title: ChatSetupTriggerAction.CHAT_SETUP_ACTION_LABEL,
					category: CHAT_CATEGORY,
					f1: true
				});
			}

			override async run(accessor: ServicesAccessor): Promise<boolean> {
				// For custom AI implementations, bypass authentication completely
				// Just return true to indicate setup is complete without requiring authentication
				return true;
			}
		}

		registerAction2(ChatSetupTriggerAction);
	}
}

// Simple ChatTeardownContribution
export class ChatTeardownContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.chatTeardown';
	static readonly CHAT_DISABLED_CONFIGURATION_KEY = 'chat.disableAIFeatures';

	constructor() {
		super();
		// Minimal implementation for custom AI
	}
}
