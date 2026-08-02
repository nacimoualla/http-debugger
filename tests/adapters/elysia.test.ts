import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Elysia } from 'elysia';
import { httpDebugger} from '../../src/adapters/elysia';

describe('httpDebugger Elysia adapter', () => {
    let app: Elysia;
    let capturedOutput: string[];

    beforeEach(() => {
        capturedOutput = [];
        app = new Elysia()
        .use(httpDebugger({ colors: false }));

        vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
        capturedOutput.push(args.join(' '));
        });
    })
    afterEach(() => {
        vi.restoreAllMocks();
    });
    it('creates middleware function', () => {
        expect(typeof httpDebugger).toBe('function');
    })
    it('captures json response', async () => {
        app.get('/test', (c) => {
            return ({ ok: true })
        });
        const res = await app.handle(new Request('https://localhost:3000/test'));
        expect(res.status).toBe(200)

        await new Promise((r) => setTimeout(r, 150));
        expect (capturedOutput.some((o) => o.includes('GET /test'))).toBe(true);
        expect(capturedOutput.some((o) => o.includes('200'))).toBe(true);
    })
})