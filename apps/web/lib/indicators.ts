export type Bars = { date:string[]; open:number[]; high:number[]; low:number[]; close:number[]; volume:number[] };

const sma = (arr:number[], n:number, i:number) => {
  if (i+1 < n) return NaN;
  let s=0; for (let k=i-n+1;k<=i;k++) s+=arr[k]; return s/n;
};

const emaSeries = (arr:number[], n:number) => {
  const k=2/(n+1); const out=new Array(arr.length).fill(NaN);
  let prev = sma(arr,n,n-1); out[n-1]=prev;
  for (let i=n;i<arr.length;i++){ prev = arr[i]*k + prev*(1-k); out[i]=prev; }
  return out;
};

export const emaLast = (arr:number[], n:number) => {
  const s = emaSeries(arr,n); return s[s.length-1];
};

export const rsi14 = (close:number[], n=14) => {
  if (close.length < n+1) return NaN;
  let gains=0, losses=0;
  for (let i=1;i<=n;i++){ const d=close[i]-close[i-1]; if (d>0) gains+=d; else losses-=d; }
  let avgG=gains/n, avgL=losses/n;
  for (let i=n+1;i<close.length;i++){
    const d=close[i]-close[i-1]; const g=Math.max(d,0), l=Math.max(-d,0);
    avgG=(avgG*(n-1)+g)/n; avgL=(avgL*(n-1)+l)/n;
  }
  if (avgL===0) return 100;
  const rs=avgG/avgL; return 100-100/(1+rs);
};

export const macdLast = (close:number[], fast=12, slow=26, signal=9) => {
  if (close.length < slow+signal+5) return { m:NaN, s:NaN, h:NaN };
  const ef=emaSeries(close,fast), es=emaSeries(close,slow);
  const line = close.map((_,i)=> ef[i]-es[i]);
  const sig = emaSeries(line.map(v=>Number.isFinite(v)?v:0), signal);
  const m=line[line.length-1], s=sig[sig.length-1];
  return { m, s, h: m-s };
};

export const atr14 = (high:number[], low:number[], close:number[], n=14) => {
  if (high.length < n+1) return NaN;
  const tr:number[]=[];
  for(let i=1;i<high.length;i++){
    const h=high[i], l=low[i], pc=close[i-1];
    tr.push(Math.max(h-l, Math.abs(h-pc), Math.abs(l-pc)));
  }
  let atr = tr.slice(0,n).reduce((a,b)=>a+b,0)/n;
  for(let i=n;i<tr.length;i++) atr = (atr*(n-1)+tr[i])/n;
  return atr;
};

export function computeIndicators(bars: Bars){
  const { close, high, low } = bars;
  const rsi = rsi14(close);
  const macd = macdLast(close);
  return {
    rsi14: Number(rsi.toFixed(2)),
    macd: Number(macd.m.toFixed(2)),
    macd_signal: Number(macd.s.toFixed(2)),
    macd_hist: Number(macd.h.toFixed(2)),
    ema20: Number(emaLast(close,20).toFixed(3)),
    ema50: Number(emaLast(close,50).toFixed(3)),
    ema200: Number(emaLast(close,200).toFixed(3)),
    atr14: Number(atr14(high,low,close).toFixed(2)),
  };
}
