import type { Container } from "pixi.js";

export interface CameraTarget {
  x: number;
  y: number;
}

export class Camera {
  x = 0;
  y = 0;
  zoom = 1;

  constructor(private readonly layer: Container) {}

  follow(target: CameraTarget, screenW: number, screenH: number, smoothing = 1): void {
    const tx = target.x;
    const ty = target.y;
    if (smoothing >= 1) {
      this.x = tx;
      this.y = ty;
    } else {
      this.x += (tx - this.x) * smoothing;
      this.y += (ty - this.y) * smoothing;
    }
    this.applyTo(screenW, screenH);
  }

  applyTo(screenW: number, screenH: number): void {
    this.layer.position.set(screenW / 2 - this.x * this.zoom, screenH / 2 - this.y * this.zoom);
    this.layer.scale.set(this.zoom);
  }
}
