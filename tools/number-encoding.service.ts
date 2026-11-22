// 90 characters are 1 byte in UTF-8, printable and safe to use inside an HTML element
const htmlSafeOneBytes: string[] = [];
for (let i = '!'.codePointAt(0)!; i <= `~`.codePointAt(0)!; i++) {
  const c = String.fromCodePoint(i);
  if (c !== '<' && c !== '>' && c !== '&' && c !== '\\') {
    htmlSafeOneBytes.push(c);
  }
}
const oneByteMap = htmlSafeOneBytes.reduce((m, c, i) => m.set(c, i), new Map<string, number>());

export function numberToAscii(value: number): string;
export function numberToAscii(value: number | undefined): string | undefined;
export function numberToAscii(value: number | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const modulus = htmlSafeOneBytes.length;
  let result = '';
  let remainder = value;
  do {
    const byteValue = remainder % modulus;
    result += htmlSafeOneBytes[byteValue];
    remainder = (remainder - byteValue) / modulus;
  } while (remainder > 0);
  return result;
}

export function numberFromAscii(value: string): number;
export function numberFromAscii(value: string | undefined): number | undefined;
export function numberFromAscii(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const modulus = htmlSafeOneBytes.length;
  let multiplier = 1;
  let result = 0;
  for (let c of value) {
    const byteValue = oneByteMap.get(c);
    if (byteValue === undefined) {
      throw new Error(`Could not ASCII number '${value}`);
    }

    result += multiplier * byteValue;
    multiplier *= modulus;
  }
  return result;
}
