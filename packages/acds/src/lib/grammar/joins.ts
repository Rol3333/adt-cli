/**
 * Join and parameterized data source grammar coverage.
 *
 *   [INNER] JOIN       <source> ON <expression>   -- ON is mandatory
 *   LEFT [OUTER] JOIN  <source> ON <expression>   -- ON is mandatory
 *   RIGHT [OUTER] JOIN <source> ON <expression>   -- ON is mandatory
 *   FULL [OUTER] JOIN  <source> ON <expression>   -- ON is mandatory
 *   CROSS JOIN         <source>                    -- ON is not allowed
 *
 *   <source> := <name> [ ( <param> : <value> , ... ) ] [ AS <alias> ]
 *
 * The different spellings are normalized into a single `JoinType`:
 *
 *   JOIN / INNER JOIN        → inner
 *   LEFT [OUTER] JOIN        → leftOuter
 *   RIGHT [OUTER] JOIN       → rightOuter
 *   FULL [OUTER] JOIN        → fullOuter
 *   CROSS JOIN               → cross
 *
 * ## `OUTER` spelling
 *
 * The `OUTER` keyword is optional for the outer join types, and the accepted
 * spellings do **not** depend on the view flavour: a CDS view entity
 * (`define view entity`) and a classic SQL view (`define view`) accept the
 * same join syntax. The parser therefore keeps no state about the view
 * flavour.
 *
 * `FULL [OUTER] JOIN` is the SQL-standard full outer join. It is not part of
 * the ABAP CDS DDL join syntax, but it is supported so that HANA CDS / CAP
 * CDS sources — which use the standard SQL join syntax — can be read with the
 * same grammar.
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
    'LEFT JOIN <source> ON <condition> (leftOuter)',
    'LEFT OUTER JOIN <source> ON <condition> (leftOuter)',
    'RIGHT JOIN <source> ON <condition> (rightOuter)',
    'RIGHT OUTER JOIN <source> ON <condition> (rightOuter)',
    'FULL JOIN <source> ON <condition> (fullOuter)',
    'FULL OUTER JOIN <source> ON <condition> (fullOuter)',
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
    'CROSS JOIN with an ON condition',
    'INNER / LEFT / RIGHT / FULL JOIN without an ON condition',
    'NOT in an ON predicate',
    'LIKE in an ON predicate',
    'arithmetic operand in an ON predicate (B.k + 1)',

    // --- not yet verified ---
    'BETWEEN in an ON predicate',
    'IN in an ON predicate',
  ],
};
