/*---------------------------------------------------------------------------------------------
 *  Newma AI - Core service contracts (DI-ready)
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';

export interface NewmaPlanStep {
	index: number;
	title: string;
	intent: string;
	sideEffects: boolean;
	instruction: string;
}

export interface GenerateOptions {
	onProgress?: (chunk: string) => void;
}

export interface INewmaAiService {
	readonly _serviceBrand: undefined;
	generateResponse(prompt: string, options?: GenerateOptions): Promise<string>;
	buildPlan(prompt: string): Promise<NewmaPlanStep[]>;
	healthCheck(): Promise<boolean>;
	isTaskRequest(prompt: string): Promise<boolean>;
}

export const INewmaAiService = createDecorator<INewmaAiService>('newmaAiService');


