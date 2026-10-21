/**
 * Projection / view grammar coverage.
 *
 * View body element (per member):
 *   [annotation*] [key] [virtual] [redirected] (
 *       <name> : <type> [not null]    -- typed field (abstract/custom entities)
 *     | <path> [as <alias>]           -- projection element
 *     | <func>( <arg> , ... ) [as <alias>]   -- incl. empty calls f()
 *     | cast( <value> as <type> [preserving type] ) [as <alias>]
 *     | case <oper> when ... then ... [else ...] end
 *     | case when <cond> then ... [else ...] end
 *     | <operand> <arith-op> <operand> ...   -- + - * / between operands
 *     | <path> : localized                 -- projection-view localized element
 *   ) ;|,
 *
 * Plus any association declarations (see `associations.ts`), projection-view
 * association redirections (`<assoc> : redirected to <target>`), and
 * `redirected to composition child <target>` elements.
 *
 * Window functions: `over (partition by <fields> [order by <sort>])` after
 * a call operand is accepted and preserved verbatim in the expression text.
 */
import type { GrammarCoverage } from './index';

export const projectionsCoverage: GrammarCoverage = {
  topic: 'projections',
  constructs: [
    'view element (qualified name)',
    'view element with alias',
    'view element with key modifier',
    'view element with virtual modifier',
    'view element with function call (coalesce(a, b), sum(x))',
    'view element with cast expression (cast(x as type [preserving type]))',
    'typed field (abstract/custom entity)',
    'case expression (operand and searched forms)',
    'arithmetic expression in element list',
    'localized element (: localized)',
    'association redirection (: redirected to <target>)',
    'view where / group by / having clauses',
    'projection view (as projection on <source>)',
  ],
};
