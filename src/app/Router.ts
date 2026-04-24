export type Route = "play" | "editor";

export interface RouterOptions {
  onChange: (route: Route) => void;
}

export class Router {
  private current: Route = "play";

  constructor(private readonly opts: RouterOptions) {
    window.addEventListener("hashchange", this.handleHashChange);
    this.current = parseRoute(window.location.hash);
  }

  start(): void {
    this.opts.onChange(this.current);
  }

  navigate(route: Route): void {
    const target = `#/${route}`;
    if (window.location.hash === target) return;
    window.location.hash = target;
  }

  get route(): Route {
    return this.current;
  }

  dispose(): void {
    window.removeEventListener("hashchange", this.handleHashChange);
  }

  private handleHashChange = (): void => {
    const next = parseRoute(window.location.hash);
    if (next === this.current) return;
    this.current = next;
    this.opts.onChange(next);
  };
}

function parseRoute(hash: string): Route {
  const clean = hash.replace(/^#\/?/, "").split("/")[0] ?? "";
  return clean === "editor" ? "editor" : "play";
}
