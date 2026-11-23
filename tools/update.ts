import type { Club } from './club.model.ts';
import type { Competitor } from './competitor.model.ts';
import { resultPath } from './constants.ts';
import { type IofPersonResult, iofReadResultList } from './iof-result-list.service.ts';
import { webRead, webWrite } from './web.service.ts';

type Result = {
  eventorId?: number;
  firstName: string;
  lastName: string;
  club?: string;
  clubId?: number;
  raceClass: string;
  result: 'ok' | 'dsq' | 'aborted' | 'didNotStart' | 'unknown';
};

function getResults(): { year: number; results: Result[] } {
  const iof = iofReadResultList(resultPath);
  if (!(iof.eventName ?? '').toLowerCase().includes('blodslitet')) {
    throw new Error(`Unexpected event name: '${iof.eventName}'`);
  }

  if (!/\d{4}-\d{2}-\d{2}/.test(iof.eventDate ?? '')) {
    throw new Error(`Unexpected event date: '${iof.eventDate}'`);
  }

  const year = parseInt(iof.eventDate!.substring(0, 4));

  const results: Result[] = [];
  for (const raceClass of iof.classes) {
    if (!raceClass.className) {
      throw new Error(`Missing a class name for ${JSON.stringify(raceClass.persons[0] ?? {})}`);
    }
    for (const personResult of raceClass.persons) {
      if (!personResult.firstName) {
        throw new Error(`Missing firstName for ${JSON.stringify(personResult)}`);
      }

      const eventorId = personResult.eventorId === undefined ? undefined : parseInt(personResult.eventorId);
      if (eventorId !== undefined && eventorId.toString() !== personResult.eventorId) {
        throw new Error(`Could not parse eventorId '${personResult.eventorId}' in ${JSON.stringify(personResult)}`);
      }

      const clubId = personResult.clubId === undefined ? undefined : parseInt(personResult.clubId);
      if (clubId !== undefined) {
        if (clubId.toString() !== personResult.clubId) {
          throw new Error(
            `Could not parse eventor club id '${personResult.clubId}' in ${JSON.stringify(personResult)}`,
          );
        }
      }

      results.push({
        eventorId: eventorId,
        firstName: personResult.firstName,
        lastName: personResult.lastName ?? '',
        club: personResult.club,
        clubId: clubId,
        raceClass: raceClass.className,
        result: mapIofStatusToResult(personResult.status),
      });
    }
  }

  return { year, results };
}

function mapIofStatusToResult(status: IofPersonResult['status']): Result['result'] {
  switch (status) {
    case 'OK':
    case 'Finished':
      return 'ok';
    case 'MissingPunch':
    case 'Disqualified':
    case 'OverTime':
      return 'dsq';
    case 'DidNotFinish':
    case 'SportingWithdrawal':
      return 'aborted';
    case 'DidNotStart':
    case 'DidNotEnter':
      return 'didNotStart';
    case 'Active':
    case 'Inactive':
    case 'NotCompeting':
    case 'Moved':
    case 'MovedUp':
    case undefined:
      return 'unknown';
  }
}

function upsertCompetitor(
  competitors: Competitor[],
  eventorMap: Map<number, Competitor>,
  year: number,
  r: Result,
): void {
  let c: Competitor | undefined = r.eventorId === undefined ? undefined : eventorMap.get(r.eventorId);
  if (c === undefined) {
    c = {
      eventorId: r.eventorId,
      firstName: r.firstName,
      lastName: r.lastName,
      club: r.club,
      participations: [],
    };
    competitors.push(c);
  } else {
    if (r.firstName !== c.firstName || r.lastName !== c.lastName) {
      console.log(`${c.eventorId?.toString().padStart(6, ' ')} ${c.firstName} ${c.lastName}`);
      console.log(`${'=>'.padStart(6, ' ')} ${r.firstName} ${r.lastName}`);
      c.firstName = r.firstName;
      c.lastName = r.lastName;
    }
    if (r.club !== undefined && r.club !== c.club) {
      c.club = r.club;
    }
  }

  const previousParticipation = c.participations.at(-1)?.[0] ?? 0;
  if (year <= previousParticipation) {
    throw new Error(
      `Updates not supported. ${c.eventorId} ${c.firstName} ${c.lastName} registered in ${previousParticipation}`,
    );
  }

  c.participations.push([year, r.raceClass]);
}

