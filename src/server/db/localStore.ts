/**
 * Universal LocalStore & Storage Compatibility Mock
 * Guarantees zero crashes if legacy modules invoke localStorage/localStore methods
 */
const inMemoryStore = new Map<string, any>();

export const localStore = {
  getItem: (...args: any[]) => {
    if (args.length >= 2) return inMemoryStore.get(`${args[0]}:${args[1]}`) ?? null;
    return inMemoryStore.get(args[0]) ?? null;
  },
  setItem: (...args: any[]) => {
    if (args.length >= 3) inMemoryStore.set(`${args[0]}:${args[1]}`, args[2]);
    else if (args.length === 2) inMemoryStore.set(args[0], args[1]);
  },
  removeItem: (...args: any[]) => inMemoryStore.delete(args.join(':')),
  clear: () => inMemoryStore.clear(),
  get: (...args: any[]) => {
    if (args.length >= 2) return inMemoryStore.get(`${args[0]}:${args[1]}`) ?? null;
    return inMemoryStore.get(args[0]) ?? null;
  },
  set: (...args: any[]) => {
    if (args.length >= 3) inMemoryStore.set(`${args[0]}:${args[1]}`, args[2]);
    else if (args.length === 2) inMemoryStore.set(args[0], args[1]);
  },
  delete: (key: string) => inMemoryStore.delete(key),
  has: (key: string) => inMemoryStore.has(key),
  keys: () => Array.from(inMemoryStore.keys()),
  values: () => Array.from(inMemoryStore.values()),
  entries: () => Array.from(inMemoryStore.entries()),
  save: () => {},
  load: () => {},
};

export default localStore;
