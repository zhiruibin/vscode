import * as vscode from 'vscode';

export interface CodeExplanationOptions {
	language?: string;
	includeComments?: boolean;
	includeExamples?: boolean;
	includeBestPractices?: boolean;
	depth?: 'basic' | 'detailed' | 'comprehensive';
}

export interface CodeCommentOptions {
	style?: 'inline' | 'block' | 'javadoc' | 'jsdoc' | 'python-docstring';
	language?: string;
	includeTypes?: boolean;
	includeExamples?: boolean;
}

export class CodeExplainer {
	private config: vscode.WorkspaceConfiguration;

	constructor() {
		this.config = vscode.workspace.getConfiguration('newma-ai-assistant');
	}

	/**
	 * Generate code explanation
	 */
	async generateCodeExplanation(
		code: string,
		options: CodeExplanationOptions = {}
	): Promise<string> {
		const {
			language = this.detectLanguage(),
			includeComments = true,
			includeExamples = true,
			includeBestPractices = true,
			depth = 'detailed'
		} = options;

		const prompt = this.buildExplanationPrompt(code, {
			language,
			includeComments,
			includeExamples,
			includeBestPractices,
			depth
		});

		return prompt;
	}

	/**
	 * Generate code comments
	 */
	async generateCodeComments(
		code: string,
		options: CodeCommentOptions = {}
	): Promise<string> {
		const {
			style = 'block',
			language = this.detectLanguage(),
			includeTypes = true,
			includeExamples = true
		} = options;

		const prompt = this.buildCommentPrompt(code, {
			style,
			language,
			includeTypes,
			includeExamples
		});

		return prompt;
	}

	/**
	 * Generate function documentation
	 */
	async generateFunctionDocumentation(
		code: string,
		language: string
	): Promise<string> {
		const prompt = `You are a documentation expert. Generate comprehensive documentation for the following ${language} function:

\`\`\`${language}
${code}
\`\`\`

Please provide:
1. Function purpose and description
2. Parameter documentation with types and descriptions
3. Return value documentation
4. Usage examples
5. Error handling information
6. Performance considerations
7. Related functions or dependencies

Format the documentation according to ${language} conventions (e.g., JSDoc for JavaScript, docstring for Python, etc.).`;

		return prompt;
	}

	/**
	 * Generate API documentation
	 */
	async generateAPIDocumentation(
		code: string,
		language: string
	): Promise<string> {
		const prompt = `You are an API documentation expert. Generate comprehensive API documentation for the following ${language} code:

\`\`\`${language}
${code}
\`\`\`

Please provide:
1. API overview and purpose
2. Endpoint documentation (if applicable)
3. Request/response schemas
4. Authentication requirements
5. Rate limiting information
6. Error codes and responses
7. Usage examples
8. SDK examples for different languages

Format the documentation in a clear, professional manner suitable for developers.`;

		return prompt;
	}

	/**
	 * Generate code review comments
	 */
	async generateCodeReviewComments(
		code: string,
		language: string
	): Promise<string> {
		const prompt = `You are a senior code reviewer. Analyze the following ${language} code and provide constructive feedback:

\`\`\`${language}
${code}
\`\`\`

Please provide:
1. Code quality assessment
2. Potential bugs or issues
3. Performance improvements
4. Security considerations
5. Best practices recommendations
6. Code style suggestions
7. Refactoring opportunities
8. Positive aspects to maintain

Focus on actionable feedback that helps improve the code.`;

		return prompt;
	}

	/**
	 * Generate learning materials
	 */
	async generateLearningMaterials(
		code: string,
		language: string,
		topic: string
	): Promise<string> {
		const prompt = `You are an educational content creator. Create learning materials for the following ${language} code related to "${topic}":

\`\`\`${language}
${code}
\`\`\`

Please provide:
1. Learning objectives
2. Concept explanations
3. Step-by-step walkthrough
4. Key concepts and terminology
5. Practice exercises
6. Common mistakes to avoid
7. Further reading suggestions
8. Real-world applications

Make the content accessible for learners at different levels.`;

		return prompt;
	}

