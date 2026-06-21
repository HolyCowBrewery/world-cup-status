import { connection } from "next/server";
import Countdown from "./components/Countdown";
import {
  formatKickoff,
  getMatches,
  getStandings,
  matchHeadline,
  Match,
  teamInMatch,
} from "./lib/espn";

const focusTeams = ["United States", "USA", "England", "ENG"];

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function scoreline(match: Match) {
  const [home, away] = match.teams;
  if (!home || !away) return "TBC";
  return `${home.team.abbreviation} ${home.score} — ${away.score} ${away.team.abbreviation}`;
}

function recordFor(stats: Record<string, string>) {
  return `${stats.wins ?? "0"}W ${stats.ties ?? "0"}D ${stats.losses ?? "0"}L`;
}

function nextMatch(matches: Match[], teamName: string) {
  return matches.find((match) => match.state === "pre" && teamInMatch(match, [teamName]));
}

function lastMatch(matches: Match[], teamName: string) {
  return [...matches].reverse().find((match) => match.completed && teamInMatch(match, [teamName]));
}

function teamStanding(groups: Awaited<ReturnType<typeof getStandings>>, teamName: string) {
  for (const group of groups) {
    const standing = group.teams.find((entry) => entry.team.displayName === teamName || entry.team.abbreviation === teamName);
    if (standing) return { group: group.name, standing };
  }
  return null;
}

function TeamBadge({ name }: { name: string }) {
  const flag = name === "United States" ? "🇺🇸" : name === "England" ? "🏴" : "🌎";
  return <span className="mr-2">{flag}</span>;
}

