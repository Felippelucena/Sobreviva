import { FIXED_DT, MAX_CATCH_UP_TICKS, type TickInfo } from "./Time";

export type UpdateFn = (tick: TickInfo) => void;
export type RenderFn = (alpha: number) => void;

export interface LoopOptions {
  update: UpdateFn;
  render: RenderFn;
  dt?: number;
}

export class Loop {
  private readonly dt: number;
  private running = false;
  private rafId = 0;
  private lastTime = 0;
  private accumulator = 0;
  private elapsed = 0;
  private frame = 0;

  constructor(private readonly opts: LoopOptions) {
    this.dt = opts.dt ?? FIXED_DT;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private tick = (now: number): void => {
    if (!this.running) return;

    const frameMs = now - this.lastTime;
    this.lastTime = now;
    this.accumulator += Math.min(frameMs / 1000, 0.25);

    let steps = 0;
    while (this.accumulator >= this.dt && steps < MAX_CATCH_UP_TICKS) {
      this.elapsed += this.dt;
      this.frame += 1;
      this.opts.update({ dt: this.dt, elapsed: this.elapsed, frame: this.frame });
      this.accumulator -= this.dt;
      steps += 1;
    }

    if (steps === MAX_CATCH_UP_TICKS) {
      this.accumulator = 0;
    }

    const alpha = this.accumulator / this.dt;
    this.opts.render(alpha);

    this.rafId = requestAnimationFrame(this.tick);
  };
}
