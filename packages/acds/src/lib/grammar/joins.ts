/**
 * Join and parameterized data source grammar coverage.
 *
 *   [INNER | LEFT [OUTER] | RIGHT [OUTER] | CROSS] JOIN <data source>
 *       [ON <expression>]
 *
 *   <data source> := <name> [ ( <param> : <value> , ... ) ] [ AS <alias> ]
 *
 * The different spellings are normalized into a single `JoinType`:
 *
 *   JOIN / INNER JOIN        → inner
 *   LEFT JOIN / LEFT OUTER   → leftOuter
 *   RIGHT JOIN / RIGHT OUTER → rightOuter
 *   CROSS JOIN               → cross
 *
 * Parameter bindings keep their original text (`:P_Param`, `$session.client`,
 * `$parameters.P_X` or a literal).
 *
 * Not yet implemented:
 *   - `FULL OUTER JOIN` — not part of the ABAP CDS join syntax.
 *   - mandatory `ON` validation for non-cross joins (semantic layer).
 */
import type { GrammarCoverage } from './index';

export const joinsCoverage: GrammarCoverage = {
  topic: 'joins',
  constructs: [
    'JOIN <source> ON <condition>',
    'INNER JOIN <source> ON <condition>',
    'LEFT JOIN <source> ON <condition>',
    'LEFT OUTER JOIN <source> ON <condition>',
    'RIGHT JOIN <source> ON <condition>',
    'RIGHT OUTER JOIN <source> ON <condition>',
    'CROSS JOIN <source>',
    'chained joins (multiple joins in one FROM clause)',
    'join source alias',
    'parameterized data source (<param> : <value>)',
    'parameter binding to a view parameter (:P_Param)',
    'parameter binding to a system variable ($session.client, $parameters.P_X)',
    'ON condition with AND / OR predicates',
    'ON condition with parentheses and nested call arguments',
    'ON condition with `is null` / `is not initial` predicates',
  ],
};
