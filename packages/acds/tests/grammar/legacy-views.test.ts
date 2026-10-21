/// <reference types="vitest/globals" />
// Vitest globals are enabled for this package (see vitest.config.ts).
import { readFileSync } from 'node:fs';
import { parse, serializeExpr } from '../../src/index';
import type { ViewEntityDefinition, ViewElement } from '../../src/ast';

function getView(src: string): ViewEntityDefinition {
  const r = parse(src);
  expect(r.errors).toHaveLength(0);
  return r.ast.definitions[0] as ViewEntityDefinition;
}

describe('legacy views and projection expressions', () => {
  it('parses the legacy `define view <name>` syntax', () => {
    const v = getView(`
      define view ZC_Legacy as select from A
      {
        key A.k
      }
    `);

    expect(v.kind).toBe('viewEntity');
    expect(v.name).toBe('ZC_Legacy');
    expect(v.legacy).toBe(true);
    expect(v.source.name).toBe('A');
  });

  it('marks `define view entity <name>` as a view entity', () => {
    const v = getView(`
      define view entity ZC_Entity as select from A
      {
        key A.k
      }
    `);

    expect(v.legacy).toBeUndefined();
  });

  it('parses a legacy view with parameters and a parameterized source', () => {
    const v = getView(`
      define view ZC_Legacy
        with parameters
          P_StartDate : vdm_v_key_date
      as select from ZTEST_SampleCube ( P_StartDate : :P_StartDate ) as _Cube
      {
        key _Cube.k
      }
    `);

    expect(v.legacy).toBe(true);
    expect(v.parameters.map((p) => p.name)).toEqual(['P_StartDate']);
    expect(v.source.parameters).toEqual([
      { name: 'P_StartDate', value: ':P_StartDate' },
    ]);
  });

  it('skips SQL line comments', () => {
    const v = getView(`
      define view ZC_Legacy as select from A
      {
        key A.k,
        -- a SQL comment in the projection list
        A.x
      }
    `);

    expect(v.members).toHaveLength(2);
  });

  it('parses a cast(...) projection element', () => {
    const v = getView(`
      define view ZC_Legacy as select from A
      {
        cast(0 as abap.curr( 15,  2 )) as ItemInvAmtDiff
      }
    `);

    const el = v.members[0] as ViewElement;
    expect(el.expression).toBe('cast(0 as abap.curr(15, 2))');
    expect(el.alias).toBe('ItemInvAmtDiff');
  });

  it('parses a cast(...) with preserving type', () => {
    const v = getView(`
      define view ZC_Legacy as select from A
      {
        cast(PurRecApproveDate as frgdt preserving type ) as PurRecApproveDate
      }
    `);

    const el = v.members[0] as ViewElement;
    expect(el.expression).toBe(
      'cast(PurRecApproveDate as frgdt preserving type)',
    );
    expect(el.alias).toBe('PurRecApproveDate');
  });

  it('parses a function call in a projection element', () => {
    const v = getView(`
      define view ZC_Legacy as select from A
      {
        coalesce(InvAmount, 0) as InvAmountSafe
      }
    `);

    const el = v.members[0] as ViewElement;
    expect(el.expression).toBe('coalesce(InvAmount, 0)');
    expect(el.alias).toBe('InvAmountSafe');
  });

  it('parses an aggregate call in a projection element', () => {
    const v = getView(`
      define view ZC_Legacy as select from A
      {
        cast(sum(InvItemAmount) as wrbtr_cs) as InvItemAmount
      }
    `);

    const el = v.members[0] as ViewElement;
    expect(el.expression).toBe('cast(sum(InvItemAmount) as wrbtr_cs)');
    expect(el.alias).toBe('InvItemAmount');
  });

  it('parses `left(...)` / `right(...)` string functions', () => {
    const v = getView(`
      define view ZC_Legacy as select from A
      {
        cast( left(_Item.ChangeDocTableKey, 3) as mandt ) as Client,
        cast( right(_Item.ChangeDocObject, 10) as vdm_purchaserequisition preserving type ) as PurchaseRequisition
      }
    `);

    const first = v.members[0] as ViewElement;
    expect(first.expression).toBe(
      'cast(left(_Item.ChangeDocTableKey, 3) as mandt)',
    );
    expect(first.alias).toBe('Client');

    const second = v.members[1] as ViewElement;
    expect(second.expression).toBe(
      'cast(right(_Item.ChangeDocObject, 10) as vdm_purchaserequisition preserving type)',
    );
  });

  it('parses `is null` and `is not initial` predicates', () => {
    const v = getView(`
      define view ZC_Legacy as select from A
      {
        key A.k
      }
      where A.x is null
      and A.y is not initial
      and A.z is not null
    `);

    expect(v.where).toBeDefined();
    expect(serializeExpr(v.where!)).toBe(
      'A.x is null and A.y is not initial and A.z is not null',
    );
  });

  it('parses the legacy view fixture', () => {
    const fixture = readFileSync(
      new URL('../fixtures/legacy-view.ddls.acds', import.meta.url),
      'utf8',
    );
    const v = getView(fixture);

    expect(v.name).toBe('ZTEST_SampleQuery');
    expect(v.legacy).toBe(true);
    expect(v.parameters).toHaveLength(2);
    expect(v.source.name).toBe('ZTEST_SampleCube');
    expect(v.source.parameters).toHaveLength(2);
    expect(v.members).toHaveLength(6);
  });
});
