/// <reference types="vitest/globals" />
// Vitest globals are enabled for this package (see vitest.config.ts).
import { parse, serializeExpr } from '../../src/index';
import type {
  BinaryExpr,
  Expr,
  InExpr,
  IsInitialExpr,
  IsNullExpr,
  NotExpr,
  ViewEntityDefinition,
} from '../../src/ast';

function getView(src: string): ViewEntityDefinition {
  const r = parse(src);
  expect(r.errors).toHaveLength(0);
  return r.ast.definitions[0] as ViewEntityDefinition;
}

/** The `ON` condition of the first join. */
function on(src: string): Expr {
  const view = getView(src);
  return view.joins[0].on!;
}

function viewWith(src: string): ViewEntityDefinition {
  return getView(src);
}

describe('expressions', () => {
  it('parses a single equality into a binary expression', () => {
    const expr = on(`
      define view entity V as select from A
        join B on A.k = B.k
      { A.k }
    `) as BinaryExpr;

    expect(expr.kind).toBe('binary');
    expect(expr.op).toBe('eq');
    expect(expr.left).toEqual({ kind: 'fieldRef', path: ['A', 'k'] });
    expect(expr.right).toEqual({ kind: 'fieldRef', path: ['B', 'k'] });
  });

  it('folds an AND chain from the left', () => {
    const expr = on(`
      define view entity V as select from A
        join B on A.k = B.k and A.l = B.l
      { A.k }
    `) as BinaryExpr;

    expect(expr.op).toBe('and');
    expect(expr.left).toMatchObject({ kind: 'binary', op: 'eq' });
    expect(expr.right).toMatchObject({ kind: 'binary', op: 'eq' });
  });

  it('gives AND a higher precedence than OR', () => {
    const expr = on(`
      define view entity V as select from A
        join B on A.k = 1 or A.l = 2 and A.m = 3
      { A.k }
    `) as BinaryExpr;

    expect(expr.op).toBe('or');
    expect(expr.left).toMatchObject({ kind: 'binary', op: 'eq' });
    expect(expr.right).toMatchObject({ kind: 'binary', op: 'and' });
  });

  it('keeps a grouped condition in its own branch', () => {
    const expr = on(`
      define view entity V as select from A
        join B on (A.k = 1 or A.l = 2) and A.m = 3
      { A.k }
    `) as BinaryExpr;

    expect(expr.op).toBe('and');
    expect(expr.left).toMatchObject({ kind: 'binary', op: 'or' });
    expect(expr.right).toMatchObject({ kind: 'binary', op: 'eq' });
  });

  it('parses a string literal', () => {
    const expr = on(`
      define view entity V as select from A
        join B on A.k = '0001'
      { A.k }
    `) as BinaryExpr;

    expect(expr.right).toEqual({
      kind: 'literal',
      literal: 'string',
      value: '0001',
    });
  });

  it('parses a numeric comparison', () => {
    const expr = on(`
      define view entity V as select from A
        join B on A.k >= 42
      { A.k }
    `) as BinaryExpr;

    expect(expr.op).toBe('ge');
    expect(expr.right).toEqual({
      kind: 'literal',
      literal: 'number',
      value: 42,
    });
  });

  it('parses a NOT predicate', () => {
    const expr = on(`
      define view entity V as select from A
        join B on not A.k = B.k
      { A.k }
    `) as NotExpr;

    expect(expr.kind).toBe('not');
    expect(expr.operand).toMatchObject({ kind: 'binary', op: 'eq' });
  });

  it('parses a LIKE comparison', () => {
    const expr = on(`
      define view entity V as select from A
        join B on A.k like 'X%'
      { A.k }
    `) as BinaryExpr;

    expect(expr.op).toBe('like');
  });

  it('parses an arithmetic expression', () => {
    const expr = on(`
      define view entity V as select from A
        join B on B.k + 1 = A.k
      { A.k }
    `) as BinaryExpr;

    expect(expr.op).toBe('eq');
    expect(expr.left).toMatchObject({ kind: 'binary', op: 'add' });
  });

  it('parses an `is null` predicate', () => {
    const expr = on(`
      define view entity V as select from A
        join B on A.k is null
      { A.k }
    `) as IsNullExpr;

    expect(expr.kind).toBe('isNull');
    expect(expr.negated).toBe(false);
  });

  it('parses an `is not null` predicate', () => {
    const expr = on(`
      define view entity V as select from A
        join B on A.k is not null
      { A.k }
    `) as IsNullExpr;

    expect(expr.negated).toBe(true);
  });

  it('parses an `is not initial` predicate', () => {
    const expr = on(`
      define view entity V as select from A
        join B on A.k is not initial
      { A.k }
    `) as IsInitialExpr;

    expect(expr.kind).toBe('isInitial');
    expect(expr.negated).toBe(true);
  });

  it('parses an IN predicate with a value list', () => {
    const expr = on(`
      define view entity V as select from A
        join B on A.k in ('A', 'B')
      { A.k }
    `) as InExpr;

    expect(expr.kind).toBe('in');
    expect(expr.negated).toBeUndefined();
    expect(expr.values).toEqual([
      { kind: 'literal', literal: 'string', value: 'A' },
      { kind: 'literal', literal: 'string', value: 'B' },
    ]);
  });

  it('parses a NOT IN predicate', () => {
    const expr = on(`
      define view entity V as select from A
        join B on A.k not in ('A', 'B')
      { A.k }
    `) as InExpr;

    expect(expr.negated).toBe(true);
  });

  it('parses a $projection reference as its own kind', () => {
    const expr = on(`
      define view entity V as select from A
        join B on $projection.PurchaseRequisition = B.PurchaseRequisition
      { A.k }
    `) as BinaryExpr;

    expect(expr.left).toEqual({
      kind: 'projectionRef',
      name: 'PurchaseRequisition',
    });
    expect(expr.right).toEqual({
      kind: 'fieldRef',
      path: ['B', 'PurchaseRequisition'],
    });
  });

  it('parses a $parameters reference as its own kind', () => {
    const expr = on(`
      define view entity V as select from A
        join B on A.k = $parameters.P_Key
      { A.k }
    `) as BinaryExpr;

    expect(expr.right).toEqual({ kind: 'paramRef', name: 'P_Key' });
  });

  it('parses a $session reference as its own kind', () => {
    const expr = on(`
      define view entity V as select from A
        join B on A.k = $session.client
      { A.k }
    `) as BinaryExpr;

    expect(expr.right).toEqual({ kind: 'sessionVar', name: 'client' });
  });

  it('parses a function call', () => {
    const expr = on(`
      define view entity V as select from A
        join B on A.k = coalesce(B.k, B.l)
      { A.k }
    `) as BinaryExpr;

    expect(expr.right).toEqual({
      kind: 'call',
      name: 'coalesce',
      args: [
        { kind: 'fieldRef', path: ['B', 'k'] },
        { kind: 'fieldRef', path: ['B', 'l'] },
      ],
    });
  });

  it('parses keyword-like field names', () => {
    const expr = on(`
      define view entity V as select from A
        join B on A.Note = B.Invoice
      { A.k }
    `) as BinaryExpr;

    expect(expr.left).toEqual({ kind: 'fieldRef', path: ['A', 'Note'] });
    expect(expr.right).toEqual({ kind: 'fieldRef', path: ['B', 'Invoice'] });
  });

  it('keeps the raw binding text of a parameterized source', () => {
    const view = viewWith(`
      define view entity V as select from A
        join B( mandt : $session.client ) as _B on A.k = _B.k
      { A.k }
    `);

    expect(view.joins[0].source.parameters).toEqual([
      { name: 'mandt', value: '$session.client' },
    ]);
  });

  it('serializes the condition in its canonical form', () => {
    const view = viewWith(`
      define view entity V as select from A
        join B on A.k = B.k and (A.l = B.l or A.m = B.m)
      { A.k }
    `);

    expect(serializeExpr(view.joins[0].on!)).toBe(
      'A.k = B.k and (A.l = B.l or A.m = B.m)',
    );
  });

  it('serializes a NOT IN predicate', () => {
    const view = viewWith(`
      define view entity V as select from A
        join B on A.k not in ('A', 'B')
      { A.k }
    `);

    expect(serializeExpr(view.joins[0].on!)).toBe("A.k not in ('A', 'B')");
  });

  it('serializes an arithmetic expression', () => {
    const view = viewWith(`
      define view entity V as select from A
        join B on B.k + 1 = A.k
      { A.k }
    `);

    expect(serializeExpr(view.joins[0].on!)).toBe('B.k + 1 = A.k');
  });
});
