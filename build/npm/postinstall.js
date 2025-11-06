/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');
const { dirs } = require('./dirs');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const root = path.dirname(path.dirname(__dirname));

function log(dir, message) {
	if (process.stdout.isTTY) {
		console.log(`\x1b[34m[${dir}]\x1b[0m`, message);
	} else {
		console.log(`[${dir}]`, message);
	}
}

function run(command, args, opts) {
	log(opts.cwd || '.', '$ ' + command + ' ' + args.join(' '));

	// Prefer invoking npm via node to avoid relying on /bin/sh or shell resolution
	// This prevents ENOENT: spawnSync /bin/sh when shell is unavailable/restricted
	let result;
	const npmCli = process.env['npm_execpath']; // path to npm CLI js if available
	if (npmCli) {
		// Run: node <npm_cli_js> <args...>
		const nodeExe = process.execPath;
		const finalArgs = [npmCli, ...args];
		const finalOpts = { ...opts, shell: false }; // no shell needed on *nix
		result = cp.spawnSync(nodeExe, finalArgs, finalOpts);
	} else {
		const finalOpts = { ...opts, shell: process.platform === 'win32' ? true : false };
		result = cp.spawnSync(command, args, finalOpts);
	}

	if (result.error) {
		console.error(`ERR Failed to spawn process: ${result.error}`);
		if (opts.__allowFailure) {
			return { status: result.status ?? 1 };
		}
		process.exit(1);
	} else if (result.status !== 0) {
		console.error(`ERR Process exited with code: ${result.status}`);
		if (opts.__allowFailure) {
			return { status: result.status };
		}
		process.exit(result.status);
	}
	return { status: 0 };
}

/**
 * @param {string} dir
 * @param {*} [opts]
 */
function npmInstall(dir, opts) {
	opts = {
		env: { ...process.env },
		...(opts ?? {}),
		cwd: dir,
		stdio: 'inherit',
		// Avoid forcing a shell on non-Windows platforms to prevent /bin/sh ENOENT
		shell: process.platform === 'win32'
	};

	const command = process.env['npm_command'] || 'install';

	if (process.env['VSCODE_REMOTE_DEPENDENCIES_CONTAINER_NAME'] && /^(.build\/distro\/npm\/)?remote$/.test(dir)) {
		const userinfo = os.userInfo();
		log(dir, `Installing dependencies inside container ${process.env['VSCODE_REMOTE_DEPENDENCIES_CONTAINER_NAME']}...`);

		opts.cwd = root;
		if (process.env['npm_config_arch'] === 'arm64') {
			run('sudo', ['docker', 'run', '--rm', '--privileged', 'multiarch/qemu-user-static', '--reset', '-p', 'yes'], opts);
		}
		run('sudo', [
			'docker', 'run',
			'-e', 'GITHUB_TOKEN',
			'-v', `${process.env['VSCODE_HOST_MOUNT']}:/root/vscode`,
			'-v', `${process.env['VSCODE_HOST_MOUNT']}/.build/.netrc:/root/.netrc`,
			'-v', `${process.env['VSCODE_NPMRC_PATH']}:/root/.npmrc`,
			'-w', path.resolve('/root/vscode', dir),
			process.env['VSCODE_REMOTE_DEPENDENCIES_CONTAINER_NAME'],
			'sh', '-c', `\"chown -R root:root ${path.resolve('/root/vscode', dir)} && export PATH="/root/vscode/.build/nodejs-musl/usr/local/bin:$PATH" && npm i -g node-gyp-build && npm ci\"`
		], opts);
		run('sudo', ['chown', '-R', `${userinfo.uid}:${userinfo.gid}`, `${path.resolve(root, dir)}`], opts);
	} else {
		log(dir, 'Installing dependencies...');
		const res = run(npm, command.split(' '), opts);
		if (opts.__allowFailure && res.status !== 0) {
			log(dir, `Skipping optional install (status ${res.status})`);
		}
	}
	removeParcelWatcherPrebuild(dir);
}

