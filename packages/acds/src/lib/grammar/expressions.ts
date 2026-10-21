/**
 * Expression grammar coverage.
 *
 * The conditions of `on` / `where` clauses are parsed into a structured
 * `Expr` tree (see `src/ast.ts`). The grammar mirrors the SQL precedence:
 *
 *   orExpression            andExpression ( OR andExpression )*
 *   andExpression           notExpression ( AND notExpression )*
 *   notExpression           [ NOT ] comparisonExpression
 *   comparisonExpression    additiveExpression
 *                           [ <operator> additiveExpression
 *                           | [NOT] IN ( <value list> )
 *                           | IS [NOT] ( NULL | INITIAL ) ]
 *   additiveExpression      multiplicativeExpression ( ( + | - ) … )*
 *   multiplicativeExpression primaryExpression ( ( * | / ) … )*
 *   primaryExpression       ( <expression> ) | <path> | <call> | <system variable>
 *                           | <literal>
 *
 * The canonical text form of a condition is produced by `serializeExpr()`.
 */
import type { GrammarCoverage } from './index';

export const expressionsCoverage: GrammarCoverage = {
  topic: 'expressions',
  constructs: [
    // --- supported and tested ---
    'comparison (=, ==, !=, <>, <, <=, >, >=)',
    'boolean operators (AND, OR) with SQL precedence',
    'NOT predicate',
    'parenthesized sub-condition',
    'field path (_Item.Field, _Item._Assoc.Field)',
    'function call (coalesce(a, b), sum(x))',
    'system variable ($projection.X, $parameters.P_X, $session.client)',
    'literal (string, number, boolean)',
    'is null / is not null',
    'is initial / is not initial',
    'in (a, b) / not in (a, b)',
    'like comparison',
    'arithmetic (+, -, *, /)',
    'canonical serialization (serializeExpr)',

    // --- known limitations (rejected by the parser) ---
    'BETWEEN in a condition',
    'CASE … END in a condition',
    'unary minus',
    'cast(…) inside a condition (supported in projection elements only)',
  ],
};
