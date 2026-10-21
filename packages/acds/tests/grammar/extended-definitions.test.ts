/// <reference types="vitest/globals" />
// Vitest globals are enabled for this package (see vitest.config.ts).
import { parse } from '../../src/index';
import type {
  AspectDefinition,
  ExtensionDefinition,
  ExternalEntityDefinition,
  HierarchyDefinition,
  RoleDefinition,
  ScalarFunctionDefinition,
  TableDefinition,
  TableFunctionDefinition,
  ViewEntityDefinition,
} from '../../src/ast';

function first(src: string) {
  const r = parse(src);
  expect(r.errors).toHaveLength(0);
  return r.ast.definitions[0];
}

describe('extended DDL definitions', () => {
  it('parses define root view entity', () => {
    const v = first(`
      define root view entity R as select from A { key A.f }
    `) as ViewEntityDefinition;
    expect(v.kind).toBe('viewEntity');
    expect(v.root).toBe(true);
  });

  it('parses a projection view with provider contract', () => {
    const v = first(`
      define root view entity R
        provider contract transactional_query
        as projection on S { key f }
    `) as ViewEntityDefinition;
    expect(v.kind).toBe('viewEntity');
    expect(v.sourceKind).toBe('projection');
    expect(v.providerContract).toBe('transactional_query');
  });

  it('parses select distinct + where/group by/having', () => {
    const v = first(`
      define view entity V as select distinct from A {
        key A.f, A.g
      } where A.f <> 0 group by A.f, A.g having sum(A.h) > 5
    `) as ViewEntityDefinition;
    expect(v.distinct).toBe(true);
    expect(v.where?.source).toContain('A.f');
    expect(v.groupBy).toEqual(['A.f', 'A.g']);
    expect(v.having?.source).toContain('sum');
  });

  it('parses union / intersect / except set operations', () => {
    const expected = {
      union: 'union',
      'union all': 'unionAll',
      intersect: 'intersect',
      except: 'except',
    } as const;
    for (const [sql, operator] of Object.entries(expected)) {
      const v = first(`
        define view entity V as select from A { key A.f }
        ${sql} select from B { key B.f }
      `) as ViewEntityDefinition;
      expect(v.setOperations).toHaveLength(1);
      expect(v.setOperations?.[0].operator).toBe(operator);
    }
  });

  it('parses a table entity', () => {
    const t = first(`
      define root table entity T {
        key id : abap.char(10);
        name : abap.char(30);
      }
    `) as TableDefinition;
    expect(t.kind).toBe('table');
    expect(t.entity).toBe(true);
    expect(t.root).toBe(true);
  });

  it('parses a table function', () => {
    const f = first(`
      define table function F
        with parameters p : abap.char(1)
        returns { client : abap.clnt; f1 : abap.char(10); }
        implemented by method cl_amdp=>m;
    `) as TableFunctionDefinition;
    expect(f.kind).toBe('tableFunction');
    expect(f.implementingClass).toBe('cl_amdp');
    expect(f.implementingMethod).toBe('m');
    expect(f.members).toHaveLength(2);
  });

  it('parses a scalar function', () => {
    const f = first(`
      define scalar function S
        with parameters a : abap.int4
        returns abap.int4;
    `) as ScalarFunctionDefinition;
    expect(f.kind).toBe('scalarFunction');
    expect(f.returnType.name).toBe('int4');
  });

  it('parses an aspect', () => {
    const a = first(`
      define aspect Aspe {
        key id : abap.char(10);
        flag : abap.char(1);
      }
    `) as AspectDefinition;
    expect(a.kind).toBe('aspect');
    expect(a.members).toHaveLength(2);
    expect(a.members[0].isKey).toBe(true);
  });

  it('parses a writable external entity', () => {
    const e = first(`
      define writable external entity E external name ext_obj {
        key id : abap.char(10);
      } with federated data provided at runtime;
    `) as ExternalEntityDefinition;
    expect(e.kind).toBe('externalEntity');
    expect(e.writable).toBe(true);
    expect(e.externalName).toBe('ext_obj');
  });

  it('parses a hierarchy', () => {
    const h = first(`
      define hierarchy H as parent child hierarchy(
        source E
        child to parent association _rel
        siblings order by o ascending
        multiple parents not allowed
        orphans ignore
        cycles error
      ) { key id }
    `) as HierarchyDefinition;
    expect(h.kind).toBe('hierarchy');
    expect(h.source).toBe('E');
    expect(h.childToParentAssociation).toBe('_rel');
    expect(h.multipleParents).toBe('notAllowed');
    expect(h.orphans).toBe('ignore');
    expect(h.cycles).toBe('error');
    expect(h.siblingsOrderBy).toEqual([{ name: 'o', direction: 'ascending' }]);
  });

  it('parses extend view entity with association', () => {
    const x = first(`
      extend view entity V with association to X as _x { _x.f as xf }
    `) as ExtensionDefinition;
    expect(x.kind).toBe('extension');
    expect(x.targetKind).toBe('view');
    expect(x.isViewEntity).toBe(true);
    expect(x.associations).toHaveLength(1);
  });

  it('parses a DCL role with inherit + optional elements', () => {
    const r = first(`
      define role R switchable {
        grant select on E
          with optional elements (a default true, b)
          combination mode or
          where aspect asp.cond;
        inherit BaseRole for grant select on E where f = 1;
        inheriting conditions from entity E default true;
      }
    `) as RoleDefinition;
    expect(r.kind).toBe('role');
    expect(r.switchable).toBe(true);
    expect(r.grants).toHaveLength(1);
    expect(r.members).toHaveLength(3);
  });

  it('parses a bind aspect data source', () => {
    const v = first(`
      define view entity V as select from A
        bind aspect Aspe (el => $projection.f) { key A.f }
    `) as ViewEntityDefinition;
    expect(v.aspectBindings).toHaveLength(1);
    expect(v.aspectBindings?.[0].aspect).toBe('Aspe');
  });

  it('parses define annotation (DDLA) with opaque body', () => {
    const d = first(`define annotation Demo { scope: #ENTITY; }`);
    expect(d.kind).toBe('annotationDefinition');
    expect(d.name).toBe('Demo');
  });

  it('parses define accesspolicy with opaque body', () => {
    const d = first(`define accesspolicy AP { aspect pfcg_auth (x = '1'); }`);
    expect(d.kind).toBe('accessPolicy');
    expect(d.name).toBe('AP');
  });

  it('parses case expressions in the element list', () => {
    const v = first(`
      define view entity V as select from A {
        case A.f when 'a' then 1 else 0 end as n,
        case when A.f > 1 then 'x' else 'y' end as s
      }
    `) as ViewEntityDefinition;
    expect(v.members).toHaveLength(2);
  });

  it('parses localized and redirected projection elements', () => {
    const v = first(`
      define view entity P as projection on S {
        key f : localized,
        _assoc : redirected to X,
        _comp : redirected to composition child Y
      }
    `) as ViewEntityDefinition;
    const m = v.members as any[];
    expect(m[0].localized).toBe(true);
    expect(m[1].redirectedTo.target).toBe('X');
    expect(m[2].redirectedTo.mode).toBe('compositionChild');
  });
});
