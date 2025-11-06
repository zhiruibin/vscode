export async function streamWords(text, msPerWord, onChunk) {
    const words = text.split(/(\s+)/); // keep spaces
    for (let i = 0; i < words.length; i++) {
        onChunk(words[i]);
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, msPerWord));
    }
}
//# sourceMappingURL=stream.js.map