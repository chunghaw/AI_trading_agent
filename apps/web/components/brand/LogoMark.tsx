import * as React from "react";

type Props = React.SVGProps<SVGSVGElement> & { accent?: string; tone?: string };

export default function LogoMark({
  width = 28, height = 28,
  accent = "var(--accent, #22C55E)",
  tone = "#C7CBD4",
  ...rest
}: Props) {
  return (
    <svg viewBox="0 0 256 256" role="img" aria-label="Trading AI logo" width={width} height={height} {...rest}>
      <defs>
        <linearGradient id="spark" x1="22" y1="176" x2="248" y2="66" gradientUnits="userSpaceOnUse">
          <stop stopColor={accent} /><stop offset="1" stopColor={accent} />
        </linearGradient>
      </defs>
      <path d="M128 32 L28 208 H228 Z" stroke={tone} strokeWidth={12} strokeLinejoin="round" fill="none" />
      <path d="M92 168 H164" stroke={tone} strokeWidth={10} strokeLinecap="round" opacity={0.3} />
      <path d="M22 176 C 62 148, 102 154, 122 160 C 146 168, 150 132, 172 112 C 188 98, 206 92, 236 84"
            stroke="url(#spark)" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M232 66 L248 80 L228 86 Z" fill={accent} />
    </svg>
  );
}