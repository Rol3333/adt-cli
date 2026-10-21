/**
 * DCL (access control) grammar coverage.
 *
 *   define role <name> [switchable] {
 *     grant select on <entity>
 *       [with optional elements ( <elem> [default true|false] , ... )]
 *       [combination mode and|or]
 *       [where <expression>] ;
 *     inherit <role> [for grant select on <entity>] [where <expression>] ;
 *     inheriting conditions from entity <name>|super
 *       [default true|false] [replacing|adding ...] ;
 *     ...
 *   }
 *
 * Expressions inside `where` are captured as opaque `Expression` tokens —
 * downstream consumers can inspect the `source` / `tokens` arrays but the
 * parser does not interpret them further.
 *
 * Clause order inside a grant is only partially free: `with optional
 * elements`, `combination mode` and `where` may appear in any order, but a
 * trailing `where`/`inherit`-condition is captured greedily up to `;`, so a
 * condition clause must be the last clause of its statement.
 */
import type { GrammarCoverage } from './index';

export const dclCoverage: GrammarCoverage = {
  topic: 'dcl',
  constructs: [
    'define role <name> { ... }',
    'define role <name> switchable { ... }',
    'grant select on <entity>',
    'grant select on <entity> where <expression>',
    'grant select on <entity> with optional elements ( ... )',
    'grant ... combination mode and|or|redefinition',
    'inherit <role> [for grant select on <entity>] [where ...]',
    'inheriting conditions from entity <name>|super [default ...]',
  ],
};
