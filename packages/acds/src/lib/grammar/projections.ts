/**
 * Projection / view grammar coverage.
 *
 * View body element (per member):
 *   [annotation*] [key] [virtual] [redirected] (
 *       <name> : <type> [not null]    -- typed field (abstract/custom entities)
 *     | <path> [as <alias>]           -- projection element
 *     | <func>( <arg> , ... ) [as <alias>]
 *     | cast( <value> as <type> [preserving type] ) [as <alias>]
 *   ) ;|,
 *
 * Plus any association declarations (see `associations.ts`).
 *
 * Not yet implemented:
 *   - Case / when / else expressions.
 *   - Arithmetic operators between operands.
 *   - Window functions.
 *   - Unions / selects combined in element bodies.
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
    'view where clause',
    'projection view (as projection on <source>)',
  ],
};
