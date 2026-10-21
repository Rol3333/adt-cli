# acds - AI Agent Guide

## Package Overview

**ABAP CDS source parser** — tokenizes, parses, and produces a typed AST from `.acds` DDL/DCL source code. Foundation for the RAP chain (E10 BDEF, E11 SRVD, E12 SRVB).

| Feature                 | Description                                                             |
| ----------------------- | ----------------------------------------------------------------------- |
| **Chevrotain**          | Lexer + CstParser + visitor pattern (LL(4))                             |
| **Error recovery**      | Returns partial AST + structured errors                                 |
| **Construct-scoped**    | Grammar topics live under `src/lib/grammar/` (docs + coverage metadata) |
| **AST walker**          | `walkDefinitions`, `walkAnnotations`, `walkAssociations`, ...           |
| **Semantic validators** | Cardinality + view-element sanity checks                                |
| **Single entry**        | `parse(source) → { ast, errors }`                                       |

## Grammar coverage

| Topic          | Constructs                                                                                                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ddl`          | `define table`, `define structure`, `define type`, `define view entity`, `define view` (legacy), `define abstract entity`, `define custom entity`, `define service`, `annotate entity` |
| `dcl`          | `define role … { grant select on <entity> [where …] }`                                                                                                                                 |
| `annotations`  | `@Key`, `@Key:value`, arrays, nested objects, dotted property keys                                                                                                                     |
| `associations` | `association`, `composition`, cardinality `[L..U]` / `[*]` / `[N]`, `of many/one`, `redirected to`, `on <expr>`, `as <alias>`                                                          |
| `joins`        | `JOIN` / `INNER JOIN` / `LEFT [OUTER] JOIN` / `RIGHT [OUTER] JOIN` / `CROSS JOIN`, chained joins, parameterized sources, `ON <expr>`                                                   |
| `parameters`   | `with parameters p : <type> [default <literal>]`, annotated parameters                                                                                                                 |
| `projections`  | key / virtual / redirected modifiers, typed fields (abstract/custom entities), `where` clauses                                                                                         |
| `actions`      | _placeholder — owned by E10 (BDEF)_                                                                                                                                                    |

The coverage metadata is exported at runtime via `GRAMMAR_COVERAGE` for tooling / docs.

## Architecture

```
Source string
  → CdsLexer        (tokens.ts)    Tokenize
  → CdsParser       (parser.ts)    Tokens → CST
  → CdsVisitor      (visitor.ts)   CST → AST
  → CdsSourceFile   (ast.ts)       Typed AST
