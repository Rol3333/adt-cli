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
 * - no space around the path separator (`A.k`, not `A . k`),
 * - no space before `(` `)` `,` and no space after `(` (call arguments:
 *   `coalesce(a, b)`),
 * - one space after `,`,
 * - keywords keep the spelling of the source for now (the token based
 *   implementation cannot distinguish `is` from a field name).
 */
import type { Expression } from './ast';

/** Tokens that are never preceded by a space. */
const TIGHT_BEFORE = new Set(['(', ')', ']', ',', '.']);

/** Tokens after which no space is written. */
const TIGHT_AFTER = new Set(['(', '.', '$']);

/**
 * Serialize an expression to its canonical text form.
 *
 * @param expr - the expression to serialize
 * @returns the canonical text (e.g. `A.k = B.k`)
 */
export function serializeExpr(expr: Expression): string {
  let out = '';
  for (const token of expr.tokens) {
    if (!out) {
      out = token;
      continue;
    }
    const tight =
      TIGHT_BEFORE.has(token) || TIGHT_AFTER.has(out.charAt(out.length - 1));
    out += tight ? token : ` ${token}`;
  }
  return out;
}
