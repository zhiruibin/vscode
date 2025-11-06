import * as vscode from 'vscode';

export interface AIResponse {
	content: string;
	success: boolean;
	error?: string;
}

export interface AIProgressCallback {
	onProgress: (chunk: string) => void;
	token?: vscode.CancellationToken;
}

export class AIService {
	private config: vscode.WorkspaceConfiguration;

	constructor() {
		this.config = vscode.workspace.getConfiguration('newma-ai-assistant');
	}

	async initialize(): Promise<void> {
		// Initialize AI service configuration
		console.log('AIService initialized');
	}

	async generateResponse(
		prompt: string,
		options: AIProgressCallback
	): Promise<string> {
		const model = this.config.get<string>('model', 'gpt-4');
		const apiKey = this.config.get<string>('apiKey', '');
		const apiUrl = this.config.get<string>('apiUrl', 'https://api.openai.com/v1/chat/completions');
		const apiHeaders = this.config.get<Record<string, string>>('apiHeaders', {});

		// Always use backend server for optimized performance
		console.log('Using backend server for AI response...');
		return this.callCustomEndpoint(prompt, apiKey, model, options);
	}

	private async callOpenAI(
		prompt: string,
		apiKey: string,
		model: string,
		options: AIProgressCallback
	): Promise<string> {

		const response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model: model,
				messages: [
					{
						role: 'user',
						content: prompt
					}
				],
				stream: true
			})
		});

		if (!response.ok) {
			throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
		}

		return this.handleStreamingResponse(response, options);
	}

	private async callAnthropic(
		prompt: string,
		apiKey: string,
		model: string,
		options: AIProgressCallback
	): Promise<string> {

		const response = await fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: {
				'x-api-key': apiKey,
				'Content-Type': 'application/json',
				'anthropic-version': '2023-06-01'
			},
			body: JSON.stringify({
				model: model,
				max_tokens: 4000,
				messages: [
					{
						role: 'user',
						content: prompt
					}
				]
			})
		});

		if (!response.ok) {
			throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();
		return data.content[0].text;
	}

	private async callCustomEndpoint(
		prompt: string,
		apiKey: string,
		model: string,
		options: AIProgressCallback
	): Promise<string> {
		const endpoint = this.config.get<string>('endpoint', 'http://127.0.0.1:3901/v1/chat');

		const requestBody = {
			prompt: prompt,
			model: model,
			apiKey: apiKey,
			apiUrl: this.config.get<string>('apiUrl', 'https://api.openai.com/v1/chat/completions'),
			apiHeaders: this.config.get<Record<string, string>>('apiHeaders', {}),
			temperature: this.config.get<number>('temperature', 0.2),
			max_tokens: this.config.get<number>('maxTokens', 1000),
			systemPrompt: this.config.get<string>('systemPrompt', '你是 Newma VS Code 助手。用中文回答。只基于提供的上下文，不猜测未知信息。优先给出结构化要点和可执行步骤，避免模板化空话。')
		};

		// Add retry mechanism
		const maxRetries = 3;
		const timeoutMs = 180000; // 180 seconds (3 minutes) timeout to handle large responses (300KB+)
		let lastError: Error | null = null;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				console.log(`API call attempt ${attempt}/${maxRetries}`);

				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

				// Listen for cancellation token
				if (options.token) {
					const tokenListener = options.token.onCancellationRequested(() => {
						controller.abort();
					});
					// Clean up listener after request
					setTimeout(() => tokenListener.dispose(), timeoutMs);
				}

				console.log(`Making request to: ${endpoint}`);
				console.log(`Request body size: ${JSON.stringify(requestBody).length} bytes`);

				const response = await fetch(endpoint, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Accept': 'application/json',
						'User-Agent': 'Newma-AI-Assistant/1.0.0'
					},
					body: JSON.stringify(requestBody),
					signal: controller.signal
				});

				console.log(`Response status: ${response.status} ${response.statusText}`);
				// Log headers in a compatible way
				const headers: string[] = [];
				response.headers.forEach((value, key) => {
					headers.push(`${key}: ${value}`);
				});
				console.log(`Response headers:`, headers);

				clearTimeout(timeoutId);

				if (!response.ok) {
					const errorText = await response.text();
					throw new Error(`Backend error: ${response.status} ${response.statusText} - ${errorText}`);
				}

				// Success - handle streaming response
				return await this.handleCustomStreamingResponse(response, options);

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
		throw lastError || new Error('Backend request failed after all retries');
	}

	private async handleCustomStreamingResponse(
		response: Response,
		options: AIProgressCallback
	): Promise<string> {
		let fullResponse = '';

		if (!response.body) {
			throw new Error('No response body');
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();

		try {
			console.log('Starting to read response stream...');
			let chunkCount = 0;
			let lastProgressTime = Date.now();

			while (true) {
				if (options.token?.isCancellationRequested) {
					console.log('Request cancelled by token');
					throw new Error('Request cancelled');
				}

				// Add timeout per chunk read to detect stuck connections
				const chunkTimeout = new Promise<never>((_, reject) => {
					setTimeout(() => reject(new Error('Chunk read timeout')), 120000); // 2 minutes per chunk
				});

				let readResult: ReadableStreamReadResult<Uint8Array>;
				try {
					readResult = await Promise.race([
						reader.read(),
						chunkTimeout
					]);
				} catch (error) {
					if (error instanceof Error && error.message === 'Chunk read timeout') {
						console.error('Chunk read timeout - connection may be stuck');
						throw new Error('Response timeout: no data received for 2 minutes');
					}
					throw error;
				}

				const { done, value } = readResult;
				if (done) {
					console.log(`Response stream completed. Total chunks: ${chunkCount}, Total size: ${fullResponse.length} chars`);
					break;
				}

				const text = decoder.decode(value, { stream: true });
				fullResponse += text;
				options.onProgress(text);
				chunkCount++;

				const now = Date.now();
				if (chunkCount % 100 === 0 || (now - lastProgressTime) > 5000) {
					console.log(`Processed ${chunkCount} chunks, current size: ${fullResponse.length} chars`);
					lastProgressTime = now;
				}
			}

			// Final decode for any remaining buffered data
			const finalText = decoder.decode();
			if (finalText) {
				fullResponse += finalText;
				options.onProgress(finalText);
			}
		} catch (error) {
			console.error('Error reading response stream:', error);
			// If we have partial response, return it
			if (fullResponse.length > 0) {
				console.log(`Returning partial response: ${fullResponse.length} chars`);
				return fullResponse;
			}
			throw error;
		} finally {
			try {
				reader.releaseLock();
			} catch (e) {
				// Ignore release errors
			}
		}

		console.log(`Final response size: ${fullResponse.length} chars`);
		return fullResponse;
	}

	private async handleStreamingResponse(
		response: Response,
		options: AIProgressCallback
	): Promise<string> {

		let fullResponse = '';

		if (!response.body) {
			throw new Error('No response body');
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();

		try {
			while (true) {
				if (options.token?.isCancellationRequested) {
					throw new Error('Request cancelled');
				}

				const { done, value } = await reader.read();
				if (done) break;

				const text = decoder.decode(value, { stream: true });

				// Handle direct JSON streaming (not SSE format)
				fullResponse += text;
				options.onProgress(text);

				// Log the accumulated response for debugging
				console.log('PlanManager: Accumulated response so far:', fullResponse);
			}
		} finally {
			reader.releaseLock();
		}

		return fullResponse;
	}

	private async simulateLocalResponse(
		prompt: string,
		options: AIProgressCallback
	): Promise<string> {
		// Simulate a realistic AI response for development
		const responses = [
			`Hello! I'm Newma AI Assistant, your coding companion. I can help you with various programming tasks.

**What I can help you with:**
- Code generation and completion
- Debugging and error analysis
- Code review and optimization
- Documentation and explanations
- Project structure analysis

**Your request:** "${prompt}"

Here's a helpful response based on your query:

\`\`\`typescript
// Example code response
function processRequest(request: string): string {
    return \`Processing: \${request}\`;
}

const result = processRequest("${prompt}");
console.log(result);
\`\`\`

Is there anything specific you'd like me to help you with?`,

			`I understand you're asking about: "${prompt}"

Let me provide you with a comprehensive answer:

**Analysis:**
This appears to be a development-related question. Here's what I can suggest:

1. **Code Structure**: Consider organizing your code into modules
2. **Best Practices**: Follow TypeScript/JavaScript conventions
3. **Testing**: Implement proper unit tests
4. **Documentation**: Add clear comments and documentation

**Example Implementation:**
\`\`\`typescript
interface Response {
    success: boolean;
    data?: any;
    error?: string;
}

class NewmaAI {
    async processQuery(query: string): Promise<Response> {
        try {
            // Process the query
            const result = await this.analyzeQuery(query);
            return { success: true, data: result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}
\`\`\`

Would you like me to elaborate on any of these points?`,

			`Great question about: "${prompt}"

**Newma AI Response:**

I'm here to help you with your coding needs! Based on your request, here are some suggestions:

**Quick Solutions:**
- Use modern ES6+ features for better code quality
- Implement proper error handling
- Follow the DRY (Don't Repeat Yourself) principle
- Use TypeScript for better type safety

**Code Example:**
\`\`\`typescript
// Modern async/await pattern
async function handleRequest(input: string): Promise<string> {
    try {
        const processed = await processInput(input);
        return \`Success: \${processed}\`;
    } catch (error) {
        console.error('Error:', error);
        throw new Error(\`Failed to process: \${error.message}\`);
    }
}
\`\`\`

**Next Steps:**
1. Review the code structure
2. Add proper error handling
3. Implement unit tests
4. Consider performance optimization

Need more specific help? Just ask!`
		];

		const response = responses[Math.floor(Math.random() * responses.length)];

		// Simulate streaming response
		const words = response.split(' ');
		let fullResponse = '';

		for (let i = 0; i < words.length; i++) {
			if (options.token?.isCancellationRequested) {
				return 'Response cancelled.';
			}

			await new Promise(resolve => setTimeout(resolve, 50)); // Simulate delay
			const word = words[i] + (i < words.length - 1 ? ' ' : '');
			fullResponse += word;
			options.onProgress(word);
		}

		return fullResponse;
	}

	async testConnection(): Promise<{ success: boolean; error?: string }> {
		try {
			await this.generateResponse('Hello, this is a test message.', {
				onProgress: () => { },
				token: new vscode.CancellationTokenSource().token
			});
			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}
}
