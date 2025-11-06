import * as vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext) {
	console.log('=== SIMPLE TEST EXTENSION ACTIVATED ===');

	try {
		console.log('=== Testing vscode.chat availability ===');
		console.log('vscode.chat:', typeof vscode.chat);
		console.log('vscode.chat keys:', Object.keys(vscode.chat || {}));

		if (vscode.chat && vscode.chat.createChatParticipant) {
			console.log('=== Creating chat participant ===');
			const chatParticipant = vscode.chat.createChatParticipant('newma-ai', async (request, context, response, token) => {
				console.log('=== CHAT HANDLER CALLED ===');
				console.log('Request prompt:', request.prompt);
				response.markdown('Hello from Newma AI! This is a test response.');
				return {};
			});
			context.subscriptions.push(chatParticipant);
			console.log('=== Chat participant created successfully ===');
		} else {
			console.log('=== vscode.chat.createChatParticipant not available ===');
		}

		console.log('=== SIMPLE TEST EXTENSION COMPLETED ===');
	} catch (error) {
		console.error('=== ERROR IN SIMPLE TEST EXTENSION ===', error);
	}
}

export function deactivate() {
	console.log('Simple test extension deactivated');
}




