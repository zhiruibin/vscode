import * as vscode from 'vscode';

export interface UndoEntry {
	description: string;
	undo: () => Promise<void>;
}

export class OperationLogger {
	private stack: UndoEntry[] = [];

	record(entry: UndoEntry) {
		this.stack.push(entry);
	}

	canUndo(): boolean {
		return this.stack.length > 0;
	}

	async undoLast(): Promise<void> {
		const last = this.stack.pop();
		if (!last) {
			vscode.window.showInformationMessage('没有可撤销的操作');
			return;
		}
		await last.undo();
		vscode.window.showInformationMessage(`已撤销：${last.description}`);
	}
}





