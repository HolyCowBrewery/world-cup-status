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

type Groups = Awaited<ReturnType<typeof getStandings>>;

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function scoreline(match: Match) {
  const [home, away] = match.teams;
  if (!home || !away) return "TBC";
  return `${home.team.abbreviation} ${home.score}–${away.score} ${away.team.abbreviation}`;
}

function shortGroup(match: Match) {
  return match.group.replace("FIFA World Cup, ", "").replace("FIFA World Cup", "Knockout");
}

const flagCodeByAbbreviation: Record<string, string> = {
  ALG: "dz",
  ARG: "ar",
  AUS: "au",
  AUT: "at",
  BEL: "be",
  BIH: "ba",
  BRA: "br",
  CAN: "ca",
  CIV: "ci",
  COD: "cd",
  COL: "co",
  CPV: "cv",
  CRO: "hr",
  CUW: "cw",
  CZE: "cz",
  ECU: "ec",
  EGY: "eg",
  ENG: "gb-eng",
  ESP: "es",
  FRA: "fr",
  GER: "de",
  GHA: "gh",
  HAI: "ht",
  IRN: "ir",
  IRQ: "iq",
  JOR: "jo",
  JPN: "jp",
  KOR: "kr",
  KSA: "sa",
  MAR: "ma",
  MEX: "mx",
  NED: "nl",
  NOR: "no",
  NZL: "nz",
  PAN: "pa",
  PAR: "py",
  POR: "pt",
  QAT: "qa",
  RSA: "za",
  SCO: "gb-sct",
  SEN: "sn",
  SUI: "ch",
  SWE: "se",
  TUN: "tn",
  TUR: "tr",
  USA: "us",
  URU: "uy",
  UZB: "uz",
};

function flagUrl(abbreviation?: string) {
  const code = abbreviation ? flagCodeByAbbreviation[abbreviation] : undefined;
  return code ? `https://flagcdn.com/w40/${code}.png` : undefined;
}

function Flag({ abbreviation, label }: { abbreviation?: string; label?: string }) {
  const url = flagUrl(abbreviation);
  if (!url) {
    return <span className="mr-1.5 inline-block h-3 w-5 rounded-sm bg-white/15 align-[-1px]" aria-hidden="true" />;
  }

  return (
    <span
      className="mr-1.5 inline-block h-3.5 w-5 rounded-[2px] bg-cover bg-center align-[-2px] shadow-[0_0_0_1px_rgba(255,255,255,0.18)]"
      role="img"
      aria-label={`${label ?? abbreviation} flag`}
      style={{ backgroundImage: `url(${url})` }}
    />
  );
}

function teamStanding(groups: Groups, teamName: string) {
  for (const group of groups) {
    const standing = group.teams.find((entry) => entry.team.displayName === teamName || entry.team.abbreviation === teamName);
    if (standing) return { group: group.name, standing };
  }
  return null;
}

function nextMatch(matches: Match[], teamName: string) {
  return matches.find((match) => match.state === "pre" && teamInMatch(match, [teamName]));
}

function lastMatch(matches: Match[], teamName: string) {
  return [...matches].reverse().find((match) => match.completed && teamInMatch(match, [teamName]));
}

function matchStatus(match: Match) {
  if (match.state === "in") return "LIVE";
  if (match.completed) return "FT";
  return formatKickoff(match.date);
}

function teamForGoal(match: Match, teamId?: string) {
  return match.teams.find((side) => side.team.id === teamId)?.team;
}

function matchCommentary(match: Match) {
  const [home, away] = match.teams;
  if (!home || !away) return "Match details are unavailable.";

  if (!match.completed) {
    return `${matchStatus(match)}. ${match.group}. Venue: ${match.venue}${match.city ? `, ${match.city}` : ""}.`;
  }

  const result = matchHeadline(match);
  const goals = match.goals.length
    ? `Goals: ${match.goals.map((goal) => `${goal.player} ${goal.minute}`).join("; ")}.`
    : "No scorer feed was returned for this match.";
  const outcome = home.score === away.score
    ? "The result keeps both sides moving but leaves the table pressure intact."
    : `${home.score > away.score ? home.team.displayName : away.team.displayName} banked the full three points and improved their qualification position.`;

  return `${result} ${outcome} ${goals} Context: ${match.group}; ${match.venue}${match.city ? `, ${match.city}` : ""}.`;
}

