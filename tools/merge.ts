import { currentYear, firstYear } from './constants.ts';
import { webRead, webWrite } from './web.service.ts';

type MergeArgs = {
  year: number;
};

function parseArgs(): MergeArgs {
  let mergeYear = currentYear;
  for (const arg of process.argv) {
    const year = parseInt(arg);
    if (year >= firstYear && year <= currentYear && year.toString() === arg) {
      mergeYear = year;
    }
  }

  return { year: mergeYear };
}

function main(): void {
  const args = parseArgs();
  let { competitors, clubs } = webRead();

  switch (args.year) {
    default:
      throw new Error(`Merge for year ${args.year} not implemented`);
  }

  webWrite(competitors, clubs);
}

main();
