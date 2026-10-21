/// <reference types="vitest/globals" />
// Vitest globals are enabled for this package (see vitest.config.ts).
import { parse } from '../../src/index';

function errorCount(src: string): number {
  return parse(src).errors.length;
}

describe('parser limits', () => {
  it('rejects trailing input after a valid definition', () => {
    // A valid definition followed by garbage must not be accepted silently.
    expect(
      errorCount(`
        define view entity V as select from A
        {
          A.ID
        }
        THIS_IS_NOT_VALID_CDS
      `),
    ).toBeGreaterThan(0);
  });

  it('rejects NOT in an ON predicate', () => {
    // Known limitation — the expression grammar has no NOT support.
    expect(
      errorCount(`
        define view entity V as select from A
          join B on not A.k = B.k
        {
          A.ID
        }
      `),
    ).toBeGreaterThan(0);
  });

  it('rejects LIKE in an ON predicate', () => {
    // Known limitation — the expression grammar has no LIKE support.
    expect(
      errorCount(`
        define view entity V as select from A
          join B on A.k like 'X%'
        {
          A.ID
        }
      `),
    ).toBeGreaterThan(0);
  });

  it('rejects an arithmetic operand in an ON predicate', () => {
    // Known limitation — the expression grammar has no arithmetic support.
    expect(
      errorCount(`
        define view entity V as select from A
          join B on B.k + 1 = A.k
        {
          A.ID
        }
      `),
    ).toBeGreaterThan(0);
  });

  it('does not silently truncate a rejected ON condition', () => {
    const r = parse(`
      define view entity V as select from A
        join B on B.k + 1 = A.k
      {
        A.ID
      }
    `);

    expect(r.errors.length).toBeGreaterThan(0);

    // The condition must not be reported as a complete, valid predicate.
    const view = r.ast.definitions[0] as {
      joins?: Array<{ on?: { source: string } }>;
    };
    const on = view.joins?.[0]?.on?.source ?? '';
    expect(on).not.toContain('+ 1');
  });
});