function MiniTeamStatus({ teamName, matches, groups }: { teamName: string; matches: Match[]; groups: Groups }) {
  const standing = teamStanding(groups, teamName);
  const upcoming = nextMatch(matches, teamName);
  const recent = lastMatch(matches, teamName);
  const abbreviation = teamName === "United States" ? "USA" : "ENG";

  return (
    <details className="group rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-xl">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-white"><Flag abbreviation={abbreviation} label={teamName} />{teamName}</div>
          <div className="mt-1 text-xs text-white/45">
            {standing ? `${standing.group} · ${standing.standing.stats.points ?? 0} pts · GD ${standing.standing.stats.pointDifferential ?? 0}` : "No standing"}
          </div>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/50 group-open:bg-white/10">Expand</span>
      </summary>
      <div className="mt-4 grid gap-3 text-sm text-white/65">
        <div className="rounded-xl bg-black/25 p-3">
          <span className="text-white/35">Last:</span> {recent ? scoreline(recent) : "No result yet"}
        </div>
        <div className="rounded-xl bg-black/25 p-3">
          <span className="text-white/35">Next:</span> {upcoming ? `${upcoming.shortName} · ${formatKickoff(upcoming.date)}` : "No fixture listed"}
          {upcoming ? <div className="mt-2 font-medium text-white/80"><Countdown date={upcoming.date} compact /></div> : null}
        </div>
      </div>
    </details>
  );
}

function CompactMatch({ match, highlight = false, commentary = false }: { match: Match; highlight?: boolean; commentary?: boolean }) {
  const [home, away] = match.teams;
  const isUpcoming = match.state === "pre";

  return (
    <details className={cx("group rounded-2xl border p-3 backdrop-blur-xl", highlight ? "border-sky-300/45 bg-sky-300/[0.10]" : "border-white/10 bg-white/[0.045]") }>
      <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto] items-center gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/35">
            <span className={cx(match.state === "in" && "text-emerald-300")}>{matchStatus(match)}</span>
            <span>·</span>
            <span className="truncate">{shortGroup(match)}</span>
          </div>
          <div className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm text-white">
            <span className="truncate font-medium"><Flag abbreviation={home?.team.abbreviation} label={home?.team.displayName} />{home?.team.displayName ?? "TBC"}</span>
            <span className="font-semibold tabular-nums">{match.completed || match.state === "in" ? home?.score : "–"}</span>
            <span className="truncate font-medium"><Flag abbreviation={away?.team.abbreviation} label={away?.team.displayName} />{away?.team.displayName ?? "TBC"}</span>
            <span className="font-semibold tabular-nums">{match.completed || match.state === "in" ? away?.score : "–"}</span>
          </div>
        </div>
        <div className="text-right text-xs text-white/45">
          <div className="rounded-full border border-white/10 px-2 py-1 group-open:bg-white/10">Details</div>
          {isUpcoming ? <div className="mt-2 font-medium text-white/70"><Countdown date={match.date} compact /></div> : null}
        </div>
      </summary>

      <div className="mt-4 border-t border-white/10 pt-4 text-sm leading-6 text-white/62">
        <div><span className="text-white/35">Kickoff:</span> {formatKickoff(match.date)}</div>
        <div><span className="text-white/35">Venue:</span> {match.venue}{match.city ? `, ${match.city}` : ""}</div>
        {commentary ? <p className="mt-3 text-white/72">{matchCommentary(match)}</p> : null}
        {match.goals.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {match.goals.map((goal, idx) => {
              const scoringTeam = teamForGoal(match, goal.teamId);
              return (
                <span key={`${goal.player}-${idx}`} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/60">
                  <Flag abbreviation={scoringTeam?.abbreviation} label={scoringTeam?.displayName} />{goal.player} {goal.minute}
                </span>
              );
            })}
          </div>
        ) : null}
      </div>
    </details>
  );
}

function CompactSection({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-4 backdrop-blur-xl sm:p-5">
      <details>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>
            <p className="mt-1 text-xs text-white/45">{count} items · tap to expand</p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-black">Open</span>
        </summary>
        <div className="mt-4 grid gap-3">{children}</div>
      </details>
    </section>
  );
}

function GroupCard({ group }: { group: Groups[number] }) {
  const topLine = group.teams.slice(0, 2).map((entry) => `${entry.team.abbreviation} ${entry.stats.points ?? 0}`).join(" · ");
  return (
    <details className="group rounded-2xl border border-white/10 bg-white/[0.045] p-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-white">{group.name}</div>
          <div className="mt-1 text-xs text-white/45">Top: {topLine}</div>
        </div>
        <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/45 group-open:bg-white/10">Table</span>
      </summary>
      <div className="mt-3 space-y-1.5">
        <div className="grid grid-cols-[1fr_2rem_2rem_2.4rem] px-2 text-[10px] uppercase tracking-[0.16em] text-white/30">
          <span>Team</span><span className="text-center">P</span><span className="text-center">GD</span><span className="text-right">Pts</span>
        </div>
        {group.teams.map((entry) => {
          const focus = ["United States", "England"].includes(entry.team.displayName);
          return (
            <div key={entry.team.id} className={cx("grid grid-cols-[1fr_2rem_2rem_2.4rem] items-center rounded-xl px-2 py-2 text-sm", entry.rank <= 2 ? "bg-emerald-300/[0.10]" : "bg-white/[0.03]", focus && "ring-1 ring-sky-300/60") }>
              <span className="truncate text-white"><Flag abbreviation={entry.team.abbreviation} label={entry.team.displayName} />{entry.rank}. {entry.team.displayName}</span>
              <span className="text-center text-white/55">{entry.stats.gamesPlayed ?? 0}</span>
              <span className="text-center text-white/55">{entry.stats.pointDifferential ?? 0}</span>
              <span className="text-right font-semibold text-white">{entry.stats.points ?? 0}</span>
            </div>
          );
        })}
      </div>
    </details>
  );
}

