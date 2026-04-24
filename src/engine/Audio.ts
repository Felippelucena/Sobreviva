export type Sfx = "shoot" | "hit" | "levelup" | "death" | "pickup";

interface SfxConfig {
  freq: number;
  sweepTo?: number;
  type: OscillatorType;
  durationMs: number;
  gain: number;
}

const SFX: Record<Sfx, SfxConfig> = {
  shoot: { freq: 720, sweepTo: 260, type: "square", durationMs: 70, gain: 0.07 },
  hit: { freq: 180, sweepTo: 60, type: "square", durationMs: 90, gain: 0.12 },
  levelup: { freq: 440, sweepTo: 880, type: "triangle", durationMs: 320, gain: 0.1 },
  death: { freq: 220, sweepTo: 55, type: "sawtooth", durationMs: 420, gain: 0.16 },
  pickup: { freq: 780, sweepTo: 1100, type: "sine", durationMs: 90, gain: 0.06 },
};

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private lastShootAt = 0;
  enabled = true;

  ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);
    } catch {
      return null;
    }
    return this.ctx;
  }

  play(name: Sfx): void {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    if (name === "shoot") {
      const now = performance.now();
      if (now - this.lastShootAt < 70) return;
      this.lastShootAt = now;
    }
    const cfg = SFX[name];
    const t0 = ctx.currentTime;
    const t1 = t0 + cfg.durationMs / 1000;
    const osc = ctx.createOscillator();
    osc.type = cfg.type;
    osc.frequency.setValueAtTime(cfg.freq, t0);
    if (cfg.sweepTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, cfg.sweepTo), t1);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(cfg.gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t1);
  }

  dispose(): void {
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.master = null;
  }
}
