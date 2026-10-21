/// <reference types="vitest/globals" />
// Vitest globals are enabled for this package (see vitest.config.ts).
import { parse, serializeExpr } from '../../src/index';
import type { Expr } from '../../src/ast';

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

  it('rejects BETWEEN in an ON predicate', () => {
    // Known limitation — the expression grammar has no BETWEEN support.
    expect(
      errorCount(`
        define view entity V as select from A
          join B on A.k between 1 and 2
        {
          A.ID
        }
      `),
    ).toBeGreaterThan(0);
  });

  it('does not silently truncate a rejected ON condition', () => {
    const r = parse(`
      define view entity V as select from A
        join B on A.k between 1 and 2
      {
        A.ID
      }
    `);

    expect(r.errors.length).toBeGreaterThan(0);

    // The condition must not be reported as a complete, valid predicate: only
    // the operand could be read, the rejected part is not part of the AST.
    const view = r.ast.definitions[0] as {
      joins?: Array<{ on?: Expr }>;
    };
    const on = view.joins?.[0]?.on;
    expect(on?.kind).toBe('fieldRef');
    expect(serializeExpr(on!)).toBe('A.k');
  });
});
