export type StorageAdapter = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  key: (index: number) => string | null;
  length: number;
};

export function getLocalStorageAdapter(): StorageAdapter | null {
  if (typeof window === "undefined" || !("localStorage" in window)) {
    return null;
  }

  try {
    const testKey = "__who-is-main-today-storage-test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readJson<T>(key: string, fallback: T): T {
  const storage = getLocalStorageAdapter();
  if (!storage) return fallback;

  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T) {
  const storage = getLocalStorageAdapter();
  if (!storage) return false;

  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
