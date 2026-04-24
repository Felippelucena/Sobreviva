interface VersionedEnvelope<T> {
  v: number;
  data: T;
}

export class SaveStore {
  constructor(private readonly storage: Storage = window.localStorage) {}

  get<T>(key: string, fallback: T): T {
    try {
      const raw = this.storage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as VersionedEnvelope<T>;
      if (!parsed || typeof parsed !== "object" || !("data" in parsed)) return fallback;
      return parsed.data ?? fallback;
    } catch {
      return fallback;
    }
  }

  set<T>(key: string, data: T): void {
    try {
      const envelope: VersionedEnvelope<T> = { v: 1, data };
      this.storage.setItem(key, JSON.stringify(envelope));
    } catch {
      // quota exceeded or storage disabled — silently ignore; UI already uses optimistic defaults.
    }
  }

  remove(key: string): void {
    try {
      this.storage.removeItem(key);
    } catch {
      // ignore
    }
  }
}
