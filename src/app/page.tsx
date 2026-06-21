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

function joinWithAnd(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function goalTypeLabel(type: string) {
  const lower = type.toLowerCase();
  if (lower.includes("penalty")) return "penalty";
  if (lower.includes("own goal")) return "own goal";
  if (lower.includes("header")) return "header";
  return "goal";
}

function goalMinuteNumber(minute: string) {
  const parsed = Number.parseInt(minute, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function describeGoalArc(match: Match) {
  const [home, away] = match.teams;
  if (!home || !away || match.goals.length === 0) return "";

  let homeRunning = 0;
  let awayRunning = 0;
  const beats = match.goals.map((goal) => {
    const scoringSide = match.teams.find((side) => side.team.id === goal.teamId);
    const scoringName = scoringSide?.team.displayName ?? "the scoring side";
    const beforeHome = homeRunning;
    const beforeAway = awayRunning;
    if (scoringSide?.homeAway === "home") homeRunning += 1;
    if (scoringSide?.homeAway === "away") awayRunning += 1;
    const afterHome = homeRunning;
    const afterAway = awayRunning;
    const wasLevel = beforeHome === beforeAway;
    const isLevel = afterHome === afterAway;
    const scoringWasAhead = scoringSide?.homeAway === "home" ? beforeHome > beforeAway : beforeAway > beforeHome;
    const scorer = goal.player;
    const type = goalTypeLabel(goal.type);
    const scorerText = type === "own goal" ? `${scorer} own goal` : `${scorer}${type === "goal" ? "" : ` ${type}`}`;

    let action = "scored";
    if (wasLevel && !isLevel) action = `put ${scoringName} ahead`;
    else if (!wasLevel && isLevel) action = `pulled ${scoringName} level`;
    else if (scoringWasAhead) action = `stretched ${scoringName}'s lead`;
    else action = `cut ${scoringName}'s deficit`;

    return { text: `${scorerText} ${action} on ${goal.minute}`, minute: goalMinuteNumber(goal.minute), scoringName, afterHome, afterAway };
  });

  const opener = beats[0]?.text;
  const lateBeats = beats.filter((beat) => beat.minute >= 75).map((beat) => beat.text);
  const winner = home.score === away.score ? null : home.score > away.score ? home : away;
  const decisive = winner
    ? beats.findLast((beat) => beat.scoringName === winner.team.displayName && (
        winner.homeAway === "home" ? beat.afterHome > beat.afterAway : beat.afterAway > beat.afterHome
      ))
    : null;

  const mentionedBeats = new Set<string>();
  if (opener) mentionedBeats.add(opener);
  const sentences = opener ? [`Sequence: ${opener}`] : [];
  if (match.goals.length > 1) {
    const remaining = beats.slice(1, 4).map((beat) => beat.text);
    for (const beat of remaining) mentionedBeats.add(beat);
    sentences.push(remaining.length ? `Then ${joinWithAnd(remaining)}.` : "");
  }
  const unmentionedLateBeats = lateBeats.filter((beat) => !mentionedBeats.has(beat));
  if (unmentionedLateBeats.length > 0) {
    sentences.push(`Late swing: ${joinWithAnd(unmentionedLateBeats)}.`);
  } else if (decisive && decisive.minute >= 45 && !mentionedBeats.has(decisive.text)) {
    sentences.push(`Decisive stretch: ${decisive.text}.`);
  }

  return sentences.filter(Boolean).join(" ");
}

function describeMatchTexture(match: Match) {
  const [home, away] = match.teams;
  if (!home || !away) return "";

  const redCards = match.incidents.filter((incident) => incident.type.toLowerCase().includes("red card"));
  const yellowCards = match.incidents.filter((incident) => incident.type.toLowerCase().includes("yellow card"));
  const scorerCounts = new Map<string, number>();
  for (const goal of match.goals) {
    if (!goal.type.toLowerCase().includes("own goal")) scorerCounts.set(goal.player, (scorerCounts.get(goal.player) ?? 0) + 1);
  }
  const multiScorers = [...scorerCounts.entries()].filter(([, count]) => count > 1).map(([player, count]) => `${player} (${count})`);

  const texture: string[] = [];
  if (home.score === 0 && away.score === 0) {
    texture.push("Both sides kept clean sheets.");
  } else if (home.score === 0 || away.score === 0) {
    const cleanSheetSide = home.score === 0 ? away : home;
    texture.push(`${cleanSheetSide.team.displayName} kept the clean sheet.`);
  }
  if (home.score === away.score && match.goals.length > 0) {
    const finalGoal = match.goals[match.goals.length - 1];
    const finalTeam = teamForGoal(match, finalGoal.teamId)?.displayName ?? "one side";
    texture.push(`${finalTeam}'s ${finalGoal.minute} goal was the equaliser.`);
  }
  if (multiScorers.length > 0) {
    texture.push(`Multi-goal scorer: ${joinWithAnd(multiScorers)}.`);
  }
  if (redCards.length > 0) {
    texture.push(`Red cards shaped it: ${joinWithAnd(redCards.map((card) => `${card.player} ${card.minute}`))}.`);
  } else if (yellowCards.length >= 4) {
    texture.push(`Chippy game: ${yellowCards.length} yellow cards.`);
  }

  return texture.join(" ");
}

function matchCommentary(match: Match) {
  const [home, away] = match.teams;
  if (!home || !away) return "Match details are unavailable.";

  if (!match.completed) {
    return `${matchStatus(match)}. ${match.group}. Venue: ${match.venue}${match.city ? `, ${match.city}` : ""}.`;
  }

  const result = matchHeadline(match);
  const arc = describeGoalArc(match);
  const texture = describeMatchTexture(match);
  const goalList = match.goals.length
    ? `Goal log: ${match.goals.map((goal) => {
        const scoringTeam = teamForGoal(match, goal.teamId)?.displayName;
        const type = goalTypeLabel(goal.type);
        return `${goal.player} ${goal.minute}${scoringTeam ? ` for ${scoringTeam}` : ""}${type === "goal" ? "" : ` (${type})`}`;
      }).join("; ")}.`
    : "ESPN did not return individual scorer data for this match.";

  return [
    result,
    arc,
    texture,
    goalList,
    `${shortGroup(match)} at ${match.venue}${match.city ? `, ${match.city}` : ""}.`,
  ].filter(Boolean).join(" ");
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

function LiveNowPanel({ matches }: { matches: Match[] }) {
  if (matches.length === 0) return null;

  return (
    <section id="live-now" className="mt-3 rounded-[1.75rem] border border-emerald-300/35 bg-emerald-300/[0.10] p-3 shadow-2xl shadow-emerald-950/20 backdrop-blur-xl sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.9)]" />
            Live now
          </div>
          <h2 className="mt-1 text-lg font-semibold text-white">Live match status</h2>
        </div>
        <a href="#live-upcoming" className="shrink-0 rounded-full bg-emerald-300 px-3 py-1.5 text-xs font-semibold text-black">Details</a>
      </div>

      <div className="grid gap-2">
        {matches.map((match) => {
          const [home, away] = match.teams;
          return (
            <div key={match.id} className="rounded-2xl border border-white/10 bg-black/25 p-3">
              <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                <span className="rounded-full bg-emerald-300 px-2.5 py-1 font-bold text-black">{match.status || "LIVE"}</span>
                <span className="truncate text-white/45">{shortGroup(match)}</span>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-base text-white">
                <span className="truncate font-semibold"><Flag abbreviation={home?.team.abbreviation} label={home?.team.displayName} />{home?.team.displayName ?? "TBC"}</span>
                <span className="text-xl font-bold tabular-nums">{home?.score ?? 0}</span>
                <span className="truncate font-semibold"><Flag abbreviation={away?.team.abbreviation} label={away?.team.displayName} />{away?.team.displayName ?? "TBC"}</span>
                <span className="text-xl font-bold tabular-nums">{away?.score ?? 0}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
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
              ...(live.length ? [["#live-now", "Live now"]] : []),
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

        <LiveNowPanel matches={live} />

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
