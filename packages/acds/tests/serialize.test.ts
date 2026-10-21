/// <reference types="vitest/globals" />
// Vitest globals are enabled for this package (see vitest.config.ts).
import { parse, serializeExpr } from '../src/index';
import type { ViewEntityDefinition } from '../src/ast';

function getView(src: string): ViewEntityDefinition {
  const r = parse(src);
  expect(r.errors).toHaveLength(0);
  return r.ast.definitions[0] as ViewEntityDefinition;
}

/** The canonical form of the first join condition. */
function on(src: string): string {
  const view = getView(src);
  return serializeExpr(view.joins[0].on!);
}

describe('serializeExpr', () => {
  it('writes a comparison with spaces around the operator', () => {
    expect(
      on(`
        define view entity V as select from A
          join B on A.k = B.k
        { A.k }
      `),
    ).toBe('A.k = B.k');
  });

  it('writes a path without spaces around the separator', () => {
    expect(
      on(`
        define view entity V as select from A
          join B on A._Assoc.k = B.k
        { A.k }
      `),
    ).toBe('A._Assoc.k = B.k');
  });

  it('writes call arguments without a space after the parenthesis', () => {
    expect(
      on(`
        define view entity V as select from A
          join B on A.k = coalesce(B.k, B.l)
        { A.k }
      `),
    ).toBe('A.k = coalesce(B.k, B.l)');
  });

  it('writes boolean operators in lower case', () => {
    expect(
      on(`
        define view entity V as select from A
          join B on A.k = B.k and B.l = A.l
        { A.k }
      `),
    ).toBe('A.k = B.k and B.l = A.l');
  });

  it('keeps the parentheses of a grouped condition', () => {
    expect(
      on(`
        define view entity V as select from A
          join B on (A.k = B.k or A.l = B.l) and A.m = B.m
        { A.k }
      `),
    ).toBe('(A.k = B.k or A.l = B.l) and A.m = B.m');
  });

  it('writes a string literal with single quotes', () => {
    expect(
      on(`
        define view entity V as select from A
          join B on A.k = '0001'
        { A.k }
      `),
    ).toBe("A.k = '0001'");
  });

  it('writes a system variable with its prefix', () => {
    expect(
      on(`
        define view entity V as select from A
          join B on $projection.k = B.k
        { A.k }
      `),
    ).toBe('$projection.k = B.k');
  });

  it('serializes a view where clause', () => {
    const view = getView(`
      define view entity V as select from A
      {
        A.k
      }
      where A.k = B.k
    `);

    expect(serializeExpr(view.where!)).toBe('A.k = B.k');
  });
});
