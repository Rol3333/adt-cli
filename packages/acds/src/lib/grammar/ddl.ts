/**
 * DDL grammar coverage.
 *
 * Entities implemented by `CdsParser`:
 *   - `define table <name> { ... }`
 *   - `define structure <name> { ... }`
 *   - `define type <name> : <type>;`
 *   - `define [root] view entity <name> [with parameters ...]
 *        as select [distinct] from <source> [<joins>] [<associations>]
 *        { ... } [where ...] [group by ...] [having ...]
 *        [union|intersect|except [all] select ...]`
 *   - `define [root] view entity <name> [provider contract transactional_query]
 *        as projection on <source> [<assoc redefinitions>] { ... }`
 *   - `define view <name> ...` — legacy classic SQL view (same body, flagged
 *     with `legacy: true` in the AST)
 *   - `define abstract entity <name> [with parameters ...] { ... }`
 *   - `define custom entity <name> [with parameters ...] { ... }`
 *   - `define [root] table entity <name> { ... }` (TABLE ENTITY / DTEL body)
 *   - `define [writable] external entity <name> [external name <obj>]
 *        { ... } with federated data provided at runtime`
 *   - `define table function <name> [with parameters ...]
 *        returns { ... } implemented by method <class>=><method>`
 *   - `define scalar function <name> [with parameters ...] returns <type>`
 *   - `define hierarchy <name> [with parameters ...]
 *        as parent child hierarchy( <clauses> ) { ... }`
 *   - `define aspect <name> { ... }`
 *   - `define annotation <name> { ... }` (DDLA — body kept opaque)
 *   - `define accesspolicy <name> { ... }` (body kept opaque)
 *   - `define service <name> { expose ...; }` (SRVD)
 *   - `annotate entity <name> with { ... }` (DDLX)
 *   - `extend view [entity] <name> with ...`
 *     / `extend abstract|custom entity <name> with { ... }`
 *
 * Data sources in the FROM region also accept path expressions
 * (`<source>._assoc[ <card>:<cond> ]` style attribute bindings) — the bracket
 * contents are captured opaquely.
 */
import type { GrammarCoverage } from './index';

export const ddlCoverage: GrammarCoverage = {
  topic: 'ddl',
  constructs: [
    'define table',
    'define structure',
    'define type',
    'define view entity',
    'define root view entity',
    'define view (legacy classic SQL view)',
    'define view entity as projection on (projection view)',
    'provider contract transactional_query',
    'define abstract entity',
    'define custom entity',
    'define table entity',
    'define external entity',
    'define writable external entity',
    'define table function',
    'define scalar function',
    'define hierarchy',
    'define aspect',
    'define annotation',
    'define accesspolicy',
    'define service',
    'annotate entity',
    'extend view entity / extend view / extend abstract|custom entity',
    'select distinct',
    'where / group by / having',
    'union [all] / intersect / except',
    'bind aspect <aspect>(<bindings>)',
    'include directive',
    'builtin type (abap.char, abap.dec, ...)',
    'named type reference',
    "typed literal (abap.dats'20200101')",
  ],
};
