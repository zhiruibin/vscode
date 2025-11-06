console.log('Testing dynamic import...');
try {
	await import('./out/vs/code/electron-main/main.js');
	console.log('Dynamic import successful');
} catch (e) {
	console.error('Dynamic import failed:', e.message);
}