	/**
	 * Extract code patterns
	 */
	async extractCodePatterns(
		code: string,
		language: string
	): Promise<string> {
		const prompt = `You are a software architecture expert. Analyze the following ${language} code and identify patterns:

\`\`\`${language}
${code}
\`\`\`

Please identify and explain:
1. Design patterns used
2. Architectural patterns
3. Coding patterns and conventions
4. Anti-patterns (if any)
5. Pattern benefits and trade-offs
6. Alternative pattern implementations
7. Pattern relationships
8. Recommendations for improvement

Focus on practical pattern recognition and application.`;

		return prompt;
	}

	/**
	 * Generate code metrics and analysis
	 */
	async generateCodeMetrics(
		code: string,
		language: string
	): Promise<string> {
		const prompt = `You are a code quality analyst. Analyze the following ${language} code and provide metrics:

\`\`\`${language}
${code}
\`\`\`

Please provide:
1. Complexity metrics (cyclomatic complexity, nesting depth)
2. Maintainability indicators
3. Readability assessment
4. Testability evaluation
5. Performance characteristics
6. Security considerations
7. Code coverage suggestions
8. Refactoring priorities

Include specific recommendations for improvement.`;

		return prompt;
	}

	private buildExplanationPrompt(
		code: string,
		options: CodeExplanationOptions
	): string {
		const { language, includeComments, includeExamples, includeBestPractices, depth } = options;

		let prompt = `You are a code explanation expert. Provide a ${depth} explanation of the following ${language} code:

\`\`\`${language}
${code}
\`\`\`

Please provide:`;

		if (includeComments) {
			prompt += `\n1. Line-by-line explanation of what the code does`;
		}

		prompt += `\n2. Overall purpose and functionality`;

		if (includeExamples) {
			prompt += `\n3. Usage examples and input/output scenarios`;
		}

		prompt += `\n4. Key concepts and techniques used`;

		if (includeBestPractices) {
			prompt += `\n5. Best practices demonstrated`;
		}

		if (depth === 'detailed' || depth === 'comprehensive') {
			prompt += `\n6. Potential improvements or alternatives`;
		}

		if (depth === 'comprehensive') {
			prompt += `\n7. Related concepts and further learning`;
			prompt += `\n8. Common pitfalls and how to avoid them`;
		}

		prompt += `\n\nFormat your explanation clearly with proper markdown formatting.`;

		return prompt;
	}

	private buildCommentPrompt(
		code: string,
		options: CodeCommentOptions
	): string {
		const { style, language, includeTypes, includeExamples } = options;

		let prompt = `You are a code documentation expert. Generate ${style} comments for the following ${language} code:

\`\`\`${language}
${code}
\`\`\`

Please provide:`;

		if (style === 'inline') {
			prompt += `\n1. Inline comments explaining complex logic`;
		} else if (style === 'block') {
			prompt += `\n1. Block comments for functions and classes`;
		} else if (style === 'javadoc' || style === 'jsdoc') {
			prompt += `\n1. JSDoc/Javadoc style documentation`;
		} else if (style === 'python-docstring') {
			prompt += `\n1. Python docstring format`;
		}

		prompt += `\n2. Clear, concise descriptions`;

		if (includeTypes) {
			prompt += `\n3. Type information and parameter descriptions`;
		}

		if (includeExamples) {
			prompt += `\n4. Usage examples in comments`;
		}

		prompt += `\n5. Return value descriptions`;
		prompt += `\n6. Error handling information`;

		prompt += `\n\nFormat the comments according to ${language} conventions and ${style} style.`;

		return prompt;
	}

	private detectLanguage(): string {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			return editor.document.languageId;
		}
		return 'javascript';
	}

	/**
	 * Get comment style for language
	 */
	getCommentStyle(language: string): string {
		const styles: { [key: string]: string } = {
			'javascript': 'jsdoc',
			'typescript': 'jsdoc',
			'java': 'javadoc',
			'python': 'python-docstring',
			'csharp': 'xml',
			'cpp': 'block',
			'c': 'block',
			'go': 'block',
			'rust': 'block',
			'php': 'phpdoc',
			'ruby': 'rdoc',
			'swift': 'swift',
			'kotlin': 'kdoc',
			'scala': 'scaladoc'
		};

		return styles[language] || 'block';
	}

	/**
	 * Format code with comments
	 */
	formatCodeWithComments(code: string, comments: string, language: string): string {
		// This would integrate with the AI service to format the code
		// For now, return a simple concatenation
		return `${comments}\n\n${code}`;
	}
}



