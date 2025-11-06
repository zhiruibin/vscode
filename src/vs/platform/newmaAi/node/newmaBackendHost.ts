/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IServerChannel } from '../../../base/parts/ipc/common/ipc.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { NEWMA_IPC_CHANNEL, NewmaIpcCommand, NewmaIpcEvent, StreamingChunk } from '../common/ipc.js';
import { IProductService } from '../../../platform/product/common/productService.js';
import { IRequestService } from '../../../platform/request/common/request.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { VSBuffer, streamToBuffer } from '../../../base/common/buffer.js';
import { IConfigurationService } from '../../../platform/configuration/common/configuration.js';

export class NewmaBackendHost implements IServerChannel<string> {
	private readonly baseUrl: string;
	private readonly timeoutMs: number;
	private readonly apiKeySettingKey: string | undefined;

	constructor(
		@IProductService productService?: IProductService,
		@IRequestService private readonly requestService?: IRequestService,
		@IConfigurationService private readonly configurationService?: IConfigurationService
	) {
		const cfg = (productService as unknown as { newma?: { backend?: { baseUrl?: string; timeoutMs?: number; apiKeySettingKey?: string } } })?.newma?.backend;
		this.baseUrl = cfg?.baseUrl || 'http://127.0.0.1:3901';
		this.timeoutMs = cfg?.timeoutMs ?? 180000;
		this.apiKeySettingKey = cfg?.apiKeySettingKey;
		// eslint-disable-next-line no-console
		console.log(`[NewmaBackendHost] configured baseUrl=${this.baseUrl} timeoutMs=${this.timeoutMs} apiKeySettingKey=${this.apiKeySettingKey ?? ''}`);
	}
	listen<T>(_context: string, event: string, arg?: unknown): Event<T> {
		if (event === NewmaIpcEvent.GenerateStream) {
			const { prompt: _prompt, apiKey, model, apiUrl } = (arg as { prompt: string; apiKey?: string; model?: string; apiUrl?: string }) ?? { prompt: '' };
			const emitter = new Emitter<StreamingChunk>();

			// Kick off request and stream data
			this.streamChat(_prompt, { apiKey, model, apiUrl }, chunk => {
				emitter.fire({ chunk });
			}).then(() => {
				emitter.fire({ end: true });
			}, err => {
				// eslint-disable-next-line no-console
				console.error('[NewmaBackendHost.listen.generateStream] error:', err);
				emitter.fire({ error: String(err) });
				emitter.fire({ end: true });
			});

			return emitter.event as unknown as Event<T>;
		}
		return Event.None as Event<T>;
	}

	async call<T>(_context: string, command: string, arg?: unknown): Promise<T> {
		switch (command) {
			case NewmaIpcCommand.Generate: {
				const { prompt: _prompt, apiKey, model, apiUrl } = (arg as { prompt: string; apiKey?: string; model?: string; apiUrl?: string }) ?? { prompt: '' };
				const text = await this.postChat(_prompt, { apiKey, model, apiUrl });
				return { text } as unknown as T;
			}
			case NewmaIpcCommand.BuildPlan: {
				const { prompt, apiKey, model, apiUrl } = (arg as { prompt: string; apiKey?: string; model?: string; apiUrl?: string }) ?? { prompt: '' };
				const steps = await this.buildPlan(prompt, { apiKey, model, apiUrl });
				return { steps } as unknown as T;
			}
			case NewmaIpcCommand.HealthCheck: {
				const ok = await this.healthCheck();
				return { ok } as unknown as T;
			}
			case NewmaIpcCommand.IsTaskRequest: {
				const { prompt, apiKey, model, apiUrl } = (arg as { prompt: string; apiKey?: string; model?: string; apiUrl?: string }) ?? { prompt: '' };
				const isTask = await this.isTaskRequest(prompt, { apiKey, model, apiUrl });
				return { isTask } as unknown as T;
			}
		}
		throw new Error(`Unknown command: ${command}`);
	}

