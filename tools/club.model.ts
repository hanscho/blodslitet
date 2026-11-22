import { numberFromAscii, numberToAscii } from './number-encoding.service.ts';

export type Club = {
  lineIndex?: number;
  eventorId?: number;
  name: string;
};

export type WebClub = {
  lineIndex?: number;
  eventorIdAscii?: string;
  name: string;
  sortKey?: string;
};

export function mapToWebClub(c: Club): WebClub {
  return {
    eventorIdAscii: numberToAscii(c.eventorId),
    name: c.name,
    sortKey: `${c.lineIndex === undefined ? 'NEW' : c.lineIndex.toString().padStart(5, '0')}#${c.name}`,
  };
}

export function mapFromWebClub(c: WebClub): Club {
  return {
    lineIndex: c.lineIndex,
    eventorId: numberFromAscii(c.eventorIdAscii),
    name: c.name,
  };
}
