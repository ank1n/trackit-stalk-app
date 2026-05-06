/*
Web storage shim — drop-in replacement for expo-secure-store + AsyncStorage.

Mirrors both APIs (`SecureStore.{getItem,setItem,deleteItem}Async` and
`AsyncStorage.{getItem,setItem,removeItem}`) so existing call sites keep working
after a single import swap.

Backed by window.localStorage. Not "secure" in the SecureStore sense (no
Keychain/Keystore), but for an iframe SPA running inside sTalk that's adequate
— the page is sandboxed by parent origin and HttpOnly cookies handle session.
*/

const ls = (): Storage | null => {
    try { return window.localStorage; } catch { return null; }
};

// expo-secure-store API
export const SecureStore = {
    getItemAsync(key: string): Promise<string | null> {
        return Promise.resolve(ls()?.getItem(key) ?? null);
    },
    setItemAsync(key: string, value: string): Promise<void> {
        try { ls()?.setItem(key, value); } catch {}
        return Promise.resolve();
    },
    deleteItemAsync(key: string): Promise<void> {
        try { ls()?.removeItem(key); } catch {}
        return Promise.resolve();
    },
};

// @react-native-async-storage/async-storage API (default export)
const AsyncStorage = {
    getItem(key: string): Promise<string | null> {
        return Promise.resolve(ls()?.getItem(key) ?? null);
    },
    setItem(key: string, value: string): Promise<void> {
        try { ls()?.setItem(key, value); } catch {}
        return Promise.resolve();
    },
    removeItem(key: string): Promise<void> {
        try { ls()?.removeItem(key); } catch {}
        return Promise.resolve();
    },
    multiGet(keys: string[]): Promise<Array<[string, string | null]>> {
        const s = ls();
        return Promise.resolve(keys.map((k) => [k, s?.getItem(k) ?? null]));
    },
    multiSet(pairs: Array<[string, string]>): Promise<void> {
        const s = ls();
        try { for (const [k, v] of pairs) s?.setItem(k, v); } catch {}
        return Promise.resolve();
    },
    multiRemove(keys: string[]): Promise<void> {
        const s = ls();
        try { for (const k of keys) s?.removeItem(k); } catch {}
        return Promise.resolve();
    },
    clear(): Promise<void> {
        try { ls()?.clear(); } catch {}
        return Promise.resolve();
    },
    getAllKeys(): Promise<string[]> {
        const s = ls();
        if (!s) return Promise.resolve([]);
        const keys: string[] = [];
        for (let i = 0; i < s.length; i++) {
            const k = s.key(i);
            if (k) keys.push(k);
        }
        return Promise.resolve(keys);
    },
};

export default AsyncStorage;