function setNpmrcConfig(dir, env) {
	const npmrcPath = path.join(root, dir, '.npmrc');
	const lines = fs.readFileSync(npmrcPath, 'utf8').split('\n');

	for (const line of lines) {
		const trimmedLine = line.trim();
		if (trimmedLine && !trimmedLine.startsWith('#')) {
			const [key, value] = trimmedLine.split('=');
			env[`npm_config_${key}`] = value.replace(/^"(.*)"$/, '$1');
		}
	}

	// Use our bundled node-gyp version
	env['npm_config_node_gyp'] =
		process.platform === 'win32'
			? path.join(__dirname, 'gyp', 'node_modules', '.bin', 'node-gyp.cmd')
			: path.join(__dirname, 'gyp', 'node_modules', '.bin', 'node-gyp');

	// Force node-gyp to use process.config on macOS
	// which defines clang variable as expected. Otherwise we
	// run into compilation errors due to incorrect compiler
	// configuration.
	// NOTE: This means the process.config should contain
	// the correct clang variable. So keep the version check
	// in preinstall sync with this logic.
	// Change was first introduced in https://github.com/nodejs/node/commit/6e0a2bb54c5bbeff0e9e33e1a0c683ed980a8a0f
	if ((dir === 'remote' || dir === 'build') && process.platform === 'darwin') {
		env['npm_config_force_process_config'] = 'true';
	} else {
		delete env['npm_config_force_process_config'];
	}

	if (dir === 'build') {
		env['npm_config_target'] = process.versions.node;
		env['npm_config_arch'] = process.arch;
	}
}

function removeParcelWatcherPrebuild(dir) {
	const parcelModuleFolder = path.join(root, dir, 'node_modules', '@parcel');
	if (!fs.existsSync(parcelModuleFolder)) {
		return;
	}

	const parcelModules = fs.readdirSync(parcelModuleFolder);
	for (const moduleName of parcelModules) {
		if (moduleName.startsWith('watcher-')) {
			const modulePath = path.join(parcelModuleFolder, moduleName);
			fs.rmSync(modulePath, { recursive: true, force: true });
			log(dir, `Removed @parcel/watcher prebuilt module ${modulePath}`);
		}
	}
}

for (let dir of dirs) {

	if (dir === '') {
		removeParcelWatcherPrebuild(dir);
		continue; // already executed in root
	}

	let opts;

	if (dir === 'build') {
		opts = {
			env: {
				...process.env
			},
		}
		if (process.env['CC']) { opts.env['CC'] = 'gcc'; }
		if (process.env['CXX']) { opts.env['CXX'] = 'g++'; }
		if (process.env['CXXFLAGS']) { opts.env['CXXFLAGS'] = ''; }
		if (process.env['LDFLAGS']) { opts.env['LDFLAGS'] = ''; }

		setNpmrcConfig('build', opts.env);
		npmInstall('build', opts);
		continue;
	}

	if (/^(.build\/distro\/npm\/)?remote$/.test(dir)) {
		// node modules used by vscode server
		opts = {
			env: {
				...process.env
			},
		}
		if (process.env['VSCODE_REMOTE_CC']) {
			opts.env['CC'] = process.env['VSCODE_REMOTE_CC'];
		} else {
			delete opts.env['CC'];
		}
		if (process.env['VSCODE_REMOTE_CXX']) {
			opts.env['CXX'] = process.env['VSCODE_REMOTE_CXX'];
		} else {
			delete opts.env['CXX'];
		}
		if (process.env['CXXFLAGS']) { delete opts.env['CXXFLAGS']; }
		if (process.env['CFLAGS']) { delete opts.env['CFLAGS']; }
		if (process.env['LDFLAGS']) { delete opts.env['LDFLAGS']; }
		if (process.env['VSCODE_REMOTE_CXXFLAGS']) { opts.env['CXXFLAGS'] = process.env['VSCODE_REMOTE_CXXFLAGS']; }
		if (process.env['VSCODE_REMOTE_LDFLAGS']) { opts.env['LDFLAGS'] = process.env['VSCODE_REMOTE_LDFLAGS']; }
		if (process.env['VSCODE_REMOTE_NODE_GYP']) { opts.env['npm_config_node_gyp'] = process.env['VSCODE_REMOTE_NODE_GYP']; }

		setNpmrcConfig('remote', opts.env);
		npmInstall(dir, opts);
		continue;
	}

	// For selfhost helper extensions, allow failure and do not abort overall install
	if (dir.startsWith('.vscode/extensions/vscode-selfhost-')) {
		npmInstall(dir, { __allowFailure: true });
		continue;
	}

	npmInstall(dir, opts);
}

cp.execSync('git config pull.rebase merges');
cp.execSync('git config blame.ignoreRevsFile .git-blame-ignore-revs');
