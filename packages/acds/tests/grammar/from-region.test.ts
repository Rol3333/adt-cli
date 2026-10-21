/// <reference types="vitest/globals" />
// Vitest globals are enabled for this package (see vitest.config.ts).
import { parse } from '../../src/index';
import type {
  AssociationDeclaration,
  JoinClause,
  ViewEntityDefinition,
  ViewElement,
} from '../../src/ast';

function getView(src: string): ViewEntityDefinition {
  const r = parse(src);
  expect(r.errors).toHaveLength(0);
  return r.ast.definitions[0] as ViewEntityDefinition;
}

function getViewWithErrors(src: string): {
  view: ViewEntityDefinition;
  errors: number;
} {
  const r = parse(src);
  return {
    view: r.ast.definitions[0] as ViewEntityDefinition,
    errors: r.errors.length,
  };
}

describe('FROM region — alias and keyword handling', () => {
  it('parses an association without a source alias', () => {
    const v = getView(`
      define view entity V
        as select from A
          association [0..1] to B as _B
            on A.ID = _B.ID
      {
        A.ID
      }
    `);

    // The source must not get an invented alias.
    expect(v.source.alias).toBeUndefined();
    expect(v.fromAssociations).toHaveLength(1);
    const a = v.fromAssociations?.[0] as AssociationDeclaration;
    expect(a.target).toBe('B');
    expect(a.alias).toBe('_B');
    expect(a.cardinality).toEqual({ min: 0, max: 1 });
  });

  it('parses a composition without a source alias', () => {
    const v = getView(`
      define view entity V
        as select from A
          composition [0..1] of B as _B
            on A.ID = _B.ID
      {
        A.ID
      }
    `);

    expect(v.source.alias).toBeUndefined();
    expect(v.fromAssociations).toHaveLength(1);
    expect(v.fromAssociations?.[0].associationKind).toBe('composition');
    expect(v.fromAssociations?.[0].target).toBe('B');
  });

  it('parses an association with an explicit source alias', () => {
    const v = getView(`
      define view entity V
        as select from A as _A
          association [0..1] to B as _B
            on _A.ID = _B.ID
      {
        _A.ID
      }
    `);

    expect(v.source.alias).toBe('_A');
    expect(v.fromAssociations).toHaveLength(1);
    expect(v.fromAssociations?.[0].alias).toBe('_B');
  });

  it('parses a composition with an explicit source alias', () => {
    const v = getView(`
      define view entity V
        as select from A as _A
          composition [0..1] of B as _B
            on _A.ID = _B.ID
      {
        _A.ID
      }
    `);

    expect(v.source.alias).toBe('_A');
    expect(v.fromAssociations?.[0].associationKind).toBe('composition');
  });

  it('parses a join followed by an association', () => {
    const v = getView(`
      define view entity V
        as select from A
          join B on A.ID = B.ID
          association [0..1] to C as _C
            on A.ID = _C.ID
      {
        A.ID
      }
    `);

    expect(v.joins).toHaveLength(1);
    expect(v.fromAssociations).toHaveLength(1);
    expect(v.fromAssociations?.[0].target).toBe('C');
  });

  it('parses a source without alias and without association', () => {
    const v = getView(`
      define view entity V as select from A
      {
        A.ID
      }
    `);

    expect(v.source.alias).toBeUndefined();
    expect(v.joins).toEqual([]);
    expect(v.fromAssociations).toBeUndefined();
  });

  it('parses keyword-like field paths', () => {
    const v = getView(`
      define view entity V as select from A
      {
        A.left,
        A.right,
        A.join
      }
    `);

    const expressions = v.members.map((m) => (m as ViewElement).expression);
    expect(expressions).toEqual(['A.left', 'A.right', 'A.join']);
  });

  it('parses explicit aliases that use a join keyword', () => {
    const v = getView(`
      define view entity V as select from A as left
      {
        left.ID
      }
    `);

    expect(v.source.alias).toBe('left');
  });

  it('parses explicit aliases that use inner or cross', () => {
    const inner = getView(`
      define view entity V as select from A as inner
      {
        inner.ID
      }
    `);
    expect(inner.source.alias).toBe('inner');

    const cross = getView(`
      define view entity V as select from A as cross
      {
        cross.ID
      }
    `);
    expect(cross.source.alias).toBe('cross');
  });

  it('parses an ON condition with a keyword-like field name', () => {
    const v = getView(`
      define view entity V as select from A
        join B on A.left = B.right
      {
        A.ID
      }
    `);

    expect(v.joins).toHaveLength(1);
    expect(v.joins[0].on?.tokens).toContain('left');
    expect(v.joins[0].on?.tokens).toContain('right');
  });

  it('still recognizes a join chain', () => {
    const v = getView(`
      define view entity V as select from A
        join B on A.k = B.k
        inner join C on B.k = C.k
        left outer join D on C.k = D.k
        cross join E
      {
        A.k
      }
    `);

    expect(v.joins.map((j: JoinClause) => j.joinType)).toEqual([
      'inner',
      'inner',
      'leftOuter',
      'cross',
    ]);
    expect(v.joins.map((j: JoinClause) => j.source.name)).toEqual([
      'B',
      'C',
      'D',
      'E',
    ]);
  });

  it('parses a keyword-like function call', () => {
    const v = getView(`
      define view entity V as select from A
      {
        left(A.text, 3) as Short
      }
    `);

    const el = v.members[0] as ViewElement;
    expect(el.expression).toBe('left(A.text, 3)');
    expect(el.alias).toBe('Short');
  });

  it('preserves the original spelling of keyword-like identifiers', () => {
    const v = getView(`
      define view entity V as select from A as Left
      {
        A.Left,
        A.Join
      }
    `);

    expect(v.source.alias).toBe('Left');
    const expressions = v.members.map((m) => (m as ViewElement).expression);
    expect(expressions).toEqual(['A.Left', 'A.Join']);
  });

  it('does not use a FROM-region starter as a bare alias', () => {
    // `left` starts the next FROM item — it must not be read as an alias.
    const { view, errors } = getViewWithErrors(`
      define view entity V as select from A
        left outer join B on A.ID = B.ID
      {
        A.ID
      }
    `);

    expect(errors).toBe(0);
    expect(view.source.alias).toBeUndefined();
    expect(view.joins).toHaveLength(1);
  });
});
