import * as vscode from 'vscode';
import { AIService } from './aiService';
import { SideEffectGate } from './sideEffectGate';

export interface PlanStep {
	index: number;
	title: string;
	intent: string;
	sideEffects: boolean;
	instruction: string;
	status?: 'pending' | 'completed' | 'skipped' | 'failed';
}

export class PlanManager {
	private ai: AIService;
	private gate: SideEffectGate;
	private steps: PlanStep[] = [];
	private currentIndex: number = 0;
	private memento?: vscode.Memento;

	constructor(ai: AIService, gate: SideEffectGate, memento?: vscode.Memento) {
		this.ai = ai;
		this.gate = gate;
		this.memento = memento;
		this.restore();
	}

	getCurrentPlan(): PlanStep[] { return this.steps; }

	createEmptyPlan(): void {
		this.steps = [];
		this.currentIndex = 0;
		this.persist();
	}

	async buildPlanFromPrompt(userPrompt: string): Promise<PlanStep[]> {
		const system = [
			'你是资深开发助手。请将用户目标拆解为一个有限的可执行步骤列表。',
			'输出严格 JSON 数组，每个元素包含: index(从1开始), title, intent, sideEffects(boolean), instruction。',
			'仅输出 JSON，不要任何解释文字。',
		].join('\n');
		const prompt = `${system}\n用户目标：${userPrompt}`;
		let text: string;
		try {
			text = await this.ai.generateResponse(prompt, { onProgress: () => { } });
		} catch (err) {
			vscode.window.showWarningMessage(`生成计划时出错，已回退为单步执行：${err instanceof Error ? err.message : String(err)}`);
			this.steps = [{ index: 1, title: '执行请求', intent: userPrompt, sideEffects: false, instruction: userPrompt, status: 'pending' }];
			this.currentIndex = 0;
			this.persist();
			return this.steps;
		}
		console.log('PlanManager: AI response:', text);
		let parsed: any;
		try {
			const jsonSnippet = this.extractJson(text);
			console.log('PlanManager: Extracted JSON:', jsonSnippet);
			parsed = JSON.parse(jsonSnippet);
			if (!Array.isArray(parsed)) { throw new Error('Plan is not array'); }
			this.steps = parsed.map((s: any, i: number) => ({
				index: Number(s.index ?? i + 1),
				title: String(s.title ?? `Step ${i + 1}`),
				intent: String(s.intent ?? ''),
				sideEffects: Boolean(s.sideEffects ?? false),
				instruction: String(s.instruction ?? ''),
				status: 'pending'
			}));
			// 如果模型返回了空数组，则兜底生成单步计划
			if (this.steps.length === 0) {
				this.steps = [{ index: 1, title: '执行请求', intent: userPrompt, sideEffects: false, instruction: userPrompt, status: 'pending' }];
			}
			this.currentIndex = 0;
			this.persist();
			return this.steps;
		} catch (e) {
			vscode.window.showErrorMessage('解析计划失败，已回退为单步执行');
			this.steps = [{ index: 1, title: '执行请求', intent: userPrompt, sideEffects: false, instruction: userPrompt, status: 'pending' }];
			this.currentIndex = 0;
			this.persist();
			return this.steps;
		}
	}

	async runPlanInteractively(): Promise<void> {
		if (this.steps.length === 0) { vscode.window.showInformationMessage('当前无计划，请先生成计划'); return; }
		for (let i = this.currentIndex; i < this.steps.length; i++) {
			const s = this.steps[i];
			const picked = await vscode.window.showQuickPick([
				{ label: `执行：${s.title}`, value: 'exec' },
				{ label: `跳过：${s.title}`, value: 'skip' },
				{ label: '停止', value: 'stop' }
			], { placeHolder: `Step ${s.index}/${this.steps.length} - ${s.intent}` });
			if (!picked) { return; }
			if (picked.value === 'stop') { return; }
			if (picked.value === 'skip') { s.status = 'skipped'; this.currentIndex = i + 1; this.persist(); continue; }
			try {
				await this.executeStep(s);
				s.status = 'completed';
			} catch (err) {
				s.status = 'failed';
				this.currentIndex = i; // 停在失败处
				this.persist();
				const msg = err instanceof Error ? err.message : String(err);
				throw new Error(`执行失败：${s.title} - ${msg}`);
			}
			this.currentIndex = i + 1;
			this.persist();
		}
		vscode.window.showInformationMessage('计划执行完成');
	}

	private async executeStep(step: PlanStep): Promise<void> {
		// 基础版：直接请求 AI 执行指令。副作用由外层 Ask 模式在各具体命令中拦截。
		await this.ai.generateResponse(step.instruction, { onProgress: () => { } });
	}

	async runSingleStep(index: number): Promise<void> {
		if (index < 0 || index >= this.steps.length) { return; }
		const s = this.steps[index];
		try {
			await this.executeStep(s);
			s.status = 'completed';
			this.currentIndex = Math.max(this.currentIndex, index + 1);
		} catch (err) {
			s.status = 'failed';
			this.currentIndex = index;
			const msg = err instanceof Error ? err.message : String(err);
			throw new Error(`执行失败：${s.title} - ${msg}`);
		} finally {
			this.persist();
		}
	}

	private extractJson(text: string): string {
		const start = text.indexOf('[');
		if (start === -1) { return text.trim(); }

		// Find the matching closing bracket
		let bracketCount = 0;
		let end = -1;
		for (let i = start; i < text.length; i++) {
			if (text[i] === '[') { bracketCount++; }
			else if (text[i] === ']') {
				bracketCount--;
				if (bracketCount === 0) {
					end = i;
					break;
				}
			}
		}

		if (end !== -1) {
			return text.slice(start, end + 1);
		}

		// If no complete JSON found, try to find partial JSON and complete it
		const partialJson = text.slice(start);
		console.log('PlanManager: Incomplete JSON detected:', partialJson);

		// Try to complete the JSON by adding missing closing brackets
		let completedJson = partialJson;
		let missingBrackets = 0;
		for (let i = 0; i < partialJson.length; i++) {
			if (partialJson[i] === '[') { missingBrackets++; }
			else if (partialJson[i] === ']') { missingBrackets--; }
		}

		// Add missing closing brackets
		for (let i = 0; i < missingBrackets; i++) {
			completedJson += ']';
		}

		console.log('PlanManager: Attempting to complete JSON:', completedJson);
		return completedJson;
	}

	private persist() {
		if (!this.memento) { return; }
		this.memento.update('newma.plan.steps', this.steps);
		this.memento.update('newma.plan.currentIndex', this.currentIndex);
	}

	private restore() {
		if (!this.memento) { return; }
		const s = this.memento.get<PlanStep[]>('newma.plan.steps');
		const idx = this.memento.get<number>('newma.plan.currentIndex');
		if (s && Array.isArray(s)) { this.steps = s; }
		if (typeof idx === 'number') { this.currentIndex = idx; }
	}

	clear() {
		this.steps = [];
		this.currentIndex = 0;
		this.persist();
	}
}


