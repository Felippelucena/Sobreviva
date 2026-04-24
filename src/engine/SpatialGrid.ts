import type { EntityId } from "./World";

export class SpatialGrid {
  private readonly cells = new Map<number, EntityId[]>();
  private readonly membership = new Map<EntityId, number>();

  constructor(private readonly cellSize = 64) {}

  clear(): void {
    this.cells.clear();
    this.membership.clear();
  }

  insert(id: EntityId, x: number, y: number): void {
    const key = this.cellKey(x, y);
    let bucket = this.cells.get(key);
    if (!bucket) {
      bucket = [];
      this.cells.set(key, bucket);
    }
    bucket.push(id);
    this.membership.set(id, key);
  }

  queryCircle(x: number, y: number, radius: number, out: EntityId[] = []): EntityId[] {
    const cs = this.cellSize;
    const minCx = Math.floor((x - radius) / cs);
    const maxCx = Math.floor((x + radius) / cs);
    const minCy = Math.floor((y - radius) / cs);
    const maxCy = Math.floor((y + radius) / cs);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const bucket = this.cells.get(hashCell(cx, cy));
        if (!bucket) continue;
        for (const id of bucket) out.push(id);
      }
    }
    return out;
  }

  private cellKey(x: number, y: number): number {
    return hashCell(Math.floor(x / this.cellSize), Math.floor(y / this.cellSize));
  }
}

function hashCell(cx: number, cy: number): number {
  return ((cx + 0x8000) & 0xffff) | (((cy + 0x8000) & 0xffff) << 16);
}
