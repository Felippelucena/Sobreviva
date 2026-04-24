import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventBus } from "../events/EventBus";

describe("EventBus", () => {
  let bus: EventBus;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    bus = new EventBus();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("delivers payloads to registered handlers", () => {
    const fn = vi.fn();
    bus.on("levelUp", fn);
    bus.emit("levelUp", { level: 5 });
    expect(fn).toHaveBeenCalledWith({ level: 5 });
  });

  it("unsubscribe stops delivery", () => {
    const fn = vi.fn();
    const off = bus.on("tick", fn);
    off();
    bus.emit("tick", { dt: 0.016, elapsedMs: 100 });
    expect(fn).not.toHaveBeenCalled();
  });

  it("disables a handler after 3 errors without stopping others", () => {
    const ok = vi.fn();
    const boom = vi.fn(() => {
      throw new Error("nope");
    });
    bus.on("tick", boom, "bad-mod");
    bus.on("tick", ok, "good-mod");
    for (let i = 0; i < 5; i++) bus.emit("tick", { dt: 0.016, elapsedMs: i });
    expect(boom).toHaveBeenCalledTimes(3);
    expect(ok).toHaveBeenCalledTimes(5);
  });

  it("clearBySource removes handlers by source tag", () => {
    const a = vi.fn();
    const b = vi.fn();
    bus.on("tick", a, "modA");
    bus.on("tick", b, "modB");
    bus.clearBySource("modA");
    bus.emit("tick", { dt: 0.016, elapsedMs: 0 });
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });
});
