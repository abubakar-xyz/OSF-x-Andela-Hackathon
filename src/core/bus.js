/** Tiny pub/sub. The app talks to itself through this so that the
 *  character, the voice layer and the surfaces stay decoupled. */
export function createBus() {
  const subs = new Map();
  return {
    on(evt, fn) {
      if (!subs.has(evt)) subs.set(evt, new Set());
      subs.get(evt).add(fn);
      return () => subs.get(evt)?.delete(fn);
    },
    emit(evt, payload) {
      subs.get(evt)?.forEach((fn) => {
        try { fn(payload); } catch (err) { console.error(`[bus] ${evt}`, err); }
      });
      subs.get('*')?.forEach((fn) => {
        try { fn(evt, payload); } catch (err) { console.error('[bus] *', err); }
      });
    },
    clear() { subs.clear(); },
  };
}
export const bus = createBus();
