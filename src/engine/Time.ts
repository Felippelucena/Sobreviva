export interface TickInfo {
  dt: number;
  elapsed: number;
  frame: number;
}

export const FIXED_DT = 1 / 60;
export const MAX_CATCH_UP_TICKS = 5;
