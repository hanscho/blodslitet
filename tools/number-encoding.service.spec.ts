import { numberFromAscii, numberToAscii } from './number-encoding.service.ts';

describe('numberToAscii', () => {
  test('expect values to be converted correctly', () => {
    expect(numberToAscii(0)).toStrictEqual('!');
    expect(numberToAscii(1)).toStrictEqual('"');
    expect(numberToAscii(89)).toStrictEqual('~');
    expect(numberToAscii(90)).toStrictEqual('!"');
    expect(numberToAscii(91)).toStrictEqual('""');
    expect(numberToAscii(8099)).toStrictEqual('~~');
    expect(numberToAscii(8100)).toStrictEqual('!!"');
  });

  test('convert undefined works', () => {
    expect(numberToAscii(undefined)).toBeUndefined();
  });
});

describe('numberFromAscii', () => {
  test('expect values to be converted correctly', () => {
    expect(numberFromAscii('!')).toStrictEqual(0);
    expect(numberFromAscii('"')).toStrictEqual(1);
    expect(numberFromAscii('~')).toStrictEqual(89);
    expect(numberFromAscii('!"')).toStrictEqual(90);
    expect(numberFromAscii('""')).toStrictEqual(91);
    expect(numberFromAscii('~~')).toStrictEqual(8099);
    expect(numberFromAscii('!!"')).toStrictEqual(8100);
  });

  test('convert undefined works', () => {
    expect(numberFromAscii(undefined)).toBeUndefined();
  });
});
