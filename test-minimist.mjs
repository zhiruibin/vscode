import { configurePortable } from './out/bootstrap-node.js';
import { bootstrapESM } from './out/bootstrap-esm.js';
import { product } from './out/bootstrap-meta.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const minimist = require('minimist');
console.log('All modules including minimist imported successfully');


