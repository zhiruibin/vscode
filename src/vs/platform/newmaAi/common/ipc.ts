/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const enum NewmaIpcCommand {
	Generate = 'generate',
	BuildPlan = 'buildPlan',
	HealthCheck = 'healthCheck',
	IsTaskRequest = 'isTaskRequest'
}

export const NEWMA_IPC_CHANNEL = 'newmaAi';

export const enum NewmaIpcEvent {
	GenerateStream = 'generateStream'
}

export interface GenerateRequest {
	prompt: string;
	apiKey?: string;
	model?: string;
	apiUrl?: string;
}

export interface GenerateResponse {
	text: string;
}

export interface StreamingChunk {
	chunk?: string;
	end?: boolean;
	error?: string;
}

export interface BuildPlanRequest {
	prompt: string;
}

export interface PlanStepDTO {
	index: number;
	title: string;
	intent: string;
	sideEffects: boolean;
	instruction: string;
}

export interface BuildPlanResponse {
	steps: PlanStepDTO[];
}

export interface HealthCheckResponse {
	ok: boolean;
}

export interface IsTaskRequestRequest {
	prompt: string;
	apiKey?: string;
	model?: string;
	apiUrl?: string;
}

export interface IsTaskRequestResponse {
	isTask: boolean;
}



