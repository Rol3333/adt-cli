/// <reference types="vitest/globals" />
// Vitest globals are enabled for this package (see vitest.config.ts).
import { parse, serializeExpr } from '../../src/index';
import type { JoinType, ViewEntityDefinition } from '../../src/ast';

function getView(src: string): ViewEntityDefinition {
  const r = parse(src);
  expect(r.errors).toHaveLength(0);
  return r.ast.definitions[0] as ViewEntityDefinition;
}

function errorCount(src: string): number {
  return parse(src).errors.length;
}

function joinTypeOf(src: string): JoinType | undefined {
  const r = parse(src);
  expect(r.errors).toHaveLength(0);
  const v = r.ast.definitions[0] as ViewEntityDefinition;
  return v.joins[0]?.joinType;
}

describe('join syntax', () => {
  it('accepts INNER JOIN with an ON condition', () => {
    expect(
      joinTypeOf(`
        define view entity V as select from A
          inner join B on A.ID = B.ID
        { A.ID }
      `),
    ).toBe('inner');
  });

  it('accepts a bare JOIN with an ON condition', () => {
    expect(
      joinTypeOf(`
        define view entity V as select from A
          join B on A.ID = B.ID
        { A.ID }
      `),
    ).toBe('inner');
  });

  it('accepts LEFT OUTER JOIN with an ON condition', () => {
    expect(
      joinTypeOf(`
        define view entity V as select from A
          left outer join B on A.ID = B.ID
        { A.ID }
      `),
    ).toBe('leftOuter');
  });

  it('accepts RIGHT OUTER JOIN with an ON condition', () => {
    expect(
      joinTypeOf(`
        define view entity V as select from A
          right outer join B on A.ID = B.ID
        { A.ID }
      `),
    ).toBe('rightOuter');
  });

  it('accepts CROSS JOIN without an ON condition', () => {
    const v = getView(`
      define view entity V as select from A
        cross join B
      {
        A.ID
      }
    `);

    expect(v.joins[0].joinType).toBe('cross');
    expect(v.joins[0].on).toBeUndefined();
  });

  it('rejects INNER JOIN without an ON condition', () => {
    const src = `
      define view entity V as select from A
        inner join B
      {
        A.ID
      }
    `;

    expect(errorCount(src)).toBeGreaterThan(0);

    // The recovered AST must not look like a complete join.
    const v = parse(src).ast.definitions[0] as ViewEntityDefinition;
    const join = v.joins?.[0];
    expect(join?.on?.source ?? '').toBe('');
  });

  it('rejects LEFT OUTER JOIN without an ON condition', () => {
    expect(
      errorCount(`
        define view entity V as select from A
          left outer join B
        {
          A.ID
        }
      `),
    ).toBeGreaterThan(0);
  });

  it('rejects RIGHT OUTER JOIN without an ON condition', () => {
    expect(
      errorCount(`
        define view entity V as select from A
          right outer join B
        {
          A.ID
        }
      `),
    ).toBeGreaterThan(0);
  });

  it('rejects CROSS JOIN with an ON condition', () => {
    const src = `
      define view entity V as select from A
        cross join B on A.ID = B.ID
      {
        A.ID
      }
    `;

    expect(errorCount(src)).toBeGreaterThan(0);

    // The ON condition is not silently attached to the cross join.
    const v = parse(src).ast.definitions[0] as ViewEntityDefinition;
    expect(v.joins?.[0]?.on).toBeUndefined();
  });

  it('accepts FULL OUTER JOIN with an ON condition', () => {
    // The SQL-standard outer join — supported so that HANA CDS / CAP CDS
    // sources can be read with the same grammar.
    expect(
      joinTypeOf(`
        define view entity V as select from A
          full outer join B on A.ID = B.ID
        {
          A.ID
        }
      `),
    ).toBe('fullOuter');
  });

  it('accepts FULL JOIN with an ON condition', () => {
    expect(
      joinTypeOf(`
        define view entity V as select from A
          full join B on A.ID = B.ID
        {
          A.ID
        }
      `),
    ).toBe('fullOuter');
  });

  it('rejects FULL OUTER JOIN without an ON condition', () => {
    expect(
      errorCount(`
        define view entity V as select from A
          full outer join B
        {
          A.ID
        }
      `),
    ).toBeGreaterThan(0);
  });

  it('accepts LEFT JOIN without OUTER in a view entity', () => {
    expect(
      joinTypeOf(`
        define view entity V as select from A
          left join B on A.ID = B.ID
        {
          A.ID
        }
      `),
    ).toBe('leftOuter');
  });

  it('accepts RIGHT JOIN without OUTER in a view entity', () => {
    expect(
      joinTypeOf(`
        define view entity V as select from A
          right join B on A.ID = B.ID
        {
          A.ID
        }
      `),
    ).toBe('rightOuter');
  });

  it('accepts LEFT JOIN in a legacy view', () => {
    expect(
      joinTypeOf(`
        define view V as select from A
          left join B on A.ID = B.ID
        {
          A.ID
        }
      `),
    ).toBe('leftOuter');
  });

  it('accepts RIGHT JOIN in a legacy view', () => {
    expect(
      joinTypeOf(`
        define view V as select from A
          right join B on A.ID = B.ID
        {
          A.ID
        }
      `),
    ).toBe('rightOuter');
  });

  it('accepts FULL OUTER JOIN in a legacy view', () => {
    expect(
      joinTypeOf(`
        define view V as select from A
          full outer join B on A.ID = B.ID
        {
          A.ID
        }
      `),
    ).toBe('fullOuter');
  });

  it('keeps parsing a parameterized source with its ON condition', () => {
    const v = getView(`
      define view entity V as select from A
        inner join C( P_StartDate : :P_StartDate ) as _C
          on A.ID = _C.ID
      {
        A.ID
      }
    `);

    expect(v.joins).toHaveLength(1);
    expect(v.joins[0].source.parameters).toEqual([
      { name: 'P_StartDate', value: ':P_StartDate' },
    ]);
    expect(serializeExpr(v.joins[0].on!)).toBe('A.ID = _C.ID');
  });
});
