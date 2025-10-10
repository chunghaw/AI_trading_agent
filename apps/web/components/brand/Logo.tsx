import * as React from "react";
import LogoMark from "./LogoMark";

export default function Logo({ size = 22 }: { size?: number }) {
  return (
    <div className="flex items-center gap-1 select-none">
      <LogoMark width={size} height={size} />
      <span className="text-[20px] font-semibold tracking-tight text-zinc-100">Trading</span>
      <span className="text-[20px] font-semibold tracking-tight" style={{ color: "var(--accent, #22C55E)" }}>
        AI
      </span>
    </div>
  );
}