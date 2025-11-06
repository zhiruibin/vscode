const electron = require('@vscode/gulp-electron');
const fs = require('fs');
const path = require('path');

// 读取 product.json 来获取配置
const product = JSON.parse(fs.readFileSync('product.json', 'utf8'));

const config = {
	version: '33.1.0',
	productAppName: product.nameLong,
	companyName: 'Microsoft Corporation',
	copyright: 'Copyright (C) 2024 Microsoft. All rights reserved',
	darwinIcon: 'resources/darwin/newma.icns',
	darwinBundleIdentifier: product.darwinBundleIdentifier,
	darwinApplicationCategoryType: 'public.app-category.developer-tools',
	platform: 'darwin',
	arch: 'arm64',
	ffmpegChromium: false,
	keepDefaultApp: false,
	token: process.env['GITHUB_TOKEN'],
	repo: product.electronRepository || undefined,
	validateChecksum: true,
	checksumFile: path.join(__dirname, 'build', 'checksums', 'electron.txt'),
};

console.log('Testing @vscode/gulp-electron with config:', JSON.stringify(config, null, 2));

// 创建一个简单的测试流
const { Readable } = require('stream');
const { Transform } = require('stream');

// 创建一个包含 package.json 的虚拟文件流
const packageJsonContent = JSON.stringify({
	name: product.nameShort,
	version: '1.106.0',
	main: 'main.js'
}, null, 2);

const packageJsonFile = {
	relative: 'package.json',
	contents: Buffer.from(packageJsonContent),
	path: path.join(__dirname, 'package.json'),
	base: __dirname,
	cwd: __dirname,
	stat: fs.statSync('package.json')
};

const inputStream = new Readable({
	objectMode: true,
	read() {
		this.push(packageJsonFile);
		this.push(null); // 结束流
	}
});

// 创建输出流来收集结果
const outputFiles = [];
const outputStream = new Transform({
	objectMode: true,
	transform(chunk, encoding, callback) {
		console.log('Received file:', chunk.relative, 'Size:', chunk.contents ? chunk.contents.length : 0);
		outputFiles.push(chunk);
		callback();
	}
});

// 连接流
inputStream
	.pipe(electron(config))
	.pipe(outputStream)
	.on('finish', () => {
		console.log('Electron processing completed. Total files:', outputFiles.length);
		console.log('Files:', outputFiles.map(f => f.relative));
	})
	.on('error', (err) => {
		console.error('Error in electron processing:', err);
	});





