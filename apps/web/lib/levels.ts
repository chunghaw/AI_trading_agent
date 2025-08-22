import type { Bars } from "./indicators";

export function levelCandidates(bars: Bars){
  const n = bars.close.length;
  const last = bars.close[n-1];
  const hi20 = Math.max(...bars.high.slice(-20));
  const lo20 = Math.min(...bars.low.slice(-20));
  const pp = (hi20 + lo20 + last) / 3;
  const r1 = 2*pp - lo20;
  const s1 = 2*pp - hi20;
  return {
    last: Number(last.toFixed(2)),
    hi20: Number(hi20.toFixed(2)),
    lo20: Number(lo20.toFixed(2)),
    pp: Number(pp.toFixed(2)),
    r1: Number(r1.toFixed(2)),
    s1: Number(s1.toFixed(2)),
  };
}
