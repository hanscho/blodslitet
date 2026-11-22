import { XMLParser } from 'fast-xml-parser';
import * as fs from 'node:fs';
import { competitorsPath } from './constants.ts';

export type IofCompetitor = {
  eventorId?: number;
  firstName?: string;
  lastName?: string;
  club?: string;
  clubId?: string;
  birthYear?: number;
};

function processElements<T, T2 = T>(
  target: T,
  xml: any,
  processor: (target: T2, xml: any) => void,
  targetMapper: (target: T) => T2 = (target) => target as unknown as T2,
): void {
  if (xml) {
    const mappedTarget = targetMapper(target);
    for (const element of xml) {
      processor(mappedTarget, element);
    }
  }
}

function processText<T>(target: T, xml: any, processor: (text: string, target: T) => void): void {
  if (xml) {
    const text = xml[0]['#text']?.toString();
    if (text !== undefined) {
      processor(text, target);
    }
  }
}

function rootProcessor(target: IofCompetitor[], xml: any): void {
  processElements(target, xml.CompetitorList, competitorListProcessor);
}

function competitorListProcessor(target: IofCompetitor[], xml: any): void {
  processElements(target, xml.Competitor, competitorProcessor, competitorInit);
}

function competitorInit(target: IofCompetitor[]): IofCompetitor {
  const result: IofCompetitor = {
    eventorId: undefined,
    firstName: undefined,
    lastName: undefined,
    club: undefined,
    birthYear: undefined,
  };
  target.push(result);
  return result;
}

function competitorProcessor(target: IofCompetitor, xml: any): void {
  processElements(target, xml.Person, personProcessor);
  processElements(target, xml.Organisation, personOrganisationProcessor);
}

function personProcessor(target: IofCompetitor, xml: any): void {
  processText(target, xml.Id, (text, target) => {
    target.eventorId = mapToInt('eventorId', target, text);
  });
  processElements(target, xml.Name, personNameProcessor);
  processText(target, xml.BirthDate, (text, target) => {
    target.birthYear = mapToInt('birthYear', target, text.substring(0, 4));
  });
}

function personNameProcessor(target: IofCompetitor, xml: any): void {
  processText(target, xml.Family, (text, target) => (target.lastName = text));
  processText(target, xml.Given, (text, target) => (target.firstName = text));
}

function personOrganisationProcessor(target: IofCompetitor, xml: any): void {
  processText(target, xml.Id, (text, target) => (target.clubId = text));
  processText(target, xml.Name, (text, target) => (target.club = text));
}

function mapToInt(what: string, context: any, stringValue: string): number {
  const intValue = parseInt(stringValue);
  if (intValue.toString() !== stringValue) {
    throw new Error(`Could not parse ${what} '${stringValue}' in ${JSON.stringify(context)}`);
  }
  return intValue;
}

// https://github.com/international-orienteering-federation/datastandard-v3/blob/master/IOF.xsd
function iofReadCompetitorList(path: string): IofCompetitor[] {
  const resultFile = fs.readFileSync(path, { encoding: 'utf-8' });
  const xmlConfig = { ignoreAttributes: false, attributeNamePrefix: '@@', preserveOrder: true };
  const parser = new XMLParser(xmlConfig);
  const data = parser.parse(resultFile);

  const result: IofCompetitor[] = [];
  processElements(result, data, rootProcessor);
  return result;
}

export function iofGetCompetitors(): { competitors: Map<number, IofCompetitor>; clubs: Map<string, number> } {
  const iofCompetitors = iofReadCompetitorList(competitorsPath);

  let stats = {
    competitors: {
      count: iofCompetitors.length,
      noId: 0,
      noFirstName: 0,
      noLastName: 0,
      noBirthYear: 0,
      noClub: 0,
    },
    clubs: {
      count: 0,
      noId: 0,
    },
  };

  for (const c of iofCompetitors) {
    if (!c.eventorId) {
      stats.competitors.noId += 1;
    }
    if (!c.firstName) {
      stats.competitors.noFirstName += 1;
    }
    if (!c.lastName) {
      stats.competitors.noLastName += 1;
    }
    if (!c.birthYear) {
      stats.competitors.noBirthYear += 1;
    }
    if (!c.club) {
      stats.competitors.noClub += 1;
    } else if (!c.clubId) {
      stats.clubs.noId += 1;
    }
  }

  const competitorMap = new Map<number, IofCompetitor>();
  const clubMap = new Map<string, number>();
  for (const c of iofCompetitors) {
    if (c.eventorId !== undefined) {
      if (c.eventorId !== undefined) {
        if (competitorMap.has(c.eventorId)) {
          throw new Error(`Duplicate id from Eventor: ${c.eventorId}`);
        }
        competitorMap.set(c.eventorId, c);
      }

      if (c.club !== undefined) {
        const clubId = c.clubId === undefined ? undefined : parseInt(c.clubId);
        if (clubId !== undefined) {
          if (clubId.toString() !== c.clubId) {
            throw new Error(`Could not parse eventor club id '${c.clubId}' in ${JSON.stringify(c)}`);
          }

          // There are about 70 competitors in the registry with duplicate club registrations,
          // but hopefully none of those are in the Blodslitet results
          // const existingClubId = clubMap.get(c.club);
          // if (existingClubId !== undefined && clubId !== existingClubId) {
          //   console.log(`Duplicate club from Eventor: ${c.club} has both ${clubId} and ${existingClubId}`);
          // }
          clubMap.set(c.club, clubId);
        }
      }
    }
  }

  stats.clubs.count = clubMap.size;
  console.log(`Read eventor competitors: ${JSON.stringify(stats, null, 2)}`);

  return { competitors: competitorMap, clubs: clubMap };
}
