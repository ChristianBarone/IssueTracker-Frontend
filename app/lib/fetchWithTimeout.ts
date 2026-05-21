// Default timeout: 30s. Can be overridden at build/runtime with NEXT_PUBLIC_API_TIMEOUT_MS.
const DEFAULT_TIMEOUT_MS = (() => {
    const env = typeof process === 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_TIMEOUT_MS ?? '');
    const parsed = Number.parseInt(env, 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    return 30000;
})();

export async function fetchWithTimeout(
    input: RequestInfo | URL,
    init: RequestInit = {},
    timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = globalThis.setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeoutMs);

    try {
        return await fetch(input, {
            ...init,
            signal: controller.signal,
        });
    } catch (err: any) {
        // Normalize abort/timeouts into readable Error objects
        if (timedOut) {
            throw new Error('Request timed out');
        }

        // Some environments throw DOMException with name 'AbortError'
        if (err && (err.name === 'AbortError' || err instanceof DOMException)) {
            throw new Error('Request was aborted');
        }

        throw err;
    } finally {
        globalThis.clearTimeout(timeoutId);
    }
}