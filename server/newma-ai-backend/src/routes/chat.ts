/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Router, type Request, type Response } from 'express';
import { streamWords } from '../utils/stream.js';
import OpenAI from 'openai';

export const chatRouter = Router();

// Initialize OpenAI client
const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY || '',
});

chatRouter.post('/', async (req: Request, res: Response) => {
	// Reduced logging for performance
	console.log('=== SERVER: Received chat request ===');

	const { prompt, model = 'gpt-4', apiUrl, apiKey, apiHeaders = {} } = req.body ?? {};

	if (typeof prompt !== 'string' || !prompt.trim()) {
		console.log('ERROR: Invalid prompt - prompt is required');
		return res.status(400).json({ error: 'prompt is required' });
	}

    // Check if API key is available (prefer request headers/body, then env)
    const getHeader = (name: string): string | undefined => {
        const v = req.headers[name.toLowerCase()] as string | string[] | undefined;
        if (Array.isArray(v)) { return v[0]; }
        return v;
    };
    const authHeader = getHeader('authorization');
    const xApiKeyHeader = getHeader('x-api-key');
    const headerKey = authHeader && authHeader.toLowerCase().startsWith('bearer ')
        ? authHeader.slice(7).trim()
        : (authHeader || '').trim();
    const finalApiKey = (apiKey as string | undefined)?.trim() || xApiKeyHeader || headerKey || process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_API_KEY;
    // Debug log headers presence (masked)
    const mask = (k?: string) => k ? '*****' + k.substring(Math.max(0, k.length - 4)) : 'none';
    console.log('Auth header present:', !!authHeader, 'value:', mask(headerKey));
    console.log('x-api-key header present:', !!xApiKeyHeader, 'value:', mask(xApiKeyHeader));
	// Simplified logging for performance
	console.log('Using API key:', finalApiKey ? '*****' + finalApiKey.substring(finalApiKey.length - 4) : 'Not provided');

	if (!finalApiKey) {
		console.log('WARNING: No API key found, falling back to simulated response');
		return handleSimulatedResponse(prompt, res);
	}

	try {
        console.log('Setting response headers...');
        // 默认按 chunked 文本返回；若使用 SSE，我们在下方切换为 text/event-stream
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

		// Use user-provided API URL or default
		let finalApiUrl = apiUrl || 'https://api.openai.com/v1/chat/completions';

		// Ensure API URL is complete for DeepSeek
		if (finalApiUrl.includes('api.deepseek.com/v1') && !finalApiUrl.includes('/chat/completions')) {
			finalApiUrl = 'https://api.deepseek.com/v1/chat/completions';
		}

		const providerName = 'AI Provider';

		console.log(`Calling ${providerName} API...`);
		console.log('API URL:', finalApiUrl);
		console.log('Model:', model);

		// Prepare headers
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			...apiHeaders
		};

		// Add default auth header if not provided in apiHeaders
		if (!headers['Authorization'] && !headers['x-api-key']) {
			if (finalApiUrl.includes('anthropic.com')) {
				headers['x-api-key'] = finalApiKey;
				headers['anthropic-version'] = '2023-06-01';
			} else {
				// For DeepSeek and OpenAI, use Bearer token
				headers['Authorization'] = `Bearer ${finalApiKey}`;
			}
		}

		const sysPrompt = (req.body?.systemPrompt as string) || 'You are Newma AI Assistant, a helpful coding assistant integrated into VS Code. Provide clear, concise, and helpful responses in Chinese. Focus on practical solutions and avoid generic templates. If the user asks about code, provide specific examples and explanations.';
		const reqTemperature = typeof req.body?.temperature === 'number' ? req.body.temperature : 0.2;
		const reqMaxTokens = typeof req.body?.max_tokens === 'number' ? req.body.max_tokens : 1000;

        const requestBody = {
            model: model as string,
            messages: [
                {
                    role: 'system',
                    content: sysPrompt
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            // DeepSeek 在部分区域可能返回非预期 SSE；如需一次性返回可置 false
            stream: finalApiUrl.includes('api.deepseek.com') ? true : true,
            temperature: reqTemperature,
            max_tokens: reqMaxTokens
        };

		// Add retry mechanism with timeout
		const maxRetries = 3;
		const timeoutMs = 30000; // 30 seconds timeout
		let lastError: Error | null = null;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				console.log(`API call attempt ${attempt}/${maxRetries}`);

				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

				const response = await fetch(finalApiUrl, {
					method: 'POST',
					headers,
					body: JSON.stringify(requestBody),
					signal: controller.signal
				});

				clearTimeout(timeoutId);

                if (!response.ok) {
					const errorText = await response.text();
					throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
				}

                // If we disabled streaming (e.g., DeepSeek), read JSON once
                if (!requestBody.stream) {
                    const json = await response.json().catch(async () => {
                        const txt = await response.text();
                        try { return JSON.parse(txt); } catch { return { raw: txt }; }
                    });
                    let finalText = '';
                    try {
                        if (json?.choices?.[0]?.message?.content) {
                            finalText = json.choices[0].message.content;
                        } else if (Array.isArray(json?.choices) && json.choices[0]?.text) {
                            finalText = json.choices[0].text;
                        } else if (typeof json?.raw === 'string') {
                            finalText = json.raw;
                        }
                    } catch { /* ignore */ }
                    finalText = (finalText || '').trim();
                    // If still empty, return the raw JSON for visibility
                    if (!finalText) {
                        try {
                            finalText = JSON.stringify(json);
                        } catch {
                            finalText = String(json ?? '');
                        }
                    }
                    console.log(`${providerName} JSON response completed, length=${finalText.length}, sending...`);
                    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                    res.status(200).send(finalText || `You said: ${prompt}. This is a simulated local response from Newma backend.\n`);
                    console.log('=== SERVER: Chat request completed ===');
                    return;
                }

                // Success - stream provider response to client in real-time (SSE)
                console.log(`Starting to stream ${providerName} response...`);
                const reader = response.body?.getReader();
                const decoder = new TextDecoder();

                if (!reader) {
                    throw new Error('No response body');
                }

                // Switch to SSE for stable streaming over proxies/buffers
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                (res as any).flushHeaders?.();

                const writeSse = (payload: string) => {
                    res.write(`data: ${payload}\n\n`);
                    (res as any).flush?.();
                };

                let usedPassthroughSSE = false;
                let sawDone = false;
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) { break; }

                        const chunk = decoder.decode(value, { stream: true });

                        // If upstream already sends SSE lines, parse and filter; otherwise wrap as SSE JSON delta
                        const parts = chunk.split('\n\n');
                        for (const part of parts) {
                            if (!part) { continue; }
                            if (part.startsWith('data:')) {
                                usedPassthroughSSE = true;
                                const line = part.trimEnd();
                                const jsonStr = line.slice(5).trim(); // remove "data:" prefix
                                if (jsonStr === '[DONE]') {
                                    if (!sawDone) { res.write('data: [DONE]\n\n'); sawDone = true; }
                                } else {
                                    // Only passthrough SSE frames that contain actual content
                                    try {
                                        const obj = JSON.parse(jsonStr);
                                        const hasContent = obj.choices?.[0]?.delta?.content &&
                                                         typeof obj.choices[0].delta.content === 'string' &&
                                                         obj.choices[0].delta.content.trim().length > 0;
                                        if (hasContent) {
                                            res.write(line + '\n\n');
                                        }
                                        // Skip frames that only have finish_reason, usage, id, etc.
                                    } catch {
                                        // If not JSON, skip this line (could be malformed SSE)
                                    }
                                }
                            } else {
                                const json = JSON.stringify({ choices: [{ delta: { content: part } }] });
                                writeSse(json);
                            }
                        }
                    }
                } finally {
                    try { reader.releaseLock(); } catch { /* ignore */ }
                }

                // End of stream
                if (!usedPassthroughSSE || !sawDone) {
                    writeSse('[DONE]');
                }
                res.end();
                console.log('=== SERVER: Chat request completed ===');
                return;

			} catch (error) {
				lastError = error as Error;
				console.log(`Attempt ${attempt} failed:`, error instanceof Error ? error.message : 'Unknown error');

				if (attempt < maxRetries) {
					// Wait before retry (exponential backoff)
					const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
					console.log(`Waiting ${delay}ms before retry...`);
					await new Promise(resolve => setTimeout(resolve, delay));
				}
			}
		}

		// All retries failed
		console.error('All API attempts failed:', lastError);
		throw lastError || new Error('API request failed after all retries');
	} catch (error) {
		console.error('API error:', error);
		console.log('Falling back to simulated response...');
		return handleSimulatedResponse(prompt, res);
	}
});

// Fallback simulated response function
async function handleSimulatedResponse(prompt: string, res: Response) {
	console.log('Setting response headers...');
	res.setHeader('Content-Type', 'text/plain; charset=utf-8');
	res.setHeader('Transfer-Encoding', 'chunked');

	const answer = `You said: ${prompt}. This is a simulated local response from Newma backend.\n`;
	console.log('Generated answer:', answer);
	console.log('Starting to stream response...');

	await streamWords(answer, 20, chunk => {
		console.log('Streaming chunk:', chunk);
		res.write(chunk);
	});

	console.log('Response streaming completed, ending response...');
	res.end();
	console.log('=== SERVER: Chat request completed ===');
}
