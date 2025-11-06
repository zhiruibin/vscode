/*---------------------------------------------------------------------------------------------
 *  Newma AI - Browser service implementation (singleton registration)
 *--------------------------------------------------------------------------------------------*/

import { INewmaAiService, NewmaPlanStep, GenerateOptions } from '../common/newmaAi.js';
import { InstantiationType, registerSingleton } from '../../instantiation/common/extensions.js';
import { ISharedProcessService } from '../../ipc/electron-browser/services.js';
import { NEWMA_IPC_CHANNEL, NewmaIpcCommand, NewmaIpcEvent, StreamingChunk } from '../common/ipc.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';

export class NewmaAiService implements INewmaAiService {
	readonly _serviceBrand: undefined;

	constructor(
		@ISharedProcessService private readonly sharedProcessService: ISharedProcessService,
		@IConfigurationService private readonly configurationService: IConfigurationService
	) { }

	async generateResponse(prompt: string, options?: GenerateOptions): Promise<string> {
		const channel = this.sharedProcessService.getChannel(NEWMA_IPC_CHANNEL);
		const apiKey = this.configurationService.getValue<string>('newma.backend.apiKey') || undefined;
		const model = this.configurationService.getValue<string>('newma.backend.model') || undefined;
		const apiUrl = this.configurationService.getValue<string>('newma.backend.apiUrl') || undefined;
		if (options?.onProgress) {
			let collected = '';
			// eslint-disable-next-line no-console
			console.log('[NewmaAiService] Subscribing to GenerateStream with streaming on');
			const event = channel.listen<StreamingChunk>(NewmaIpcEvent.GenerateStream, { prompt, apiKey, model, apiUrl });
			await new Promise<void>((resolve) => {
				const dispose = event(e => {
					if (e?.chunk) {
						// Final safety filter: discard any chunk that looks like raw SSE control frames
						if (e.chunk.trim().startsWith('data:') || e.chunk.trim() === '[DONE]') {
							return; // ignore control frames that leaked through
						}
						collected += e.chunk;
						// eslint-disable-next-line no-console
						console.log('[NewmaAiService] received chunk len=', e.chunk.length);
						options.onProgress!(e.chunk);
					}
					if (e?.error) {
						// forward as text chunk to surface in UI
						const errText = `\n[error] ${e.error}`;
						collected += errText;
						options.onProgress!(errText);
					}
					if (e?.end) {
						// eslint-disable-next-line no-console
						console.log('[NewmaAiService] stream end');
						dispose.dispose();
						resolve();
					}
				});
			});
			return collected;
		}
		const res = await channel.call<{ text: string }>(NewmaIpcCommand.Generate, { prompt, apiKey, model, apiUrl });
		return res?.text ?? '';
	}

	async buildPlan(prompt: string): Promise<NewmaPlanStep[]> {
		const channel = this.sharedProcessService.getChannel(NEWMA_IPC_CHANNEL);
		const apiKey = this.configurationService.getValue<string>('newma.backend.apiKey') || undefined;
		const model = this.configurationService.getValue<string>('newma.backend.model') || undefined;
		const apiUrl = this.configurationService.getValue<string>('newma.backend.apiUrl') || undefined;
		const res = await channel.call<{ steps: NewmaPlanStep[] }>(NewmaIpcCommand.BuildPlan, { prompt, apiKey, model, apiUrl });
		return res?.steps ?? [];
	}

	async healthCheck(): Promise<boolean> {
		const channel = this.sharedProcessService.getChannel(NEWMA_IPC_CHANNEL);
		const res = await channel.call<{ ok: boolean }>(NewmaIpcCommand.HealthCheck);
		return !!res?.ok;
	}

	async isTaskRequest(prompt: string): Promise<boolean> {
		const channel = this.sharedProcessService.getChannel(NEWMA_IPC_CHANNEL);
		const apiKey = this.configurationService.getValue<string>('newma.backend.apiKey') || undefined;
		const model = this.configurationService.getValue<string>('newma.backend.model') || undefined;
		const apiUrl = this.configurationService.getValue<string>('newma.backend.apiUrl') || undefined;
		const res = await channel.call<{ isTask: boolean }>(NewmaIpcCommand.IsTaskRequest, { prompt, apiKey, model, apiUrl });
		return !!res?.isTask;
	}
}

registerSingleton(INewmaAiService, NewmaAiService, InstantiationType.Delayed);
