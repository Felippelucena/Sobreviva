import { Texture, TilingSprite } from "pixi.js";

export function createBackgroundSprite(tileSize = 64): TilingSprite {
  return new TilingSprite({
    texture: makeGridTexture(tileSize),
    width: 100,
    height: 100,
  });
}

function makeGridTexture(size: number): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#0e1118";
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0.5, 0);
  ctx.lineTo(0.5, size);
  ctx.moveTo(0, 0.5);
  ctx.lineTo(size, 0.5);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 1.4, 0, Math.PI * 2);
  ctx.fill();

  return Texture.from(canvas);
}
