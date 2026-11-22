import * as fs from 'node:fs';
import type { Competitor } from './competitor.model.ts';
import type { IofCompetitor } from './iof-competitor-list.service.ts';

export function mergeDuplicates(competitors: Competitor[]): Competitor[] {
  const existing = new Set<string>();
  const result: Competitor[] = [];
  for (const competitor of competitors) {
    const key = JSON.stringify(competitor);
    if (!existing.has(key)) {
      existing.add(key);
      result.push(competitor);
    }
  }

  console.log(`Removed ${competitors.length - result.length} exact duplicate(s) (including participations)`);

  return result;
}

export function mergeEventorDuplicates(competitors: Competitor[]): Competitor[] {
  const map = new Map<number, Competitor>();
  const result: Competitor[] = [];
  for (const competitor of competitors) {
    if (competitor.eventorId) {
      const existing = map.get(competitor.eventorId);
      if (existing) {
        mergeCompetitor(existing, competitor);
      } else {
        map.set(competitor.eventorId, competitor);
        result.push(competitor);
      }
    } else {
      result.push(competitor);
    }
  }

  console.log(`Merged ${competitors.length - result.length} eventor duplicate(s)`);

  return result;
}

export function mergeCompetitors(competitors: Competitor[], dataFile: string): Competitor[] {
  const mergedJson = new Set<string>();
  const usedTargets = new Set<string>();
  const jsonMap = new Map<string, Competitor>(competitors.map((c) => [JSON.stringify(c), c]));
  const requests = getMergeRequests(dataFile);
  const unusedRequests = new Set<string>(requests.map((r) => r.sourceJson));

  const stats = {
    requests: requests.length,
    mergeSources: 0,
    skippedTwoWayMerge: 0,
    skippedTwoWayEventor: 0,
    skippedExistingEventor: 0,
    setEventorId: 0,
    competitorsBefore: competitors.length,
    competitorsAfter: 0,
  };

  for (const request of requests) {
    unusedRequests.delete(request.sourceJson);
    const sourceCompetitor = jsonMap.get(request.sourceJson);
    if (!sourceCompetitor) {
      throw new Error(`Unknown merged source ${request.sourceJson}`);
    }

    if (usedTargets.has(request.sourceJson)) {
      if (request.resultTargetJsons.length > 0) {
        stats.skippedTwoWayMerge += 1;
      }
      if (request.eventorMatches.length > 0) {
        stats.skippedTwoWayEventor += 1;
      }
      continue;
    }

    let targetCompetitor: Competitor | undefined = sourceCompetitor;

    if (request.resultTargetJsons.length > 0) {
      if (request.resultTargetJsons.length > 1) {
        throw new Error('Multiple result targets for merge request ' + request);
      }

      const targetJson = request.resultTargetJsons[0];
      usedTargets.add(targetJson);
      targetCompetitor = jsonMap.get(targetJson);
      if (!targetCompetitor) {
        throw new Error(`Unknown merged target ${targetJson} for request ${request.sourceJson}`);
      }
      mergeCompetitor(targetCompetitor, sourceCompetitor);

      stats.mergeSources += 1;
      mergedJson.add(request.sourceJson);
    }

    if (request.eventorMatches.length > 0) {
      if (request.eventorMatches.length > 1) {
        throw new Error(`Multiple eventor targets for merge request ${request.sourceJson}`);
      }

      let eventorMatch = request.eventorMatches[0];
      if (!eventorMatch.eventorId || !eventorMatch.firstName || !eventorMatch.lastName) {
        throw new Error(
          `Missing eventorId/firstName/lastName in ${JSON.stringify(eventorMatch)} for ${request.sourceJson}`,
        );
      }

      if (targetCompetitor.eventorId === undefined) {
        stats.setEventorId += 1;
        targetCompetitor.eventorId = eventorMatch.eventorId;
        targetCompetitor.firstName = eventorMatch.firstName;
        targetCompetitor.lastName = eventorMatch.lastName;
      } else {
        stats.skippedExistingEventor += 1;
      }
    }
  }

  if (unusedRequests.size > 0) {
    // a message here indicate some kind of data inconsistency that needs to be investigated
    console.log(`\n\nUNUSED REQUESTS: ` + JSON.stringify([...unusedRequests.keys()], null, 2));
  }

  const result = [...jsonMap.entries()].filter(([json, _c]) => !mergedJson.has(json)).map(([_json, c]) => c);
  stats.competitorsAfter = result.length;
  console.log(`Merged ${dataFile}`, JSON.stringify(stats, null, 2));
  return result;
}

type MergeRequest = { sourceJson: string; resultTargetJsons: string[]; eventorMatches: IofCompetitor[] };

function getMergeRequests(dataFile: string): MergeRequest[] {
  const path = `data/${dataFile}`;
  const content = fs.readFileSync(path, { encoding: 'utf-8' });
  if (content.includes('\r')) {
    throw new Error(`${path} contains \\r`);
  }
  const lines = content.split('\n');

  let currentRequest: MergeRequest | undefined = undefined;
  const requestSet = new Set<string>();
  const requests: MergeRequest[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('{')) {
      if (requestSet.has(line)) {
        throw new Error(`Duplicate request on line ${i + 1}: ${line}`);
      }
      requestSet.add(line);
      currentRequest = { sourceJson: line, resultTargetJsons: [], eventorMatches: [] };
      requests.push(currentRequest);
    } else if (line.startsWith('  RESULT ')) {
      if (!currentRequest) {
        throw new Error(`Unexpected format on line ${i + 1} in ${path}: ${line}`);
      }
      currentRequest.resultTargetJsons.push(line.substring('  RESULT '.length));
    } else if (line.startsWith('  EVENTOR ')) {
      if (!currentRequest) {
        throw new Error(`Unexpected format on line ${i + 1} in ${path}: ${line}`);
      }
      const json = line.substring('  EVENTOR '.length);
      currentRequest.eventorMatches.push(JSON.parse(json));
    } else if (line.trim().startsWith('#')) {
      // ignore (exists in merge file to show discarded options)
    } else if (line.length === 0) {
      // ignore
    } else {
      throw new Error(`Unexpected format on line ${i + 1} in ${path}: ${line}`);
    }
  }

  return requests;
}

function mergeCompetitor(target: Competitor, source: Competitor): void {
  const years = new Map<number, string>(target.participations);
  for (const [year, raceClass] of source.participations) {
    const existingClass = years.get(year);
    if (existingClass && existingClass != raceClass) {
      throw new Error(`Participation conflict when merging ${JSON.stringify(source)} into ${JSON.stringify(target)}`);
    }
    years.set(year, raceClass);
  }
  target.participations = [...years.keys()].sort().map((year) => [year, years.get(year)!]);
}
