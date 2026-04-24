export class Rng {
  private state: number;

  constructor(seed = Date.now()) {
    this.state = (seed >>> 0) || 1;
  }

  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 0xffffffff;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  intRange(min: number, max: number): number {
    return Math.floor(this.range(min, max));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("Rng.pick: empty array");
    return items[this.intRange(0, items.length)]!;
  }
}
