"use client";

import { useEffect, useMemo, useState } from "react";

function parts(ms: number) {
  const safe = Math.max(0, ms);
  const days = Math.floor(safe / 86_400_000);
  const hours = Math.floor((safe % 86_400_000) / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1000);
  return { days, hours, minutes, seconds };
}

export default function Countdown({ date, compact = false }: { date: string; compact?: boolean }) {
  const target = useMemo(() => new Date(date).getTime(), [date]);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setRemaining(target - Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  if (remaining === null) {
    return <span className="text-white/45">Calculating…</span>;
  }

  const time = parts(remaining);

  if (remaining <= 0) {
    return <span className="text-emerald-300">Kickoff imminent</span>;
  }

  if (compact) {
    return (
      <span>
        {time.days > 0 ? `${time.days}d ` : ""}
        {String(time.hours).padStart(2, "0")}h {String(time.minutes).padStart(2, "0")}m
      </span>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-2 text-center">
      {[
        ["days", time.days],
        ["hrs", time.hours],
        ["min", time.minutes],
        ["sec", time.seconds],
      ].map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3 shadow-inner shadow-white/5">
          <div className="text-2xl font-semibold tabular-nums text-white">{String(value).padStart(2, "0")}</div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">{label}</div>
        </div>
      ))}
    </div>
  );
}