function upsertClub(
  competitors: Competitor[],
  clubs: Club[],
  clubIdMap: Map<number, Club>,
  clubNameMap: Map<string, Club>,
  r: Result,
): void {
  if (r.club !== undefined) {
    // update club name if result club has eventor id
    let club = r.clubId === undefined ? undefined : clubIdMap.get(r.clubId);
    if (club !== undefined) {
      if (club.name !== r.club) {
        console.log(`${r.clubId?.toString().padStart(6, ' ')} ${club.name}`);
        console.log(`${'=>'.padStart(6, ' ')} ${r.club}`);
        for (const competitor of competitors) {
          if (competitor.club === club.name) {
            competitor.club = r.club;
          }
        }
        club.name = r.club;
      }
    } else {
      // add club if name is not in the list of clubs
      club = clubNameMap.get(r.club);
      if (club === undefined) {
        club = { eventorId: r.clubId, name: r.club };
        clubs.push(club);
        clubNameMap.set(club.name, club);
        if (club.eventorId !== undefined) {
          clubIdMap.set(club.eventorId, club);
        }
      }
    }
  } else if (r.clubId !== undefined) {
    throw new Error(`Result has club id without name: ${JSON.stringify(r)}`);
  }
}

function applyResults(competitors: Competitor[], clubs: Club[], year: number, results: Result[]): void {
  const eventorMap = new Map<number, Competitor>();
  for (const c of competitors) {
    if (c.eventorId !== undefined) {
      if (eventorMap.has(c.eventorId)) {
        throw new Error(`Existing competitors have duplicate eventorId ${c.eventorId}`);
      }
      eventorMap.set(c.eventorId, c);
    }
  }

  const clubIdMap = new Map<number, Club>();
  const clubNameMap = new Map<string, Club>();
  for (const c of clubs) {
    if (c.eventorId !== undefined) {
      if (clubIdMap.has(c.eventorId)) {
        throw new Error(`Existing clubs have duplicate id ${c.eventorId}`);
      }
      clubIdMap.set(c.eventorId, c);
    }
    if (clubNameMap.has(c.name)) {
      throw new Error(`Existing clubs have duplicate name ${c.name}`);
    }
    clubNameMap.set(c.name, c);
  }

  console.log(
    `Processing ${results.length} results from ${year}, ${results.filter((r) => r.eventorId === undefined).length} without eventorId`,
  );

  const processedMap = new Map<number, Result>();
  for (const r of results) {
    if (r.eventorId) {
      const duplicate = processedMap.get(r.eventorId);
      if (duplicate) {
        if ((duplicate.result === 'ok') !== (r.result === 'ok')) {
          throw new Error(`Inconsistent result duplicate: ${JSON.stringify(duplicate)}, ${JSON.stringify(r)}`);
        } else {
          console.log('Ingoring result duplicate...');
          console.log(`  ${JSON.stringify(duplicate)}`);
          console.log(`  ${JSON.stringify(r)}`);
          continue;
        }
      }
      processedMap.set(r.eventorId, r);
    }

    if (r.result === 'ok') {
      upsertCompetitor(competitors, eventorMap, year, r);
      upsertClub(competitors, clubs, clubIdMap, clubNameMap, r);
    }
  }
}

function reportResults(year: number, results: Result[]): void {
  const stats = {
    noEventorId: 0,
    noClub: 0,
    noLastName: 0,
    result: {} as Record<string, number>,
  };
  for (const r of results) {
    if (r.eventorId === undefined) {
      stats.noEventorId += 1;
    }
    if (r.club === undefined) {
      stats.noClub += 1;
    }
    if (!r.lastName) {
      stats.noLastName += 1;
    }
    stats.result[r.result] = 1 + (stats.result[r.result] ?? 0);
  }
  console.log(`Found ${results.length} person results from ${year}: ${JSON.stringify(stats, null, 2)}`);
}

function main(): void {
  let { competitors, clubs } = webRead();
  let { year, results } = getResults();

  if (year === 2026) {
    // Norwegian championship classes were duplicated to filter out non-Norwegian competitors
    results = results.filter((r) => !r.raceClass.endsWith('NM'));
  }

  reportResults(year, results);
  applyResults(competitors, clubs, year, results);

  webWrite(competitors, clubs);
}

main();
