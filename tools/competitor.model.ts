import { firstYear } from './constants.ts';

export type Competitor = {
  eventorId?: number;
  firstName: string;
  lastName: string;
  club?: string;
  participations: [year: number, raceClass: string][];
};

export type WebCompetitor = {
  eventorId?: number;
  firstName: string;
  lastName: string;
  clubIndex?: number;
  // alternating list of yearOffset, class (yearOffset = year-firstYear)
  participations: string[];
  sortKey?: string;
};

export function mapToWebCompetitor(c: Competitor, clubIndexes: Map<string, number>): WebCompetitor {
  let clubIndex = c.club === undefined ? undefined : clubIndexes.get(c.club);
  if (c.club !== undefined && clubIndex === undefined) {
    throw new Error(`${c.club} not in clubMap`);
  }

  const flatParticipations: string[] = [];
  for (const p of c.participations) {
    const yearOffset = p[0] - firstYear;
    flatParticipations.push(yearOffset.toString(), p[1]);
  }

  return {
    eventorId: c.eventorId,
    firstName: c.firstName,
    lastName: c.lastName,
    clubIndex: c.club === undefined ? undefined : clubIndexes.get(c.club),
    participations: flatParticipations,
    sortKey: `${c.firstName}#${c.lastName}#${c.club}#${c.eventorId}`,
  };
}

export function mapFromWebCompetitor(c: WebCompetitor, clubs: string[]): Competitor {
  // convert from string yearOffset to integer year
  const participations: [year: number, raceClass: string][] = [];
  for (let i = 0; i < c.participations.length; i += 2) {
    const yearOffsetString = c.participations[i];
    const yearOffset = parseInt(yearOffsetString);
    if (yearOffset.toString() !== yearOffsetString) {
      throw new Error(`Could not parse participation year offset '${yearOffsetString}' in ${JSON.stringify(c)}`);
    }

    participations.push([firstYear + yearOffset, c.participations[i + 1]]);
  }

  // verify that clubIndex is not out of bounds
  let club = c.clubIndex === undefined ? undefined : clubs[c.clubIndex];
  if (club === undefined && c.clubIndex !== undefined) {
    throw new Error(`Has ${clubs.length} clubs, unknown clubIndex ${c.clubIndex} in ${JSON.stringify(c)}`);
  }

  return {
    eventorId: c.eventorId,
    firstName: c.firstName,
    lastName: c.lastName,
    club: club,
    participations: participations,
  };
}