```

### Key Files

| File                    | Purpose                                                               |
| ----------------------- | --------------------------------------------------------------------- |
| `src/index.ts`          | `parse()` entry point, re-exports all types and helpers               |
| `src/tokens.ts`         | Chevrotain token definitions (keywords, symbols, literals, operators) |
| `src/parser.ts`         | Grammar rules (`CdsParser extends CstParser`)                         |
| `src/visitor.ts`        | CST → AST transformation (`CdsVisitor`)                               |
| `src/ast.ts`            | AST node interfaces and union types                                   |
| `src/errors.ts`         | Error normalization (lex + parse)                                     |
| `src/lib/grammar/*.ts`  | Per-topic grammar docs + coverage exports                             |
| `src/lib/ast/walker.ts` | AST iteration helpers (`walkDefinitions`, `walkAssociations`, ...)    |
| `src/lib/ast/*.ts`      | Topic-scoped AST type re-exports                                      |
| `src/lib/validate/*.ts` | Semantic validators (return `SemanticDiagnostic[]`)                   |

### AST Node Hierarchy

```
CdsSourceFile
  └── CdsDefinition (discriminated by `kind`)
        ├── TableDefinition        (kind: 'table')
        ├── StructureDefinition    (kind: 'structure')
        ├── SimpleTypeDefinition   (kind: 'simpleType')
        ├── ServiceDefinition      (kind: 'service')
        ├── MetadataExtension      (kind: 'metadataExtension')
        ├── RoleDefinition         (kind: 'role')
        ├── ViewEntityDefinition   (kind: 'viewEntity')
        ├── AbstractEntityDefinition (kind: 'abstractEntity')
        └── CustomEntityDefinition (kind: 'customEntity')

ViewMember  = ViewElement | AssociationDeclaration
TableMember = FieldDefinition | IncludeDirective
TypeRef     = BuiltinTypeRef  | NamedTypeRef
```

## Conventions

### Token Order Matters

In `tokens.ts`:

1. Keywords **must** come before `Identifier` in `allTokens`.
2. Keywords that share a prefix with other keywords (e.g. `association` / `as`, `one` / `on`) **must** be listed before the shorter keyword — otherwise Chevrotain reports the longer one as unreachable.
3. Multi-character operators (`==`, `!=`, `<=`, `>=`) must precede their single-character equivalents.

### `cdsName` vs keywords

CDS sources commonly use keywords as identifiers (e.g. `@ObjectModel.association.type`). The `cdsName` rule in the parser accepts every keyword that can legally appear as a name. When adding a new keyword, **append it to the `cdsName` rule** if it might be used as an identifier anywhere.

**Exception — the join keywords** (`join`, `inner`, `left`, `right`, `outer`, `cross`) are deliberately **not** part of `cdsName`. The optional alias of a data source is parsed as `[as] <cdsName>`; if the join keywords were accepted as names, the alias would swallow the `join` that starts the next join clause. Keep them out of `cdsName` unless the grammar is restructured (e.g. with a dedicated `dataSourceAlias` rule).

### Parser Rules

- `recoveryEnabled: true` — malformed input produces partial CST + errors
- `maxLookahead: 4` — keep grammar LL(4) compatible
- The singleton `cdsParser` instance is reused across calls.

### Expressions

`on` and `where` clauses are captured as opaque `Expression { source, tokens }` structures — the parser does **not** produce an expression tree. Downstream consumers that need structural access should either:

1. Parse the token stream themselves; or
2. Wait for the expression grammar to be expanded (tracked as open question in the epic).

The condition grammar accepts comparisons, `AND` / `OR` chains, parenthesized sub-conditions, call arguments (`coalesce(a, b)`), `is null` / `is not initial` predicates and system variables (`$session.client`, `$parameters.P_X`, `$projection.Field`). The capture is complete — it is **not** truncated at boolean operators, commas or parentheses.

### Projection elements

A projection element is one of

```abap
<path> [as <alias>]                                       -- zi.PurchaseRequisition
<func>( <arg>, ... ) [as <alias>]                        -- coalesce(a, b), sum(x)
cast( <value> as <type> [preserving type] ) [as <alias>]  -- cast(0 as abap.curr(15,2))
```

The expression text is preserved verbatim (reformatted only in whitespace). `CASE … END` and arithmetic between operands are **not** supported yet.

### View flavours

`define view entity <name>` (CDS view entity) and the legacy `define view <name>` (classic SQL view) share the same grammar body; the AST marks the legacy form with `legacy: true`.

### FROM clause

`select from <source>` may be followed by a chain of joins and/or association declarations:

```abap
as select from I_Item as _Item
  left outer join ZI_Other as _Other on _Item.key = _Other.key
  association [0..1] to I_Product as _Product on $projection.Product = _Product.Product
```

- joins land in `ViewEntityDefinition.joins` (ordered, `joinType` normalized),
- FROM associations land in `ViewEntityDefinition.fromAssociations` (kept apart from the element-list associations in `members`),
- parameterized sources carry `DataSource.parameters` with the raw binding text.

## Consumers

- `@abapify/adt-plugin-abapgit` — imports `TableDefinition`, `FieldDefinition`, etc. to map CDS AST → DD02V/DD03P structures.
- **E10 (BDEF)** — will consume `CdsSourceFile` and walker APIs to cross-reference behavior definitions against projection views.
- **E11 (SRVD)** — resolves `ServiceDefinition.exposes[].entity` against parsed `ViewEntityDefinition`s.
- **E12 (SRVB)** — uses `ServiceDefinition` to inventory exposed entities.

## Testing

```bash
bunx nx test acds
```

Tests live in:

- `src/parser.test.ts` — legacy Phase 1 coverage (TABL/structure/type/service/annotate)
- `tests/grammar/*.test.ts` — per-topic grammar coverage (`joins.test.ts`, `from-associations.test.ts`, …)
- `tests/fixtures.test.ts` — parses every file under `tests/fixtures/` without errors
- `tests/walker.test.ts` — AST traversal helpers
- `tests/validate.test.ts` — semantic validators

**≥ 72 tests, 12 real-world fixtures** (from `git_modules/abap-file-formats` and hand-crafted).

## Dependencies

- [`chevrotain`](https://chevrotain.io/) — Parser toolkit
