/// <reference types="vitest/globals" />
// Vitest globals are enabled for this package (see vitest.config.ts).
import { parse, serializeExpr } from '../../src/index';
import type { JoinType, ViewEntityDefinition } from '../../src/ast';

function getView(src: string): ViewEntityDefinition {
  const r = parse(src);
  expect(r.errors).toHaveLength(0);
  return r.ast.definitions[0] as ViewEntityDefinition;
}

function joinTypes(src: string): JoinType[] {
  return getView(src).joins.map((j) => j.joinType);
}

describe('keyword case handling', () => {
  it('parses an all-lowercase join', () => {
    expect(
      joinTypes(`
        define view entity V as select from A
          left outer join B on A.k = B.k
        {
          A.k
        }
      `),
    ).toEqual(['leftOuter']);
  });

  it('parses an all-uppercase join', () => {
    expect(
      joinTypes(`
        DEFINE VIEW ENTITY V AS SELECT FROM A
          LEFT OUTER JOIN B ON A.k = B.k
        {
          A.k
        }
      `),
    ).toEqual(['leftOuter']);
  });

  it('parses a mixed-case join', () => {
    expect(
      joinTypes(`
        Define View Entity V as Select From A
          Left Outer Join B On A.k = B.k
        {
          A.k
        }
      `),
    ).toEqual(['leftOuter']);
  });

  it('parses an uppercase ON condition', () => {
    const v = getView(`
      DEFINE VIEW ENTITY V AS SELECT FROM A
        INNER JOIN B ON A.k = B.k
      {
        A.k
      }
    `);

    expect(serializeExpr(v.joins[0].on!)).toBe('A.k = B.k');
  });

  it('parses uppercase AND / OR in a condition', () => {
    const v = getView(`
      define view entity V as select from A
        inner join B ON A.k = B.k AND A.x = B.x
      {
        A.k
      }
    `);

    expect(serializeExpr(v.joins[0].on!)).toBe('A.k = B.k and A.x = B.x');

    const withOr = getView(`
      define view entity V as select from A
        inner join B ON A.k = B.k OR A.x = B.x
      {
        A.k
      }
    `);
    expect(serializeExpr(withOr.joins[0].on!)).toBe('A.k = B.k or A.x = B.x');
  });

  it('parses a mixed-case join after three earlier joins', () => {
    // Reproduces the position of the real-world fixture: several lowercase
    // joins followed by an uppercase one.
    const v = getView(`
      define view ZTEST_SampleCube as select from I_SampleItem as _Item
        left outer join ZTEST_ItemAmounts as _Inv
          on _Item.PurchaseRequisition = _Inv.PurchaseRequisition
        left outer join ZTEST_ApprovalView as _AprDat
          on _Item.PurchaseRequisition = _AprDat.PurchaseRequisition
        left outer join ZTEST_ClosureView as _ClsDat
          on _Item.PurchaseRequisition = _ClsDat.PurchaseRequisition
        LEFT OUTER JOIN ZTEST_DocumentView AS _PRDocList
          ON _Item.PurchaseRequisition = _PRDocList.PurchaseRequisition
      {
        _Item.PurchaseRequisition
      }
    `);

    expect(v.joins).toHaveLength(4);
    expect(v.joins.map((j) => j.joinType)).toEqual([
      'leftOuter',
      'leftOuter',
      'leftOuter',
      'leftOuter',
    ]);
    expect(v.joins[3].source.alias).toBe('_PRDocList');
  });

  it('parses core source keywords in upper case', () => {
    const v = getView(`
      DEFINE VIEW ENTITY V
        WITH PARAMETERS
          P_FromDate : abap.dats
        AS SELECT FROM A AS _A
        {
          KEY _A.k
        }
    `);

    expect(v.name).toBe('V');
    expect(v.parameters.map((p) => p.name)).toEqual(['P_FromDate']);
    expect(v.source.alias).toBe('_A');
  });

  it('keeps the original case of identifiers', () => {
    const v = getView(`
      DEFINE VIEW ENTITY V AS SELECT FROM A AS Left
      {
        A.Left,
        A.Join
      }
    `);

    expect(v.source.alias).toBe('Left');
    const expressions = v.members.map(
      (m) => (m as { expression: string }).expression,
    );
    expect(expressions).toEqual(['A.Left', 'A.Join']);
  });
});
