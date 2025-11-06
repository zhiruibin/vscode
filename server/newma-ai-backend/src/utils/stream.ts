export async function streamWords(text: string, msPerWord: number, onChunk: (s: string) => void): Promise<void> {
	const words = text.split(/(\s+)/); // keep spaces
	for (let i = 0; i < words.length; i++) {
		onChunk(words[i]);
		// eslint-disable-next-line no-await-in-loop
		await new Promise(resolve => setTimeout(resolve, msPerWord));
	}
}
