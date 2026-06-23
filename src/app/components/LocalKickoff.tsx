"use client";

import { useEffect, useState } from "react";

type LocalKickoffProps = {
  date: string;
  className?: string;
  includePrefix?: boolean;
};

function formatLocalKickoff(date: string) {
  return new Intl.DateTimeFormat(navigator.language || "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(date));
}

export default function LocalKickoff({ date, className, includePrefix = false }: LocalKickoffProps) {
  const [formatted, setFormatted] = useState("Local time…");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setFormatted(formatLocalKickoff(date));
    });

    return () => window.cancelAnimationFrame(frame);
  }, [date]);

  return (
    <time className={className} dateTime={new Date(date).toISOString()} title="Shown in your local time zone">
      {includePrefix ? "Local kickoff: " : ""}
      {formatted}
    </time>
  );
}
