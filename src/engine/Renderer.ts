import { Application, Container } from "pixi.js";

export class Renderer {
  readonly app: Application;
  readonly background: Container;
  readonly world: Container;
  readonly hud: Container;

  constructor() {
    this.app = new Application();
    this.background = new Container();
    this.background.label = "background";
    this.world = new Container();
    this.world.label = "world";
    this.hud = new Container();
    this.hud.label = "hud";
  }

  async init(host: HTMLElement): Promise<void> {
    await this.app.init({
      background: "#0b0d12",
      resizeTo: host,
      antialias: false,
      preference: "webgl",
    });
    host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.background);
    this.app.stage.addChild(this.world);
    this.app.stage.addChild(this.hud);
  }

  dispose(): void {
    const canvas = this.app.canvas;
    this.app.destroy(true, { children: true });
    canvas.remove();
  }
}
