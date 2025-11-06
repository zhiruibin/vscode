import * as vscode from 'vscode';

export type OperationType = 'insert' | 'replace' | 'create' | 'delete' | 'move';

export interface SideEffectOperation {
	type: OperationType;
	targetDescription: string; // e.g. current file / selection / new filename
	previewContent?: string;   // optional code/content preview
}

export class SideEffectGate {
	async confirmAndApply<T>(operation: SideEffectOperation, apply: () => Promise<T>): Promise<T | undefined> {
		const detail = `操作: ${operation.type}\n目标: ${operation.targetDescription}`;
		const buttons: string[] = operation.previewContent ? ['预览', '应用', '取消'] : ['应用', '取消'];
		const pick = await vscode.window.showInformationMessage(detail, { modal: true }, ...buttons);
		if (!pick || pick === '取消') {
			return undefined;
		}
		if (pick === '预览' && operation.previewContent) {
			const doc = await vscode.workspace.openTextDocument({ content: operation.previewContent, language: this.detectLanguage() });
			await vscode.window.showTextDocument(doc, { preview: true });
			// 再次确认
			const pick2 = await vscode.window.showInformationMessage('是否应用上述改动？', { modal: true }, '应用', '取消');
			if (pick2 !== '应用') { return undefined; }
		}
		return await apply();
	}

	private detectLanguage(): string {
		const editor = vscode.window.activeTextEditor;
		return editor ? editor.document.languageId : 'markdown';
	}
}





