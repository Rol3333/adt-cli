/// <reference types="vitest/globals" />
// Vitest globals are enabled for this package (see vitest.config.ts).
import { readFileSync } from 'node:fs';
import { parse } from '../../src/index';
import type { ViewEntityDefinition } from '../../src/ast';

function getView(src: string): ViewEntityDefinition {
  const r = parse(src);
  expect(r.errors).toHaveLength(0);
  return r.ast.definitions[0] as ViewEntityDefinition;
}

/** The captured condition without the token spacing of the flat token list. */
function cond(source: string | undefined): string {
  return (source ?? '').replace(/\s+/g, '');
}

describe('joins', () => {
  it('parses JOIN as an inner join', () => {
    const v = getView(`
      define view entity V as select from A
        join B on A.k = B.k
      {
        key A.k
      }
    `);

    expect(v.joins).toHaveLength(1);
    expect(v.joins[0].joinType).toBe('inner');
    expect(v.joins[0].source.name).toBe('B');
    expect(cond(v.joins[0].on?.source)).toBe('A.k=B.k');
  });

  it('normalizes INNER JOIN to inner', () => {
    const v = getView(`
      define view entity V as select from A
        inner join B on A.k = B.k
      {
        key A.k
      }
    `);

    expect(v.joins[0].joinType).toBe('inner');
  });

  it('normalizes LEFT OUTER JOIN to leftOuter', () => {
    const v = getView(`
      define view entity V as select from A
        left outer join B on A.k = B.k
        left outer join C on B.k = C.k
      {
        key A.k
      }
    `);

    expect(v.joins.map((j) => j.joinType)).toEqual(['leftOuter', 'leftOuter']);
  });

  it('normalizes LEFT JOIN in a legacy view to leftOuter', () => {
    // `LEFT JOIN` without `OUTER` is only accepted in the legacy
    // `define view` syntax — a view entity requires `LEFT OUTER JOIN`.
    const v = getView(`
      define view V as select from A
        left join B on A.k = B.k
        left outer join C on B.k = C.k
      {
        key A.k
      }
    `);

    expect(v.joins.map((j) => j.joinType)).toEqual(['leftOuter', 'leftOuter']);
  });

  it('normalizes RIGHT OUTER JOIN to rightOuter', () => {
    const v = getView(`
      define view entity V as select from A
        right outer join B on A.k = B.k
        right outer join C on B.k = C.k
      {
        key A.k
      }
    `);

    expect(v.joins.map((j) => j.joinType)).toEqual([
      'rightOuter',
      'rightOuter',
    ]);
  });

  it('normalizes RIGHT JOIN in a legacy view to rightOuter', () => {
    // `RIGHT JOIN` without `OUTER` is only accepted in the legacy
    // `define view` syntax — a view entity requires `RIGHT OUTER JOIN`.
    const v = getView(`
      define view V as select from A
        right join B on A.k = B.k
        right outer join C on B.k = C.k
      {
        key A.k
      }
    `);

    expect(v.joins.map((j) => j.joinType)).toEqual([
      'rightOuter',
      'rightOuter',
    ]);
  });

  it('normalizes CROSS JOIN to cross', () => {
    const v = getView(`
      define view entity V as select from A
        cross join B
      {
        key A.k
      }
    `);

    expect(v.joins).toHaveLength(1);
    expect(v.joins[0].joinType).toBe('cross');
    expect(v.joins[0].source.name).toBe('B');
    expect(v.joins[0].on).toBeUndefined();
  });

  it('keeps the alias of a joined source', () => {
    const v = getView(`
      define view entity V as select from I_Item as _Item
        left outer join ZI_Other as _Other on _Item.k = _Other.k
      {
        key _Item.k
      }
    `);

    expect(v.source.name).toBe('I_Item');
    expect(v.source.alias).toBe('_Item');
    expect(v.joins[0].source.alias).toBe('_Other');
  });

  it('parses a chain of joins in source order', () => {
    const v = getView(`
      define view entity V as select from A
        join B on A.k = B.k
        inner join C on B.k = C.k
        left outer join D on C.k = D.k
        left outer join E on D.k = E.k
        right outer join F on E.k = F.k
        right outer join G on F.k = G.k
        cross join H
      {
        key A.k
      }
    `);

    expect(v.joins).toHaveLength(7);
    expect(v.joins.map((j) => j.source.name)).toEqual([
      'B',
      'C',
      'D',
      'E',
      'F',
      'G',
      'H',
    ]);
    expect(v.joins.map((j) => j.joinType)).toEqual([
      'inner',
      'inner',
      'leftOuter',
      'leftOuter',
      'rightOuter',
      'rightOuter',
      'cross',
    ]);
  });

  it('parses a parameterized source and preserves the bindings', () => {
    const v = getView(`
      define view entity V as select from ZTEST_SampleCube
        ( P_StartDate : :P_Key1StartDate, P_EndDate : :P_Key2EndDate ) as _Cube
      {
        key _Cube.k
      }
    `);

    expect(v.source.name).toBe('ZTEST_SampleCube');
    expect(v.source.alias).toBe('_Cube');
    expect(v.source.parameters).toEqual([
      { name: 'P_StartDate', value: ':P_Key1StartDate' },
      { name: 'P_EndDate', value: ':P_Key2EndDate' },
    ]);
  });

  it('preserves system variable and literal bindings', () => {
    const v = getView(`
      define view entity V as select from ZTEST_DocumentView
        ( mandt : $session.client, p_startdate : $parameters.P_StartDate, p_text : 'X' )
      {
        key k
      }
    `);

    expect(v.source.parameters).toEqual([
      { name: 'mandt', value: '$session.client' },
      { name: 'p_startdate', value: '$parameters.P_StartDate' },
      { name: 'p_text', value: "'X'" },
    ]);
  });

  it('parses a parameterized joined source', () => {
    const v = getView(`
      define view entity V as select from I_Item as _Item
        left outer join ZTEST_DocumentView
          ( mandt : $session.client, p_startdate : $parameters.P_StartDate ) as _PRDocList
          on _Item.PurchaseRequisition = _PRDocList.PurchaseRequisition
      {
        key _Item.k
      }
    `);

    expect(v.joins[0].source.name).toBe('ZTEST_DocumentView');
    expect(v.joins[0].source.alias).toBe('_PRDocList');
    expect(v.joins[0].source.parameters).toHaveLength(2);
  });

  it('captures a multiline ON condition completely', () => {
    const v = getView(`
      define view entity V as select from I_SampleItem as _Item
        left outer join ZTEST_ItemAmounts as _Inv
          on  _Item.PurchaseRequisition = _Inv.PurchaseRequisition
          and _Item.PurchaseRequisitionItem = _Inv.PurchaseRequisitionItem
      {
        key _Item.k
      }
    `);

    expect(cond(v.joins[0].on?.source)).toBe(
      '_Item.PurchaseRequisition=_Inv.PurchaseRequisition' +
        'and_Item.PurchaseRequisitionItem=_Inv.PurchaseRequisitionItem',
    );
  });

  it('captures conditions with AND and OR predicates', () => {
    const v = getView(`
      define view entity V as select from I_Item as _Item
        left outer join ZTEST_USER_LIST as p1
          on _Item.CreatedByUser = p1.usrid
          and p1.begda <= _Item.CreationDate
          and p1.endda >= _Item.CreationDate
          and p1.subty = '0001'
        inner join ZTEST_USER_ORG as p2
          on p1.pernr = p2.pernr
          or p2.pernr = p1.pernr
      {
        key _Item.k
      }
    `);

    expect(cond(v.joins[0].on?.source)).toBe(
      '_Item.CreatedByUser=p1.usrid' +
        'andp1.begda<=_Item.CreationDate' +
        'andp1.endda>=_Item.CreationDate' +
        "andp1.subty='0001'",
    );
    expect(cond(v.joins[1].on?.source)).toBe(
      'p1.pernr=p2.pernrorp2.pernr=p1.pernr',
    );
  });

  it('does not truncate conditions at parentheses or commas', () => {
    const v = getView(`
      define view entity V as select from I_Item as _Item
        inner join I_Other as _Other
          on ( _Item.k = _Other.k or _Item.x = _Other.x )
          and _Item.y = coalesce( _Other.y, _Other.z )
      {
        key _Item.k
      }
    `);

    expect(cond(v.joins[0].on?.source)).toBe(
      '(_Item.k=_Other.kor_Item.x=_Other.x)' +
        'and_Item.y=coalesce(_Other.y,_Other.z)',
    );
  });

  it('reports malformed join syntax', () => {
    const missingSource = parse(`
      define view entity V as select from A
        join
      {
        key A.k
      }
    `);
    expect(missingSource.errors.length).toBeGreaterThan(0);

    const missingKeyword = parse(`
      define view entity V as select from A
        left outer B on A.k = B.k
      {
        key A.k
      }
    `);
    expect(missingKeyword.errors.length).toBeGreaterThan(0);

    const brokenCondition = parse(`
      define view entity V as select from A
        join B on
      {
        key A.k
      }
    `);
    expect(brokenCondition.errors.length).toBeGreaterThan(0);
  });

  it('keeps the join list empty for views without joins', () => {
    const v = getView(`
      define view entity V as select from A
      {
        key A.k
      }
    `);

    expect(v.joins).toEqual([]);
    expect(v.source.name).toBe('A');
  });

  it('keeps parsing views without joins (regression)', () => {
    const r = parse(`
      define view entity V as select from zsales_order as so
      {
        key so.order_id as OrderId,
        so.customer_name as CustomerName
      }
    `);

    expect(r.errors).toHaveLength(0);
    const v = r.ast.definitions[0] as ViewEntityDefinition;
    expect(v.joins).toEqual([]);
    expect(v.source).toEqual({ name: 'zsales_order', alias: 'so' });
    expect(v.members).toHaveLength(2);
  });

  it('keeps parsing tables and roles (regression)', () => {
    const table = parse(`
      define table ztable {
        key field1 : abap.char(10) not null;
        field2 : some_data_element;
      }
    `);
    expect(table.errors).toHaveLength(0);

    const role = parse(`
      define role Z_Role {
        grant select on I_Source where Active = 'X';
      }
    `);
    expect(role.errors).toHaveLength(0);
  });
});

