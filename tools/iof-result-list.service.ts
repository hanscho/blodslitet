import { XMLParser } from 'fast-xml-parser';
import * as fs from 'node:fs';

export type IofPersonResult = {
  eventorId?: string;
  firstName?: string;
  lastName?: string;
  club?: string;
  clubId?: string;
  // <xsd:simpleType name="ResultStatus">
  status?:
    | 'OK'
    | 'Finished'
    | 'MissingPunch'
    | 'Disqualified'
    | 'DidNotFinish'
    | 'Active'
    | 'Inactive'
    | 'OverTime'
    | 'SportingWithdrawal'
    | 'NotCompeting'
    | 'Moved'
    | 'MovedUp'
    | 'DidNotStart'
    | 'DidNotEnter';
};

export type IofClassResult = {
  className?: string;
  persons: IofPersonResult[];
};

export type IofResultList = {
  eventName?: string;
  eventDate?: string;
  classes: IofClassResult[];
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

function rootProcessor(target: IofResultList, xml: any): void {
  processElements(target, xml.ResultList, resultListProcessor);
}

function resultListProcessor(target: IofResultList, xml: any): void {
  processElements(target, xml.Event, eventProcessor);
  processElements(target, xml.ClassResult, classResultProcessor, classResultInit);
}

function eventProcessor(target: IofResultList, xml: any): void {
  processText(target, xml.Name, (text, target) => (target.eventName = text));
  processElements(target, xml.StartTime, eventStartTimeProcessor);
}

function eventStartTimeProcessor(target: IofResultList, xml: any): void {
  processText(target, xml.Date, (text, target) => (target.eventDate = text));
}

function classResultInit(target: IofResultList): IofClassResult {
  const result: IofClassResult = {
    className: undefined,
    persons: [],
  };
  target.classes.push(result);
  return result;
}

function classResultProcessor(target: IofClassResult, xml: any): void {
  processElements(target, xml.Class, classProcessor);
  processElements(target, xml.PersonResult, personResultProcessor, personResultInit);
}

function classProcessor(target: IofClassResult, xml: any): void {
  processText(target, xml.Name, (text, target) => (target.className = text));
}

function personResultInit(target: IofClassResult): IofPersonResult {
  const result: IofPersonResult = {
    eventorId: undefined,
    firstName: undefined,
    lastName: undefined,
    club: undefined,
    status: undefined,
  };
  target.persons.push(result);
  return result;
}

function personResultProcessor(target: IofPersonResult, xml: any): void {
  processElements(target, xml.Person, personProcessor);
  processElements(target, xml.Organisation, personOrganisationProcessor);
  processElements(target, xml.Result, resultDetailsProcessor);
}

function personProcessor(target: IofPersonResult, xml: any): void {
  processText(target, xml.Id, (text, target) => (target.eventorId = text));
  processElements(target, xml.Name, personNameProcessor);
}

function personNameProcessor(target: IofPersonResult, xml: any): void {
  processText(target, xml.Family, (text, target) => (target.lastName = text));
  processText(target, xml.Given, (text, target) => (target.firstName = text));
}

function personOrganisationProcessor(target: IofPersonResult, xml: any): void {
  processText(target, xml.Id, (text, target) => (target.clubId = text));
  processText(target, xml.Name, (text, target) => (target.club = text));
}

function resultDetailsProcessor(target: IofPersonResult, xml: any): void {
  processText(target, xml.Status, statusProcessor);
}

function statusProcessor(text: string, target: IofPersonResult): void {
  if (
    text !== 'OK' &&
    text !== 'Finished' &&
    text !== 'MissingPunch' &&
    text !== 'Disqualified' &&
    text !== 'DidNotFinish' &&
    text !== 'Active' &&
    text !== 'Inactive' &&
    text !== 'OverTime' &&
    text !== 'SportingWithdrawal' &&
    text !== 'NotCompeting' &&
    text !== 'Moved' &&
    text !== 'MovedUp' &&
    text !== 'DidNotStart' &&
    text !== 'DidNotEnter'
  ) {
    throw new Error(`Unknown status ${text} for ${JSON.stringify(target)}`);
  }
  target.status = text;
}

// https://github.com/international-orienteering-federation/datastandard-v3/blob/master/IOF.xsd
export function iofReadResultList(path: string): IofResultList {
  const resultFile = fs.readFileSync(path, { encoding: 'utf-8' });
  const xmlConfig = { ignoreAttributes: false, attributeNamePrefix: '@@', preserveOrder: true };
  const parser = new XMLParser(xmlConfig);
  const data = parser.parse(resultFile);

  const result: IofResultList = {
    eventName: undefined,
    eventDate: undefined,
    classes: [],
  };
  processElements(result, data, rootProcessor);
  return result;
}
