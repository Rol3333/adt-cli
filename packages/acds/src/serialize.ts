/**
 * Canonical serialization of `on` / `where` conditions.
 *
 * The canonical form is the single test oracle for conditions: the AST is
 * structural, the serializer produces the one normalized text representation
 * that tests and downstream tools compare against.
 *
 * ## Canonical form
 *
 * - one space around binary operators (`A.k = B.k`),
 * - keywords in lower case (`and`, `or`, `not`, `is null`, `in`),
 * - no space around the path separator (`A.k`, not `A . k`),
 * - call arguments separated by `, ` (`coalesce(a, b)`),
 * - parentheses only where the precedence requires them — a grouped condition
 *   is re-parenthesized when it is nested in a tighter operator.
 */
import type { BinaryOp, Expr, LiteralExpr } from './ast';

/** The text of the binary operators. */
const OPERATOR_TEXT: Record<BinaryOp, string> = {
  eq: '=',
  ne: '!=',
  lt: '<',
  le: '<=',
  gt: '>',
  ge: '>=',
  and: 'and',
  or: 'or',
  like: 'like',
  add: '+',
  sub: '-',
  mul: '*',
  div: '/',
};

/**
 * The binding power of an expression — the higher the number, the tighter
 * the binding. It decides whether a child needs parentheses.
 */
function precedence(expr: Expr): number {
  switch (expr.kind) {
    case 'binary':
      if (expr.op === 'or') return 1;
      if (expr.op === 'and') return 2;
      if (expr.op === 'add' || expr.op === 'sub') return 5;
      if (expr.op === 'mul' || expr.op === 'div') return 6;
      return 4;
    case 'not':
      return 3;
    case 'in':
    case 'isNull':
    case 'isInitial':
      return 4;
    default:
      return 7;
  }
}

/**
 * Serialize an expression to its canonical text form.
 *
 * @param expr - the expression to serialize
 * @returns the canonical text (e.g. `A.k = B.k`)
 */
export function serializeExpr(expr: Expr): string {
  return render(expr, 0, false);
}

/**
 * Serialize a child expression.
 *
 * @param expr - the child to serialize
 * @param parentPrecedence - the binding power of the parent
 * @param rightOperand - `true` for the right operand of a left-associative
 *   operator (`a - (b - c)` needs the parentheses, `a - b - c` does not)
 */
function render(
  expr: Expr,
  parentPrecedence: number,
  rightOperand: boolean,
): string {
  const own = precedence(expr);
  const needsParentheses =
    own < parentPrecedence || (rightOperand && own === parentPrecedence);
  const text = textOf(expr);
  return needsParentheses ? `(${text})` : text;
}

/** The canonical text of an expression without any parentheses. */
function textOf(expr: Expr): string {
  switch (expr.kind) {
    case 'fieldRef':
      return expr.path.join('.');

    case 'projectionRef':
      return `$projection.${expr.name}`;

    case 'paramRef':
      return `$parameters.${expr.name}`;

    case 'sessionVar':
      return `$session.${expr.name}`;

    case 'literal':
      return literalText(expr);

    case 'binary': {
      const own = precedence(expr);
      const left = render(expr.left, own, false);
      const right = render(expr.right, own, true);
      return `${left} ${OPERATOR_TEXT[expr.op]} ${right}`;
    }

    case 'not': {
      const own = precedence(expr);
      return `not ${render(expr.operand, own, true)}`;
    }

    case 'isNull': {
      const own = precedence(expr);
      const operand = render(expr.operand, own, false);
      return `${operand} is ${expr.negated ? 'not null' : 'null'}`;
    }

    case 'isInitial': {
      const own = precedence(expr);
      const operand = render(expr.operand, own, false);
      return `${operand} is ${expr.negated ? 'not initial' : 'initial'}`;
    }

    case 'in': {
      const own = precedence(expr);
      const operand = render(expr.operand, own, false);
      const values = expr.values
        .map((value) => render(value, 0, false))
        .join(', ');
      return `${operand} ${expr.negated ? 'not in' : 'in'} (${values})`;
    }

    case 'call': {
      const args = expr.args.map((arg) => render(arg, 0, false)).join(', ');
      return `${expr.name}(${args})`;
    }

    case 'cast': {
      const value = render(expr.expression, 0, false);
      const preserving = expr.preservingType ? ' preserving type' : '';
      return `cast(${value} as ${expr.targetType}${preserving})`;
    }
  }
}

/** The canonical text of a literal. */
function literalText(expr: LiteralExpr): string {
  switch (expr.literal) {
    case 'string':
      return `'${String(expr.value ?? '').replace(/'/g, "''")}'`;
    case 'number':
      return String(expr.value ?? 0);
    case 'boolean':
      return expr.value ? 'true' : 'false';
    case 'null':
      return 'null';
  }
}