describe('real-world join fixture', () => {
  const fixture = readFileSync(
    new URL('../fixtures/view-entity-joins.ddls.acds', import.meta.url),
    'utf8',
  );

  it('parses the join chain of a cube view', () => {
    const v = getView(fixture);

    expect(v.source.name).toBe('I_SampleItem');
    expect(v.source.alias).toBe('_Item');
    expect(v.joins).toHaveLength(6);
    expect(v.joins.map((j) => j.joinType)).toEqual([
      'leftOuter',
      'leftOuter',
      'leftOuter',
      'leftOuter',
      'leftOuter',
      'inner',
    ]);
  });

  it('keeps the parameter bindings of the joined source', () => {
    const v = getView(fixture);
    const docList = v.joins.find((j) => j.source.name === 'ZTEST_DocumentView');

    expect(docList?.source.alias).toBe('_DocumentList');
    expect(docList?.source.parameters).toEqual([
      { name: 'mandt', value: '$session.client' },
      { name: 'p_startdate', value: '$parameters.P_StartDate' },
      { name: 'p_enddate', value: '$parameters.P_EndDate' },
    ]);
  });

  it('keeps the FROM associations of the cube view', () => {
    const v = getView(fixture);

    expect(v.fromAssociations?.map((a) => a.alias)).toEqual([
      '_LastRelease',
      '_Product',
      '_CompanyCode',
    ]);
  });
});
