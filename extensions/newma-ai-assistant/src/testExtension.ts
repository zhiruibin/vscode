import * as vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext) {
	console.log('=== TEST EXTENSION ACTIVATED ===');
	console.log('Extension context:', context);

	// Simple test - just show a message
	vscode.window.showInformationMessage('Test extension is working!');

	console.log('=== TEST EXTENSION COMPLETED ===');
}

export function deactivate() {
	console.log('=== TEST EXTENSION DEACTIVATED ===');
}




