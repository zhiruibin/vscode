import * as vscode from 'vscode';
import { PlanManager, PlanStep } from './planManager';

export class PlanTreeProvider implements vscode.TreeDataProvider<PlanStep> {
	private _onDidChangeTreeData: vscode.EventEmitter<PlanStep | undefined | null | void> = new vscode.EventEmitter<PlanStep | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<PlanStep | undefined | null | void> = this._onDidChangeTreeData.event;

	constructor(private manager: PlanManager) { }

	refresh(): void { this._onDidChangeTreeData.fire(); }

	getTreeItem(element: PlanStep): vscode.TreeItem {
		const label = `${element.index}. ${element.title}`;
		const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
		item.description = `${element.status ?? 'pending'}`;
		item.contextValue = 'planStep';
		item.command = {
			title: 'Execute Step',
			command: 'newma-ai.plan.executeStep',
			arguments: [element.index - 1]
		};
		return item;
	}

	getChildren(element?: PlanStep): Thenable<PlanStep[]> {
		if (element) { return Promise.resolve([]); }
		return Promise.resolve(this.manager.getCurrentPlan());
	}
}