function FocusCard({ teamName, matches, groups }: { teamName: string; matches: Match[]; groups: Awaited<ReturnType<typeof getStandings>> }) {
  const standing = teamStanding(groups, teamName);
  const upcoming = nextMatch(matches, teamName);
  const recent = lastMatch(matches, teamName);

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.055] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/45">Spotlight</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white"><TeamBadge name={teamName} />{teamName}</h2>
        </div>
        {standing ? (
          <div className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-white/70">
            {standing.group} · #{standing.standing.rank}
          </div>
        ) : null}
      </div>

      {standing ? (
        <div className="mt-6 grid grid-cols-4 gap-3">
          {[
            ["Pts", standing.standing.stats.points ?? "0"],
            ["GD", standing.standing.stats.pointDifferential ?? "0"],
            ["Played", standing.standing.stats.gamesPlayed ?? "0"],
            ["Form", recordFor(standing.standing.stats)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-white/[0.06] p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/40">{label}</div>
              <div className="mt-2 text-xl font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-white/40">Last completed</p>
          <p className="mt-3 text-lg font-medium text-white">{recent ? scoreline(recent) : "No result yet"}</p>
          <p className="mt-2 text-sm leading-6 text-white/55">{recent ? matchHeadline(recent) : "The story is still waiting for its opening line."}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-white/40">Next up</p>
          {upcoming ? (
            <>
              <p className="mt-3 text-lg font-medium text-white">{upcoming.shortName}</p>
              <p className="mt-1 text-sm text-white/50">{formatKickoff(upcoming.date)}</p>
              <div className="mt-4"><Countdown date={upcoming.date} /></div>
            </>
          ) : (
            <p className="mt-3 text-sm leading-6 text-white/55">No upcoming fixture currently listed by ESPN.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function MatchCard({ match, highlight = false }: { match: Match; highlight?: boolean }) {
  const [home, away] = match.teams;
  return (
    <article className={cx("rounded-3xl border p-5 transition hover:-translate-y-1 hover:bg-white/[0.08]", highlight ? "border-sky-300/40 bg-sky-300/[0.10]" : "border-white/10 bg-white/[0.045]") }>
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/65">{match.group.replace("FIFA World Cup, ", "")}</span>
        <span className={cx("text-xs font-semibold uppercase tracking-[0.2em]", match.state === "in" ? "text-emerald-300" : "text-white/40")}>{match.status}</span>
      </div>
      <div className="mt-5 space-y-3">
        {[home, away].filter(Boolean).map((side) => (
          <div key={side.team.id} className="flex items-center justify-between gap-4 text-white">
            <span className="text-lg font-medium">{side.team.displayName}</span>
            <span className="text-2xl font-semibold tabular-nums">{match.completed || match.state === "in" ? side.score : "–"}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm leading-6 text-white/55">{match.completed ? matchHeadline(match) : `${formatKickoff(match.date)} · ${match.venue}${match.city ? `, ${match.city}` : ""}`}</p>
      {!match.completed && <div className="mt-4 text-sm font-medium text-white/70"><Countdown date={match.date} compact /></div>}
      {match.goals.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {match.goals.slice(0, 5).map((goal, idx) => (
            <span key={`${goal.player}-${idx}`} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">⚽ {goal.player} {goal.minute}</span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export default async function Home() {
  await connection();
  const [matchesResult, groupsResult] = await Promise.allSettled([getMatches(), getStandings()]);
  const matches = matchesResult.status === "fulfilled" ? matchesResult.value : [];
  const groups = groupsResult.status === "fulfilled" ? groupsResult.value : [];
  const dataIssue = matchesResult.status === "rejected" || groupsResult.status === "rejected";
  const completed = matches.filter((match) => match.completed);
  const upcoming = matches.filter((match) => match.state !== "post");
  const live = matches.filter((match) => match.state === "in");
  const focusMatches = matches.filter((match) => teamInMatch(match, focusTeams));
  const recent = [...completed].reverse().slice(0, 8);
  const next = upcoming.slice(0, 8);
  const now = new Date();

  return (
    <main className="min-h-screen overflow-hidden bg-[#030305] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(0,113,227,0.28),transparent_32%),radial-gradient(circle_at_82%_12%,rgba(191,90,242,0.22),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_40%)]" />
      <div className="relative mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between rounded-full border border-white/10 bg-white/[0.045] px-5 py-3 backdrop-blur-xl">
          <div className="text-sm font-semibold tracking-tight">World Cup Control Room</div>
          <div className="text-xs text-white/50">Data: ESPN · refreshed server-side</div>
        </header>

        {dataIssue ? (
          <div className="mb-8 rounded-3xl border border-amber-300/30 bg-amber-300/10 p-5 text-sm text-amber-100">
            ESPN returned partial data on this refresh, so some sections may be temporarily sparse. Try refreshing in a moment.
          </div>
        ) : null}

        <section className="py-20 text-center sm:py-28">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white/70 backdrop-blur-xl">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,.9)]" />
            {live.length ? `${live.length} live now` : `${completed.length} of ${matches.length} matches complete`}
          </div>
          <h1 className="mx-auto mt-8 max-w-5xl text-balance text-6xl font-semibold tracking-[-0.06em] text-white sm:text-8xl lg:text-9xl">
            The World Cup, beautifully under control.
          </h1>
          <p className="mx-auto mt-8 max-w-3xl text-xl leading-8 text-white/60 sm:text-2xl">
            A slick live tournament dashboard with match commentary, group-table gravity, and a special lens on the USA and England.
          </p>
          <div className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-4">
            {[
              ["Matches", matches.length],
              ["Complete", completed.length],
              ["Upcoming", upcoming.length],
              ["Groups", groups.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-3xl border border-white/10 bg-white/[0.055] p-5 backdrop-blur-xl">
                <div className="text-3xl font-semibold">{value}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.22em] text-white/40">{label}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <FocusCard teamName="United States" matches={matches} groups={groups} />
          <FocusCard teamName="England" matches={matches} groups={groups} />
        </div>

        {live.length ? (
          <section className="mt-12">
            <h2 className="mb-5 text-3xl font-semibold tracking-tight">Live now</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{live.map((match) => <MatchCard key={match.id} match={match} highlight />)}</div>
          </section>
        ) : null}

        <section className="mt-16 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Latest storylines</h2>
            <p className="mt-2 text-white/50">Completed matches, translated into just enough pub-chat commentary.</p>
            <div className="mt-6 grid gap-4">{recent.map((match) => <MatchCard key={match.id} match={match} highlight={teamInMatch(match, focusTeams)} />)}</div>
          </div>
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Coming up</h2>
            <p className="mt-2 text-white/50">Countdowns tick locally in your browser; fixtures refresh from ESPN on the server.</p>
            <div className="mt-6 grid gap-4">{next.map((match) => <MatchCard key={match.id} match={match} highlight={teamInMatch(match, focusTeams)} />)}</div>
          </div>
        </section>

        <section className="mt-20">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-4xl font-semibold tracking-tight">Group-stage map</h2>
              <p className="mt-2 text-white/50">Top-two qualification positions are gently lit. USA and England get the spotlight treatment.</p>
            </div>
            <div className="text-sm text-white/40">Last rendered: {formatKickoff(now.toISOString())}</div>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {groups.map((group) => (
              <section key={group.name} className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
                <h3 className="text-xl font-semibold">{group.name}</h3>
                <div className="mt-4 grid grid-cols-[1fr_2.2rem_2.2rem_2.2rem_2.8rem] gap-2 px-3 text-[10px] uppercase tracking-[0.18em] text-white/30">
                  <span>Team</span><span className="text-center">P</span><span className="text-center">GD</span><span className="text-center">W-D-L</span><span className="text-right">Pts</span>
                </div>
                <div className="mt-3 space-y-2">
                  {group.teams.map((entry) => {
                    const focus = ["United States", "England"].includes(entry.team.displayName);
                    return (
                      <div key={entry.team.id} className={cx("grid grid-cols-[1fr_2.2rem_2.2rem_2.2rem_2.8rem] items-center gap-2 rounded-2xl px-3 py-3 text-sm", entry.rank <= 2 ? "bg-emerald-300/[0.10]" : "bg-white/[0.035]", focus && "ring-1 ring-sky-300/60")}>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-white">{entry.rank}. {entry.team.displayName}</div>
                          <div className="text-xs text-white/35">{entry.note ?? "Chasing the line"}</div>
                        </div>
                        <div className="text-center text-white/55">{entry.stats.gamesPlayed ?? 0}</div>
                        <div className="text-center text-white/55">{entry.stats.pointDifferential ?? 0}</div>
                        <div className="text-center text-white/55">{entry.stats.wins ?? 0}-{entry.stats.ties ?? 0}-{entry.stats.losses ?? 0}</div>
                        <div className="text-right text-lg font-semibold tabular-nums text-white">{entry.stats.points ?? 0}</div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </section>

        <section className="mt-20 rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 text-center backdrop-blur-xl">
          <p className="text-sm uppercase tracking-[0.3em] text-white/40">Focus feed</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">USA + England fixture trail</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {focusMatches.map((match) => <MatchCard key={match.id} match={match} highlight />)}
          </div>
        </section>
      </div>
    </main>
  );
}
