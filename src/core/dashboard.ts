import type { DebugEntry } from '../types.js';

export function createDashboardEngine(maxEntries: number = 100) {
  const buffer: DebugEntry[] = [];
  const clients = new Set<(chunk: string) => void>();

  const isProduction =
    typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';

  return {
    isEnabled: !isProduction,

    addEntry(entry: DebugEntry) {
      if (buffer.length >= maxEntries) buffer.shift();
      buffer.push(entry);
      const payload = `data: ${JSON.stringify(entry)}\n\n`;
      clients.forEach((send) => send(payload));
    },

    addClientWithHistory(sendFn: (chunk: string) => void): () => void {
      const history = buffer.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
      sendFn(history);
      clients.add(sendFn);
      return () => clients.delete(sendFn);
    },
  };
}
