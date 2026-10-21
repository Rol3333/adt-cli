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

  it('accepts NOT in an ON predicate', () => {
    expect(
      errorCount(`
        define view entity V as select from A
          join B on not A.k = B.k
        {
          A.ID
        }
      `),
    ).toBe(0);
  });

  it('accepts LIKE in an ON predicate', () => {
    expect(
      errorCount(`
        define view entity V as select from A
          join B on A.k like 'X%'
        {
          A.ID
        }
      `),
    ).toBe(0);
  });

  it('accepts an arithmetic operand in an ON predicate', () => {
    expect(
      errorCount(`
        define view entity V as select from A
          join B on B.k + 1 = A.k
        {
          A.ID
        }
      `),
    ).toBe(0);
  });

  it('captures the complete ON condition including arithmetic', () => {
    const r = parse(`
      define view entity V as select from A
        join B on B.k + 1 = A.k
      {
        A.ID
      }
    `);

    expect(r.errors).toHaveLength(0);

    const view = r.ast.definitions[0] as {
      joins?: Array<{ on?: { source: string } }>;
    };
    const on = view.joins?.[0]?.on?.source ?? '';
    expect(on).toContain('+ 1');
  });
});
