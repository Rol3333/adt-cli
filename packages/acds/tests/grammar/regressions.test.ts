/// <reference types="vitest/globals" />
// Vitest globals are enabled for this package (see vitest.config.ts).
import { parse } from '../../src/index';
import { validate } from '../../src/lib/validate';
import type {
  AssociationDeclaration,
  TableDefinition,
  ViewEntityDefinition,
} from '../../src/ast';

describe('review-finding regressions', () => {
  it('does not hang on a truncated aspect type (EOF stops the scan)', () => {
    // `abap.char(10` never closes — the typed-value lookahead must stop at
    // EOF instead of looping forever on the same token.
    const r = parse('define aspect A { x : abap.char(10');
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('does not mark a writable non-root table entity as root', () => {
    const r = parse(`
      define writable table entity T {
        key id : abap.char(10);
      }
    `);
    expect(r.errors).toHaveLength(0);
    const t = r.ast.definitions[0] as TableDefinition;
    expect(t.writable).toBe(true);
    expect(t.root).toBeUndefined();
  });

  it('keeps a filter-only association out of `on`', () => {
    const r = parse(`
      define view entity V as select from t {
        key id as Id,
        association[0..*] to T2 as _t2 with default filter t.id > 0
      }
    `);
    expect(r.errors).toHaveLength(0);
    const v = r.ast.definitions[0] as ViewEntityDefinition;
    const a = v.members[1] as AssociationDeclaration;
    expect(a.on).toBeUndefined();
    expect(a.withDefaultFilter?.source).toContain('>');
  });

  it('validates cardinalities on FROM-region associations', () => {
    const r = parse(`
      define view entity V as select from t
        association[5..2] to T2 as _t2 { key t.id }
    `);
    expect(r.errors).toHaveLength(0);
    const diags = validate(r.ast);
    expect(diags.some((d) => d.code === 'ACDS003')).toBe(true);
  });

  it('accepts keyword-spelled identifiers like `A.on`', () => {
    const r = parse(`
      define view entity V as select from A {
        key A.on as OnField
      }
    `);
    expect(r.errors).toHaveLength(0);
    const v = r.ast.definitions[0] as ViewEntityDefinition;
    expect(v.members).toHaveLength(1);
  });
});