	private async healthCheck(): Promise<boolean> {
		if (!this.requestService) {
			// eslint-disable-next-line no-console
			console.warn('[NewmaBackendHost.healthCheck] requestService missing');
			return false;
		}
		try {
			const res = await this.requestService.request({ type: 'GET', url: `${this.baseUrl}/health`, timeout: this.timeoutMs, headers: this.buildAuthHeaders() }, CancellationToken.None);
			if (res.res.statusCode && res.res.statusCode >= 200 && res.res.statusCode < 300) {
				return true;
			}
			return false;
		} catch {
			return false;
		}
	}

	private async postChat(prompt: string, overrides?: { apiKey?: string; model?: string; apiUrl?: string }): Promise<string> {
		const serviceAvailable = !!this.requestService;

		const apiKey = overrides?.apiKey || this.resolveApiKey();
		const model = overrides?.model || this.resolveModel();
		const apiUrl = overrides?.apiUrl || this.resolveApiUrl();
		// eslint-disable-next-line no-console
		console.log(`[NewmaBackendHost.postChat] requestService=${serviceAvailable ? 'available' : 'missing'} prompt="${prompt.slice(0, 50)}" apiKey=${apiKey ? '****' + apiKey.slice(-4) : 'none'} model=${model} apiUrl=${apiUrl} baseUrl=${this.baseUrl}`);

		// If requestService is missing, fall back to global fetch so we still make the request
		if (!serviceAvailable) {
			try {
				// eslint-disable-next-line no-console
				console.log('[NewmaBackendHost.postChat] fallback fetch →', `${this.baseUrl}/v1/chat`);
				const res = await fetch(`${this.baseUrl}/v1/chat`, {
					method: 'POST',
					headers: {
						'content-type': 'application/json',
						...(apiKey ? { 'authorization': `Bearer ${apiKey}` } : {})
					},
					body: JSON.stringify({ prompt, apiKey, model, apiUrl })
				});
				const text = await res.text();
				// eslint-disable-next-line no-console
				console.log('[NewmaBackendHost.postChat] fallback fetch status=', res.status, 'len=', text.length);
				return text || `You said: ${prompt}. (local fallback)`;
			} catch (e) {
				// eslint-disable-next-line no-console
				console.error('[NewmaBackendHost.postChat] fallback fetch error:', e);
				return `You said: ${prompt}. (local fallback)`;
			}
		}

		const ok = await this.healthCheck();
		if (!ok) { return `You said: ${prompt}. (local fallback)`; }
		const body = VSBuffer.fromString(JSON.stringify({ prompt, apiKey, model, apiUrl }));
		const headers: Record<string, string> = Object.assign({ 'content-type': 'application/json' }, this.buildAuthHeaders());

		const maxAttempts = 3;
		let lastErr: unknown;
		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				// eslint-disable-next-line no-console
				console.log(`[NewmaBackendHost.postChat] attempt ${attempt}/${maxAttempts} POST ${this.baseUrl}/v1/chat`);
				const res = await this.requestService.request({ type: 'POST', url: `${this.baseUrl}/v1/chat`, timeout: this.timeoutMs, headers, data: body.toString() }, CancellationToken.None);
				const status = res.res.statusCode ?? 0;
				// eslint-disable-next-line no-console
				console.log(`[NewmaBackendHost.postChat] status=${status}`);
				if (status >= 200 && status < 300) {
					// Backend returns plain text body
					let text = '';
					try {
						if (res.stream) {
							const buf = await streamToBuffer(res.stream);
							text = buf.toString();
							// eslint-disable-next-line no-console
							console.log(`[NewmaBackendHost.postChat] stream byteLength=${buf.byteLength} text preview="${text.slice(0, 300).replace(/\n/g, '\\n')}"`);
						}
					} catch (streamErr) {
						// eslint-disable-next-line no-console
						console.error(`[NewmaBackendHost.postChat] stream read error:`, streamErr);
					}
					if (text && text.trim()) {
						// Parse SSE format if needed: extract JSON from "data: {...}" lines
						const parsed = this.parseSSEResponse(text);
						if (parsed && parsed.trim()) {
							// eslint-disable-next-line no-console
							console.log(`[NewmaBackendHost.postChat] parsed text length=${parsed.length}`);
							return parsed;
						}
						// eslint-disable-next-line no-console
						console.log(`[NewmaBackendHost.postChat] parsed empty, returning original text`);
						return text;
					}
					// Fallback local simulated response when empty
					// eslint-disable-next-line no-console
					console.log(`[NewmaBackendHost.postChat] empty text, using fallback`);
					return `You said: ${prompt}. (local fallback)`;
				} else {
					let errText = '';
					try {
						if (res.stream) {
							const buf = await streamToBuffer(res.stream);
							errText = buf.toString();
						}
					} catch { /* ignore */ }
					// eslint-disable-next-line no-console
					console.error(`[NewmaBackendHost.postChat] failed status=${status} errorText=${errText.slice(0, 200)}`);
					throw new Error(`chat request failed: ${status} ${errText}`);
				}
			} catch (err) {
				// eslint-disable-next-line no-console
				console.error(`[NewmaBackendHost.postChat] attempt ${attempt} error:`, err);
				lastErr = err;
			}
			await new Promise(r => setTimeout(r, attempt * 300));
		}
		// eslint-disable-next-line no-console
		console.error(`[NewmaBackendHost.postChat] all attempts failed`);
		throw lastErr ?? new Error('chat request failed');
	}

	private async streamChat(prompt: string, overrides: { apiKey?: string; model?: string; apiUrl?: string }, onChunk: (chunk: string) => void): Promise<void> {
		const serviceAvailable = !!this.requestService;
		const apiKey = overrides?.apiKey || this.resolveApiKey();
		const model = overrides?.model || this.resolveModel();
		const apiUrl = overrides?.apiUrl || this.resolveApiUrl();
		// eslint-disable-next-line no-console
		console.log(`[NewmaBackendHost.streamChat] requestService=${serviceAvailable ? 'available' : 'missing'} prompt="${prompt.slice(0, 50)}" model=${model} apiUrl=${apiUrl}`);

		// Fallback to fetch if requestService missing
		if (!serviceAvailable) {
			try {
				const res = await fetch(`${this.baseUrl}/v1/chat`, {
					method: 'POST',
					headers: {
						'content-type': 'application/json',
						...(apiKey ? { 'authorization': `Bearer ${apiKey}` } : {})
					},
					body: JSON.stringify({ prompt, apiKey, model, apiUrl, stream: true })
				});
				const reader = (res.body as any)?.getReader?.();
				if (reader) {
					// Web stream
					while (true) {
						const { value, done } = await reader.read();
						if (done) { break; }
						const text = new TextDecoder().decode(value);
						this.emitChunks(text, onChunk);
					}
				} else {
					const text = await res.text();
					this.emitChunks(text, onChunk);
				}
				return;
			} catch (e) {
				// eslint-disable-next-line no-console
				console.error('[NewmaBackendHost.streamChat] fallback fetch error:', e);
				this.emitChunks(`You said: ${prompt}. (local fallback)`, onChunk);
				return;
			}
		}

		const ok = await this.healthCheck();
		if (!ok) {
			this.emitChunks(`You said: ${prompt}. (local fallback)`, onChunk);
			return;
		}

		const body = VSBuffer.fromString(JSON.stringify({ prompt, apiKey, model, apiUrl, stream: true }));
		const headers: Record<string, string> = Object.assign({ 'content-type': 'application/json' }, this.buildAuthHeaders());

		try {
			const res = await this.requestService!.request({ type: 'POST', url: `${this.baseUrl}/v1/chat`, timeout: this.timeoutMs, headers, data: body.toString() }, CancellationToken.None);
			const status = res.res.statusCode ?? 0;
			// eslint-disable-next-line no-console
			console.log(`[NewmaBackendHost.streamChat] status=${status}`);
			if (status < 200 || status >= 300) {
				let errText = '';
				try {
					if (res.stream) {
						const buf = await streamToBuffer(res.stream);
						errText = buf.toString();
					}
				} catch { /* ignore */ }
				throw new Error(`chat request failed: ${status} ${errText}`);
			}
			if (res.stream) {
				// Node stream: push chunks as they arrive
				const readable: NodeJS.ReadableStream = res.stream as unknown as NodeJS.ReadableStream;
				readable.setEncoding?.('utf8');
				await new Promise<void>((resolve, reject) => {
					readable.on('data', (chunk: string | Buffer) => {
						const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
						this.emitChunks(text, onChunk);
					});
					readable.on('end', () => resolve());
					readable.on('error', err => reject(err));
				});
			}
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error('[NewmaBackendHost.streamChat] error:', err);
			this.emitChunks(`You said: ${prompt}. (local fallback)`, onChunk);
		}
	}

	private emitChunks(text: string, onChunk: (chunk: string) => void): void {
		// If this chunk contains SSE frames, never forward raw; only forward parsed content
		if (text.includes('data:')) {
			const parsed = this.parseSSEResponse(text);
			if (parsed && parsed.trim().length > 0) {
				onChunk(parsed);
			}
			return; // swallow control frames and non-content SSE
		}
		// Non-SSE plain text chunk
		const plain = text.trim();
		if (plain && plain !== '[DONE]') {
			onChunk(text);
		}
	}

	private parseSSEResponse(text: string): string {
		// Backend may return SSE format: "data: {...}\n\n" or plain text
		// Try to extract JSON from SSE lines and concatenate content fields
		const lines = text.split('\n');
		const contents: string[] = [];
		for (const line of lines) {
			if (line.startsWith('data: ')) {
				const jsonStr = line.slice(6).trim();
				// Skip control frames
				if (jsonStr === '[DONE]' || jsonStr === '') {
					continue;
				}
				try {
					const obj = JSON.parse(jsonStr);
					// Only extract non-empty content fields
					const deltaContent = obj.choices?.[0]?.delta?.content;
					const messageContent = obj.choices?.[0]?.message?.content;
					if (deltaContent && typeof deltaContent === 'string' && deltaContent.trim().length > 0) {
						contents.push(deltaContent);
					} else if (messageContent && typeof messageContent === 'string' && messageContent.trim().length > 0) {
						contents.push(messageContent);
					}
					// Skip frames that only have finish_reason, usage, id, etc. (no actual content)
				} catch {
					// Not JSON, ignore this line
				}
			} else if (line.trim() && !line.startsWith(':') && !line.startsWith('event:') && !line.startsWith('id:') && !line.startsWith('data:')) {
				// Plain text line, keep as-is (but skip any line that looks like SSE)
				contents.push(line);
			}
		}
		return contents.join('');
	}

	private buildAuthHeaders(): Record<string, string> | undefined {
		const key = this.resolveApiKey();
		if (!key) { return undefined; }
		// Prefer Authorization bearer; backend also accepts apiKey in body
		return { Authorization: `Bearer ${key}` };
	}

	private resolveApiKey(): string | undefined {
		// Prefer VS Code settings
		const settingKey = this.apiKeySettingKey || 'newma.backend.apiKey';
		try {
			const key = this.configurationService?.getValue<string>(settingKey);
			if (key && typeof key === 'string' && key.trim()) {
				return key.trim();
			}
		} catch {
			// ignore
		}
		// Fallback to common env vars
		return process.env.NEWMA_API_KEY || process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_API_KEY;
	}

	private resolveModel(): string {
		try {
			const model = this.configurationService?.getValue<string>('newma.backend.model');
			if (model && typeof model === 'string' && model.trim()) {
				return model.trim();
			}
		} catch {
			// ignore
		}
		return 'gpt-4'; // default
	}

	private resolveApiUrl(): string {
		try {
			const apiUrl = this.configurationService?.getValue<string>('newma.backend.apiUrl');
			if (apiUrl && typeof apiUrl === 'string' && apiUrl.trim()) {
				return apiUrl.trim();
			}
		} catch {
			// ignore
		}
		return 'https://api.openai.com/v1/chat/completions'; // default
	}

	private async isTaskRequest(prompt: string, overrides?: { apiKey?: string; model?: string; apiUrl?: string }): Promise<boolean> {
		// Use AI model to determine if the prompt is a task request (needs execution) vs a conversation (just needs an answer)
		const analysisPrompt = `Analyze the following user message and determine if it is a task request that requires execution actions (like creating files, running commands, modifying code) or just a conversational question that needs an answer.

Task requests typically:
- Ask to do something: "create", "write", "run", "modify", "delete", "install", "configure"
- Request actions: "帮我", "please do", "can you make", "implement", "setup"
- Are imperative: "do this", "make that", "set up"

Conversational questions typically:
- Ask for information: "what is", "how does", "explain", "tell me about"
- Ask for opinions: "what do you think", "should I", "is it better"
- Are greetings or casual chat: "hello", "hi", "thanks", "你好"

User message: "${prompt}"

Respond with ONLY "true" if it's a task request, or "false" if it's a conversational question.`;

		try {
			const response = await this.postChat(analysisPrompt, overrides);
			const normalized = response.trim().toLowerCase();
			// Check if response contains "true" (may be prefixed with "yes" or other text)
			return normalized.includes('true') || normalized.startsWith('yes') || normalized === '1';
		} catch (error) {
			// eslint-disable-next-line no-console
			console.warn('[NewmaBackendHost.isTaskRequest] failed, defaulting to false:', error);
			// On error, default to false (treat as conversation) to avoid blocking users
			return false;
		}
	}

	private async buildPlan(userPrompt: string, overrides?: { apiKey?: string; model?: string; apiUrl?: string }): Promise<Array<{ index: number; title: string; intent: string; sideEffects: boolean; instruction: string }>> {
		// Use AI model to break down user intent into multiple executable steps
		const systemPrompt = `You are a senior development assistant. Please break down the user's goal into a finite list of executable steps.
Output strictly a JSON array, where each element contains: index (starting from 1), title, intent, sideEffects (boolean), instruction.
Output ONLY JSON, no explanatory text.

Example format:
[
  {"index": 1, "title": "Create configuration file", "intent": "Set up project configuration", "sideEffects": true, "instruction": "Create config.json with default settings"},
  {"index": 2, "title": "Install dependencies", "intent": "Prepare development environment", "sideEffects": false, "instruction": "Run npm install"},
  {"index": 3, "title": "Initialize database", "intent": "Set up data storage", "sideEffects": true, "instruction": "Run database migration script"}
]`;

		const fullPrompt = `${systemPrompt}\n\nUser goal: ${userPrompt}`;

		try {
			const text = await this.postChat(fullPrompt, overrides);
			// eslint-disable-next-line no-console
			console.log('[NewmaBackendHost.buildPlan] AI response:', text);

			// Extract JSON from response
			const jsonSnippet = this.extractJsonFromText(text);
			// eslint-disable-next-line no-console
			console.log('[NewmaBackendHost.buildPlan] Extracted JSON:', jsonSnippet);

			const parsed = JSON.parse(jsonSnippet);
			if (!Array.isArray(parsed)) {
				throw new Error('Plan is not an array');
			}

			const steps = parsed.map((s: any, i: number) => ({
				index: Number(s.index ?? i + 1),
				title: String(s.title ?? `Step ${i + 1}`),
				intent: String(s.intent ?? ''),
				sideEffects: Boolean(s.sideEffects ?? false),
				instruction: String(s.instruction ?? '')
			}));

			// If model returned empty array, fallback to single step
			if (steps.length === 0) {
				// eslint-disable-next-line no-console
				console.warn('[NewmaBackendHost.buildPlan] Empty plan, falling back to single step');
				return [{ index: 1, title: '执行请求', intent: userPrompt, sideEffects: false, instruction: userPrompt }];
			}

			return steps;
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error('[NewmaBackendHost.buildPlan] Failed to parse plan, falling back to single step:', error);
			// On error, fallback to single step
			return [{ index: 1, title: '执行请求', intent: userPrompt, sideEffects: false, instruction: userPrompt }];
		}
	}

	private extractJsonFromText(text: string): string {
		// Find the first '[' character
		const start = text.indexOf('[');
		if (start === -1) {
			return text.trim();
		}

		// Find the matching closing bracket
		let bracketCount = 0;
		let end = -1;
		for (let i = start; i < text.length; i++) {
			if (text[i] === '[') {
				bracketCount++;
			} else if (text[i] === ']') {
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

		// If no complete JSON found, try to extract partial JSON
		const partialJson = text.slice(start);
		// eslint-disable-next-line no-console
		console.warn('[NewmaBackendHost.extractJsonFromText] Incomplete JSON detected:', partialJson);
		return partialJson;
	}
}

// Re-export channel name for ease of import at registration sites
export { NEWMA_IPC_CHANNEL };


