// Test script for DeepSeek API
import fetch from 'node-fetch';

async function testDeepSeekAPI() {
	const apiKey = process.env.DEEPSEEK_API_KEY || 'your-api-key-here';
	const apiUrl = 'https://api.deepseek.com/v1/chat/completions';

	console.log('Testing DeepSeek API...');
	console.log('API URL:', apiUrl);
	console.log('API Key (last 4 chars):', apiKey ? '****' + apiKey.slice(-4) : 'Not provided');

	const requestBody = {
		model: 'deepseek-chat',
		messages: [
			{
				role: 'user',
				content: 'Hello, this is a test message.'
			}
		],
		stream: false,
		temperature: 0.7,
		max_tokens: 100
	};

	const headers = {
		'Authorization': `Bearer ${apiKey}`,
		'Content-Type': 'application/json'
	};

	console.log('Request headers:', headers);
	console.log('Request body:', JSON.stringify(requestBody, null, 2));

	try {
		const response = await fetch(apiUrl, {
			method: 'POST',
			headers,
			body: JSON.stringify(requestBody)
		});

		console.log('Response status:', response.status);
		console.log('Response status text:', response.statusText);

		if (!response.ok) {
			const errorText = await response.text();
			console.log('Error response:', errorText);
			return;
		}

		const data = await response.json();
		console.log('Success! Response:', JSON.stringify(data, null, 2));

	} catch (error) {
		console.error('Request failed:', error);
	}
}

testDeepSeekAPI();
