/**
 * Join and parameterized data source grammar coverage.
 *
 *   [INNER] JOIN      <source> ON <expression>   -- ON is mandatory
 *   LEFT OUTER JOIN   <source> ON <expression>   -- ON is mandatory
 *   RIGHT OUTER JOIN  <source> ON <expression>   -- ON is mandatory
 *   CROSS JOIN        <source>                    -- ON is not allowed
 *
 *   <source> := <name> [ ( <param> : <value> , ... ) ] [ AS <alias> ]
 *
 * The different spellings are normalized into a single `JoinType`:
 *
 *   JOIN / INNER JOIN        → inner
 *   LEFT OUTER JOIN          → leftOuter
 *   RIGHT OUTER JOIN         → rightOuter
 *   CROSS JOIN               → cross
 *
 * ## `OUTER` spelling
 *
 * The documented ABAP CDS **view entity** syntax is `[INNER] JOIN`,
 * `LEFT OUTER JOIN`, `RIGHT OUTER JOIN`, `CROSS JOIN` — `LEFT JOIN` /
 * `RIGHT JOIN` without `OUTER` are therefore rejected for view entities.
 *
 * The legacy `DEFINE VIEW` (classic SQL view) syntax could not be verified
 * against the ABAP keyword documentation, so `LEFT JOIN` / `RIGHT JOIN` stay
 * **accepted** there for compatibility. This decision is *unverified* — see
 * `CdsParser.isViewEntity`.
 *
 * `FULL OUTER JOIN` is not part of the ABAP CDS DDL join syntax and is
 * rejected.
 *
 * ## Condition coverage (`ON` / `WHERE`)
 *
 * The condition is captured opaquely as `Expression { source, tokens }`.
 */
import type { GrammarCoverage } from './index';

export const joinsCoverage: GrammarCoverage = {
  topic: 'joins',
  constructs: [
    // --- supported and tested ---
    'JOIN <source> ON <condition> (inner)',
    'INNER JOIN <source> ON <condition> (inner)',
    'LEFT OUTER JOIN <source> ON <condition> (leftOuter)',
    'RIGHT OUTER JOIN <source> ON <condition> (rightOuter)',
    'CROSS JOIN <source> (cross, no ON condition)',
    'chained joins (multiple joins in one FROM clause)',
    'join source alias',
    'parameterized data source (<param> : <value>)',
    'parameter binding to a view parameter (:P_Param)',
    'parameter binding to a system variable ($session.client, $parameters.P_X)',
    'parameter binding to a literal',
    'ON condition with AND / OR predicates',
    'ON condition with parentheses and nested call arguments',
    'ON condition with `is null` / `is not initial` predicates',
    'ON condition with a system variable ($projection.Field)',

    // --- known limitations (rejected by the parser) ---
    'FULL OUTER JOIN — not part of the ABAP CDS DDL join syntax',
    'LEFT JOIN / RIGHT JOIN without OUTER in a view entity',
    'CROSS JOIN with an ON condition',
    'INNER / LEFT OUTER / RIGHT OUTER JOIN without an ON condition',
    'NOT in an ON predicate',
    'LIKE in an ON predicate',
    'arithmetic operand in an ON predicate (B.k + 1)',

    // --- not yet verified ---
    'BETWEEN in an ON predicate',
    'IN in an ON predicate',
    'LEFT JOIN / RIGHT JOIN in a legacy DEFINE VIEW (accepted for compatibility, rule unverified)',
  ],
};