export default async function Home() {
  await connection();
  const [matchesResult, groupsResult] = await Promise.allSettled([getMatches(), getStandings()]);
  const matches = matchesResult.status === "fulfilled" ? matchesResult.value : [];
  const groups = groupsResult.status === "fulfilled" ? groupsResult.value : [];
  const dataIssue = matchesResult.status === "rejected" || groupsResult.status === "rejected";

  const completed = matches.filter((match) => match.completed);
  const upcoming = matches.filter((match) => match.state === "pre");
  const live = matches.filter((match) => match.state === "in");
  const focusMatches = matches.filter((match) => teamInMatch(match, focusTeams));
  const past = [...completed].reverse();
  const bracketMatches = matches.filter((match) => !match.group.includes("Group"));
  const now = new Date();

  return (
    <main className="min-h-screen bg-[#030305] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(0,113,227,0.22),transparent_32%),radial-gradient(circle_at_82%_8%,rgba(191,90,242,0.16),transparent_26%)]" />
      <div className="relative mx-auto max-w-5xl px-3 py-4 sm:px-6 sm:py-6">
        <header className="sticky top-2 z-20 rounded-3xl border border-white/10 bg-black/70 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">World Cup Status</h1>
              <p className="text-xs text-white/45">{completed.length}/{matches.length} complete · ESPN · {formatKickoff(now.toISOString())}</p>
            </div>
            <div className={cx("rounded-full px-3 py-1 text-xs font-semibold", live.length ? "bg-emerald-300 text-black" : "bg-white/10 text-white/60")}>{live.length ? `${live.length} LIVE` : "No live"}</div>
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 text-sm">
            {[
              ["#live-upcoming", "Live + upcoming"],
              ["#focus", "USA / England"],
              ["#past", "Past"],
              ["#standings", "Standings"],
              ["#bracket", "Bracket"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-medium text-white/70">{label}</a>
            ))}
          </nav>
        </header>

        {dataIssue ? (
          <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
            Partial ESPN data on this refresh. Some sections may be sparse.
          </div>
        ) : null}

        <section className="mt-4 grid grid-cols-4 gap-2">
          {[
            ["Matches", matches.length],
            ["Live", live.length],
            ["Next", upcoming.length],
            ["Groups", groups.length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-center">
              <div className="text-xl font-semibold">{value}</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-white/35">{label}</div>
            </div>
          ))}
        </section>

        <div id="focus" className="mt-3 grid scroll-mt-24 gap-2 sm:grid-cols-2">
          <MiniTeamStatus teamName="United States" matches={matches} groups={groups} />
          <MiniTeamStatus teamName="England" matches={matches} groups={groups} />
        </div>

        <div className="mt-4 grid gap-4">
          <CompactSection id="live-upcoming" title="Live + upcoming" count={live.length + upcoming.length}>
            {live.length === 0 ? <div className="rounded-2xl bg-white/[0.04] p-3 text-sm text-white/45">No matches live right now.</div> : null}
            {live.map((match) => <CompactMatch key={match.id} match={match} highlight={teamInMatch(match, focusTeams)} />)}
            {upcoming.slice(0, 16).map((match) => <CompactMatch key={match.id} match={match} highlight={teamInMatch(match, focusTeams)} />)}
          </CompactSection>

          <CompactSection id="past" title="Past matches + commentary" count={past.length}>
            {past.map((match) => <CompactMatch key={match.id} match={match} highlight={teamInMatch(match, focusTeams)} commentary />)}
          </CompactSection>

          <CompactSection id="standings" title="Overall standings" count={groups.length}>
            <div className="grid gap-3 sm:grid-cols-2">
              {groups.map((group) => <GroupCard key={group.name} group={group} />)}
            </div>
          </CompactSection>

          <CompactSection id="bracket" title="Bracket / knockout path" count={bracketMatches.length}>
            {bracketMatches.length === 0 ? <div className="rounded-2xl bg-white/[0.04] p-3 text-sm text-white/45">Knockout fixtures are not listed yet.</div> : null}
            {bracketMatches.map((match) => <CompactMatch key={match.id} match={match} highlight={teamInMatch(match, focusTeams)} />)}
          </CompactSection>

          <CompactSection id="focus-feed" title="USA + England fixture trail" count={focusMatches.length}>
            {focusMatches.map((match) => <CompactMatch key={match.id} match={match} highlight commentary={match.completed} />)}
          </CompactSection>
        </div>
      </div>
    </main>
  );
}
