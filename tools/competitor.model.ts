import type { Club, WebClub } from './club.model.ts';
import { firstYear } from './constants.ts';
import { numberFromAscii, numberToAscii } from './number-encoding.service.ts';

export type Competitor = {
  eventorId?: number;
  firstName: string;
  lastName: string;
  club?: string;
  participations: [year: number, raceClass: string][];
};

export type WebCompetitor = {
  eventorIdAscii?: string;
  firstName: string;
  lastName: string;
  clubIndexAscii?: string;
  // alternating list of yearOffset encoded as ASCII, class (yearOffset = year-firstYear)
  participations: string[];
  sortKey?: string;
};

export function mapToWebCompetitor(c: Competitor, webClubs: Map<string, WebClub>): WebCompetitor {
  let club = c.club === undefined ? undefined : webClubs.get(c.club);
  if (c.club !== undefined) {
    if (club === undefined) {
      throw new Error(`${c.club} not in club map`);
    }
    if (club.lineIndex === undefined) {
      throw new Error(`${c.club} missing lineIndex`);
    }
  }

  const flatParticipations: string[] = [];
  for (const p of c.participations) {
    const yearOffset = p[0] - firstYear;
    flatParticipations.push(numberToAscii(yearOffset), p[1]);
  }

  return {
    eventorIdAscii: numberToAscii(c.eventorId),
    firstName: c.firstName,
    lastName: c.lastName,
    clubIndexAscii: numberToAscii(club?.lineIndex),
    participations: flatParticipations,
    sortKey: `${c.firstName}#${c.lastName}#${c.club}#${c.eventorId}`,
  };
}

export function mapFromWebCompetitor(c: WebCompetitor, clubs: Club[]): Competitor {
  // convert from string yearOffset to integer year
  const participations: [year: number, raceClass: string][] = [];
  for (let i = 0; i < c.participations.length; i += 2) {
    const yearOffsetString = c.participations[i];
    const yearOffset = numberFromAscii(yearOffsetString);

    participations.push([firstYear + yearOffset, c.participations[i + 1]]);
  }

  // verify that clubIndex is not out of bounds
  const clubIndex = numberFromAscii(c.clubIndexAscii);
  let club = clubIndex === undefined ? undefined : clubs[clubIndex];
  if (club === undefined && clubIndex !== undefined) {
    throw new Error(`Has ${clubs.length} clubs, unknown clubIndex ${clubIndex} in ${JSON.stringify(c)}`);
  }

  return {
    eventorId: numberFromAscii(c.eventorIdAscii),
    firstName: c.firstName,
    lastName: c.lastName,
    club: club?.name,
    participations: participations,
  };
}
