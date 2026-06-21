/* eslint-disable @typescript-eslint/no-explicit-any */
export type EspnTeam = {
  id: string;
  displayName: string;
  shortDisplayName?: string;
  abbreviation: string;
  logos?: { href: string }[];
};

export type MatchTeam = {
  id: string;
  homeAway: "home" | "away";
  winner?: boolean;
  score: number;
  team: EspnTeam;
};

export type GoalEvent = {
  minute: string;
  teamId?: string;
  player: string;
  type: string;
};

export type MatchIncident = {
  minute: string;
  teamId?: string;
  player: string;
  type: string;
  scoringPlay: boolean;
};

export type Match = {
  id: string;
  date: string;
  name: string;
  shortName: string;
  group: string;
  venue: string;
  city: string;
  state: "pre" | "in" | "post";
  status: string;
  completed: boolean;
  teams: MatchTeam[];
  goals: GoalEvent[];
  incidents: MatchIncident[];
};

export type StandingTeam = {
  team: EspnTeam;
  rank: number;
  note?: string;
  stats: Record<string, string>;
  statValues: Record<string, number>;
};

export type GroupStanding = {
  name: string;
  teams: StandingTeam[];
};

const SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=200";
const STANDINGS_URL =
  "https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings";

async function getJson<T>(url: string, revalidate: number): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  const cacheOptions = revalidate === 0 ? { cache: "no-store" as const } : { next: { revalidate } };
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "world-cup-status/1.0" },
      signal: controller.signal,
      ...cacheOptions,
    });

    if (!res.ok) {
      throw new Error(`ESPN request failed: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}

function toNumber(score: unknown): number {
  const parsed = Number(score ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getMatches(): Promise<Match[]> {
  const data = await getJson<any>(SCOREBOARD_URL, 0);
  return (data.events ?? [])
    .map((event: any) => {
      const competition = event.competitions?.[0] ?? {};
      const teams = (competition.competitors ?? [])
        .map((competitor: any) => ({
          id: competitor.id,
          homeAway: competitor.homeAway,
          winner: competitor.winner,
          score: toNumber(competitor.score),
          team: competitor.team,
        }))
        .sort((a: MatchTeam) => (a.homeAway === "home" ? -1 : 1));

      const incidents = (competition.details ?? []).map((detail: any) => ({
        minute: detail.clock?.displayValue ?? "",
        teamId: detail.team?.id,
        player: detail.athletesInvolved?.[0]?.displayName ?? "Unknown player",
        type: detail.type?.text ?? "Incident",
        scoringPlay: Boolean(detail.scoringPlay),
      }));

      const goals = incidents
        .filter((detail: MatchIncident) => detail.scoringPlay)
        .map((detail: MatchIncident) => ({
          minute: detail.minute,
          teamId: detail.teamId,
          player: detail.player === "Unknown player" ? "Unknown scorer" : detail.player,
          type: detail.type,
        }));

      return {
        id: event.id,
        date: event.date,
        name: event.name,
        shortName: event.shortName,
        group: competition.altGameNote ?? "FIFA World Cup",
        venue: competition.venue?.fullName ?? event.venue?.fullName ?? "Venue TBC",
        city: competition.venue?.address?.city ?? event.venue?.address?.city ?? "",
        state: event.status?.type?.state ?? competition.status?.type?.state ?? "pre",
        status: event.status?.type?.shortDetail ?? competition.status?.type?.shortDetail ?? "Scheduled",
        completed: Boolean(event.status?.type?.completed ?? competition.status?.type?.completed),
        teams,
        goals,
        incidents,
      } satisfies Match;
    })
    .sort((a: Match, b: Match) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function statMap(stats: any[] = []) {
  const display: Record<string, string> = {};
  const values: Record<string, number> = {};
  for (const stat of stats) {
    display[stat.name] = stat.displayValue;
    values[stat.name] = Number(stat.value ?? 0);
  }
  return { display, values };
}

export async function getStandings(): Promise<GroupStanding[]> {
  const data = await getJson<any>(STANDINGS_URL, 300);
  return (data.children ?? []).map((child: any) => {
    const teams = (child.standings?.entries ?? [])
      .map((entry: any, index: number) => {
        const mapped = statMap(entry.stats);
        const rank = mapped.values.rank || index + 1;
        return {
          team: entry.team,
          rank,
          note: entry.note?.description,
          stats: mapped.display,
          statValues: mapped.values,
        } satisfies StandingTeam;
      })
      .sort((a: StandingTeam, b: StandingTeam) => {
        const rankDiff = a.rank - b.rank;
        if (rankDiff !== 0) return rankDiff;
        const pointDiff = (b.statValues.points ?? 0) - (a.statValues.points ?? 0);
        if (pointDiff !== 0) return pointDiff;
        return (b.statValues.pointDifferential ?? 0) - (a.statValues.pointDifferential ?? 0);
      });

    return {
      name: child.name,
      teams,
    };
  });
}

export function teamInMatch(match: Match, names: string[]) {
  return match.teams.some((side) =>
    names.includes(side.team.displayName) || names.includes(side.team.abbreviation),
  );
}

export function formatKickoff(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(date));
}

export function matchHeadline(match: Match) {
  const [home, away] = match.teams;
  if (!home || !away) return match.name;
  if (!match.completed) return `${home.team.displayName} vs ${away.team.displayName}`;

  if (home.score === away.score) {
    return `${home.team.displayName} and ${away.team.displayName} shared the points, ${home.score}-${away.score}.`;
  }
  const winner = home.score > away.score ? home : away;
  const loser = home.score > away.score ? away : home;
  const margin = Math.abs(home.score - away.score);
  const verb = margin >= 3 ? "cruised past" : margin === 2 ? "saw off" : "edged";
  return `${winner.team.displayName} ${verb} ${loser.team.displayName}, ${winner.score}-${loser.score}.`;
}
