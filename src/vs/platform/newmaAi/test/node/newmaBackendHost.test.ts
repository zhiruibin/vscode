/*---------------------------------------------------------------------------------------------
 *  Newma AI - Tests for Shared Process backend host
 *--------------------------------------------------------------------------------------------*/

import { strictEqual, ok } from 'assert';
import { suite, test } from 'mocha';
import { NewmaBackendHost } from '../../../newmaAi/node/newmaBackendHost.js';
import { TestConfigurationService } from '../../../../platform/configuration/test/common/testConfigurationService.js';

// Minimal fetch response shim
class MockFetchResponse {
    constructor(private readonly _status: number, private readonly _text: string) {}
    get status() { return this._status; }
    async text(): Promise<string> { return this._text; }
}

suite('NewmaBackendHost (node)', () => {
    test('fallback fetch returns parsed SSE content', async () => {
        const sse = 'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n' + 'data: [DONE]\n';
        const originalFetch = (globalThis as any).fetch;
        try {
            (globalThis as any).fetch = async () => new MockFetchResponse(200, sse);
            const host = new NewmaBackendHost(undefined, undefined, new TestConfigurationService({ 'newma.backend.apiKey': 'k', 'newma.backend.model': 'm', 'newma.backend.apiUrl': 'u' } as any));
            const res = await host.call<any>('', 'newma.generate', { prompt: 'ping' });
            strictEqual(res.text, 'hi');
        } finally {
            (globalThis as any).fetch = originalFetch;
        }
    });

    test('fallback fetch returns non-empty plain text', async () => {
        const originalFetch = (globalThis as any).fetch;
        try {
            (globalThis as any).fetch = async () => new MockFetchResponse(200, 'You said: ping. (local fallback)');
            const host = new NewmaBackendHost(undefined, undefined, new TestConfigurationService());
            const res = await host.call<any>('', 'newma.generate', { prompt: 'ping' });
            ok((res.text as string).length > 0);
        } finally {
            (globalThis as any).fetch = originalFetch;
        }
    });

    test('fallback fetch empty body uses local fallback', async () => {
        const originalFetch = (globalThis as any).fetch;
        try {
            (globalThis as any).fetch = async () => new MockFetchResponse(200, '');
            const host = new NewmaBackendHost(undefined, undefined, new TestConfigurationService());
            const res = await host.call<any>('', 'newma.generate', { prompt: 'hello' });
            ok((res.text as string).includes('(local fallback)'));
        } finally {
            (globalThis as any).fetch = originalFetch;
        }
    });
});



