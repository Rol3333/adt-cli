/**
 * Association and composition grammar coverage.
 *
 *   association[<cardinality>]
 *       [ of [<tgt-card>] [to <tgt-card>]? <target>
 *       | to [parent|<tgt-card>]? [redirected to]? <target>
 *       | <target> ]                            -- `to` is optional
 *       [as <alias>]  [on <expression>]
 *       [with default filter <expression>]  ;|,
 *   composition[<cardinality>]  (same tail forms)
 *
 * Cardinality forms:
 *   - `[N]`            upper bound = N, lower implicit 0
 *   - `[L..U]`         lower = L, upper = U
 *   - `[L..*]`         lower = L, upper unbounded
 *   - `[*]`            unbounded
 *
 * `to parent` marks the child→parent direction of a composition pair.
 * `redirected to` introduces projection-view re-targeting for associations
 * defined on the underlying view.
 *
 * FROM-region associations (declared between the data source and the element
 * list) land in `ViewEntityDefinition.fromAssociations`; element-list
 * associations land in `members`.
 *
 * `bind aspect <name>(<elem> => <operand>, ...)` attaches an aspect binding
 * to a data source in the FROM region.
 */
import type { GrammarCoverage } from './index';

export const associationsCoverage: GrammarCoverage = {
  topic: 'associations',
  constructs: [
    'association to <target>',
    'association <target> (implicit to)',
    'association[cardinality] to <target>',
    'association[L..U] to <target>',
    'association of (many|one|exact one) [to <card>] <target>',
    'composition [of] <target>',
    'association to parent <target>',
    'association to redirected to <target>',
    'association ... as <alias>',
    'association ... on <expression>',
    'association ... with default filter <expression>',
    'FROM-region association / composition',
    'bind aspect <name>(<bindings>)',
  ],
};
