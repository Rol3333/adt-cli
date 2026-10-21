---
title: '@abapify/acds'
description: ABAP CDS DDL source parser (lexer, parser, typed AST).
---

# `@abapify/acds`

Parser for ABAP CDS DDL source (`.acds`/DDLS sources). Tokenizes, parses, and
produces a typed AST for tables, structures, simple types, services, metadata
extensions, and (phased) roles + view entities. Built on
[chevrotain](https://chevrotain.io/) with error recovery — partial ASTs plus
structured errors are returned even on malformed input.

## Install

```bash
bun add @abapify/acds
```

## Public API

```ts
export { parse, type ParseResult } from '@abapify/acds';
// Re-exported from './ast', './tokens', './errors':
export type {
  CdsSourceFile,
  CdsDefinition,
  TableDefinition,
  StructureDefinition,
  SimpleTypeDefinition,
  ServiceDefinition,
  MetadataExtension,
  FieldDefinition,
  IncludeDirective,
  TypeRef,
  BuiltinTypeRef,
  NamedTypeRef,
  CdsParseError,
} from '@abapify/acds';

// FROM clause (view entities)
export type {
  ViewEntityDefinition,
  DataSource,
  DataSourceParameter,
  JoinClause,
  JoinType,
  AssociationDeclaration,
  Expression,
} from '@abapify/acds';
```

## FROM clause

View entities expose the whole FROM region:

- `ViewEntityDefinition.source` — the root data source,
- `ViewEntityDefinition.joins` — the ordered join chain (`joinType` is normalized
  to `inner` / `leftOuter` / `rightOuter` / `fullOuter` / `cross`),
- `ViewEntityDefinition.fromAssociations` — associations declared next to the
  data source (as opposed to the element-list associations in `members`),
- `DataSource.parameters` — the bindings of a parameterized source, e.g.
  `:P_StartDate`, `$session.client` or a literal.

Join syntax:

- the `ON` condition is required for `[INNER] JOIN`, `LEFT [OUTER] JOIN`,
  `RIGHT [OUTER] JOIN` and `FULL [OUTER] JOIN`, and not allowed for
  `CROSS JOIN`,
- the `OUTER` keyword is optional: `LEFT JOIN` and `LEFT OUTER JOIN` are both
  accepted and both normalized to `leftOuter`,
- `FULL [OUTER] JOIN` (the SQL-standard full outer join) is supported and
  normalized to `fullOuter` — it is not part of the ABAP CDS DDL join syntax,
  but it is needed to read HANA CDS / CAP CDS sources, which use the standard
  SQL join syntax,
- the accepted spellings are the same for a CDS view entity
  (`define view entity`) and a classic SQL view (`define view`).

Keywords are matched case-insensitively — `DEFINE VIEW ENTITY` and
`define view entity` both parse, and identifiers keep their original spelling.

## Expressions

The `on` and `where` conditions are parsed into a structured `Expr` tree
instead of an opaque token list:

- `FieldRefExpr` — a data-source path (`_Item.Field`),
- `ProjectionRefExpr` / `ParamRefExpr` / `SessionVarExpr` — the system
  variables `$projection.X`, `$parameters.P_X` and `$session.client`,
- `LiteralExpr`, `BinaryExpr`, `NotExpr`, `IsNullExpr`, `IsInitialExpr`,
  `InExpr`, `CallExpr` and `CastExpr`.

The grammar follows the SQL precedence (`AND` binds tighter than `OR`,
comparisons bind tighter than `NOT`) and supports comparisons, `NOT`,
`is null` / `is initial`, `in (…)`, `like` and arithmetic.

`serializeExpr(expr)` renders a condition in its canonical text form — it is
the single test oracle for conditions:

```ts
import { parse, serializeExpr } from '@abapify/acds';

const { ast } = parse(`
  define view entity V as select from I_Item as _Item
    left outer join ZI_Other as _Other on _Item.key = _Other.key
  {
    key _Item.key
  }
`);

const view = ast.definitions[0] as ViewEntityDefinition;
serializeExpr(view.joins[0].on!); // '_Item.key = _Other.key'
```

## Usage

```ts
import { parse } from '@abapify/acds';

const result = parse(`
  @AbapCatalog.tableCategory : #TRANSPARENT
  define table ztable {
    key field1 : abap.char(10) not null;
    field2 : some_data_element;
  }
`);

if (result.errors.length === 0) {
  const table = result.ast.definitions[0]; // TableDefinition
  console.log(table.name, table.fields);
}
```

## Dependencies

- Runtime: `chevrotain`
- Consumed by: [`@abapify/adt-plugin-abapgit`](./adt-plugin-abapgit) (maps
  CDS AST → DD02V/DD03P for abapGit TABL serialisation).

## See also

- [`adt-plugin-abapgit`](./adt-plugin-abapgit) — primary consumer
- [DDIC contracts](../contracts/ddic) — the REST side of CDS sources
