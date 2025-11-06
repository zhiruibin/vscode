import * as path from 'node:path';
import * as fs from 'original-fs';
import * as os from 'node:os';
import { performance } from 'node:perf_hooks';
import { configurePortable } from './out/bootstrap-node.js';
import { bootstrapESM } from './out/bootstrap-esm.js';
import { app, protocol, crashReporter, Menu, contentTracing } from 'electron';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const minimist = require('minimist');
import { product } from './out/bootstrap-meta.js';

console.log('All imports successful');


