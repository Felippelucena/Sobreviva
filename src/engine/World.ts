export type EntityId = number;

export type ComponentKey<T> = symbol & { __brand?: T };

export function defineComponent<T>(name: string): ComponentKey<T> {
  return Symbol(name) as ComponentKey<T>;
}

export class World {
  private nextId: EntityId = 1;
  private readonly stores = new Map<symbol, Map<EntityId, unknown>>();
  private readonly alive = new Set<EntityId>();
  private readonly pendingDestroy = new Set<EntityId>();

  createEntity(): EntityId {
    const id = this.nextId++;
    this.alive.add(id);
    return id;
  }

  destroyEntity(id: EntityId): void {
    if (!this.alive.has(id)) return;
    this.pendingDestroy.add(id);
  }

  flushDestroyed(): void {
    if (this.pendingDestroy.size === 0) return;
    for (const id of this.pendingDestroy) {
      for (const store of this.stores.values()) {
        store.delete(id);
      }
      this.alive.delete(id);
    }
    this.pendingDestroy.clear();
  }

  isAlive(id: EntityId): boolean {
    return this.alive.has(id) && !this.pendingDestroy.has(id);
  }

  add<T>(id: EntityId, key: ComponentKey<T>, value: T): void {
    this.store<T>(key).set(id, value);
  }

  remove<T>(id: EntityId, key: ComponentKey<T>): void {
    this.stores.get(key as symbol)?.delete(id);
  }

  get<T>(id: EntityId, key: ComponentKey<T>): T | undefined {
    return this.stores.get(key as symbol)?.get(id) as T | undefined;
  }

  has<T>(id: EntityId, key: ComponentKey<T>): boolean {
    return this.stores.get(key as symbol)?.has(id) ?? false;
  }

  require<T>(id: EntityId, key: ComponentKey<T>): T {
    const value = this.get(id, key);
    if (value === undefined) {
      throw new Error(`Entity ${id} missing component ${(key as symbol).description ?? "?"}`);
    }
    return value;
  }

  query<A>(a: ComponentKey<A>): Generator<[EntityId, A]>;
  query<A, B>(a: ComponentKey<A>, b: ComponentKey<B>): Generator<[EntityId, A, B]>;
  query<A, B, C>(
    a: ComponentKey<A>,
    b: ComponentKey<B>,
    c: ComponentKey<C>,
  ): Generator<[EntityId, A, B, C]>;
  *query(...keys: ComponentKey<unknown>[]): Generator<unknown[]> {
    if (keys.length === 0) return;
    const stores = keys.map((k) => this.stores.get(k as symbol));
    if (stores.some((s) => !s)) return;
    let smallest = stores[0]!;
    for (const s of stores) if (s!.size < smallest.size) smallest = s!;
    for (const id of smallest.keys()) {
      if (this.pendingDestroy.has(id)) continue;
      const row: unknown[] = [id];
      let ok = true;
      for (const s of stores) {
        const v = s!.get(id);
        if (v === undefined) {
          ok = false;
          break;
        }
        row.push(v);
      }
      if (ok) yield row;
    }
  }

  count<T>(key: ComponentKey<T>): number {
    return this.stores.get(key as symbol)?.size ?? 0;
  }

  private store<T>(key: ComponentKey<T>): Map<EntityId, T> {
    let store = this.stores.get(key as symbol);
    if (!store) {
      store = new Map();
      this.stores.set(key as symbol, store);
    }
    return store as Map<EntityId, T>;
  }
}
