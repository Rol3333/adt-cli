/**
 * AST Node Types for ABAP CDS source
 *
 * Phase 1: TABL, Structure, DRTY, SRVD, DDLX
 * Phase 2: DCLS, DDLA, DRAS, DSFD, DTDC, DTEB, DTSC
 * Phase 3: DDLS (view entity — SQL-like)
 */

// ============================================
// Base types
// ============================================

/** Source location for error reporting */
export interface SourceLocation {
  startOffset: number;
  endOffset: number;
  startLine: number;
  startColumn: number;
  endLine?: number;
  endColumn?: number;
}

/** Base AST node */
export interface AstNode {
  loc?: SourceLocation;
}

// ============================================
// Annotations
// ============================================

/** Annotation value variants */
export type AnnotationValue =
  | StringLiteral
  | EnumValue
  | BooleanLiteral
  | NumberLiteral
  | AnnotationArray
  | AnnotationObject;

export interface StringLiteral extends AstNode {
  kind: 'string';
  value: string;
}

export interface EnumValue extends AstNode {
  kind: 'enum';
  value: string;
}

export interface BooleanLiteral extends AstNode {
  kind: 'boolean';
  value: boolean;
}

export interface NumberLiteral extends AstNode {
  kind: 'number';
  value: number;
}

export interface AnnotationArray extends AstNode {
  kind: 'array';
  items: AnnotationValue[];
}

export interface AnnotationObject extends AstNode {
  kind: 'object';
  properties: AnnotationProperty[];
}

export interface AnnotationProperty extends AstNode {
  key: string;
  value: AnnotationValue;
}

/** A single annotation: @DottedKey.path: value */
export interface Annotation extends AstNode {
  key: string;
  value: AnnotationValue;
}

// ============================================
// Type references
// ============================================

/** ABAP built-in type: abap.char(10), abap.dec(11,2) */
export interface BuiltinTypeRef extends AstNode {
  kind: 'builtin';
  name: string;
  length?: number;
  decimals?: number;
}

/** Data element / named type reference */
export interface NamedTypeRef extends AstNode {
  kind: 'named';
  name: string;
}

export type TypeRef = BuiltinTypeRef | NamedTypeRef;

// ============================================
// Field definitions
// ============================================

/** Field in a table/structure/aspect body */
export interface FieldDefinition extends AstNode {
  annotations: Annotation[];
  name: string;
  type: TypeRef;
  isKey: boolean;
  notNull: boolean;
}

/** Include directive: include <typename>; or include <typename> with suffix <suffix>; */
export interface IncludeDirective extends AstNode {
  kind: 'include';
  name: string;
  suffix?: string;
}

export type TableMember = FieldDefinition | IncludeDirective;

// ============================================
// Top-level definitions (Phase 1)
// ============================================

/** define table <name> { ... } */
export interface TableDefinition extends AstNode {
  kind: 'table';
  name: string;
  annotations: Annotation[];
  members: TableMember[];
}

/** define structure <name> { ... } */
export interface StructureDefinition extends AstNode {
  kind: 'structure';
  name: string;
  annotations: Annotation[];
  members: TableMember[];
}

/** define type <name> : <type>; */
export interface SimpleTypeDefinition extends AstNode {
  kind: 'simpleType';
  name: string;
  annotations: Annotation[];
  type: TypeRef;
}

/** define service <name> { expose ...; } */
export interface ServiceDefinition extends AstNode {
  kind: 'service';
  name: string;
  annotations: Annotation[];
  exposes: ExposeStatement[];
}

/** expose <entity> as <alias>; */
export interface ExposeStatement extends AstNode {
  entity: string;
  alias?: string;
}

/** annotate entity <name> with { ... } */
export interface MetadataExtension extends AstNode {
  kind: 'metadataExtension';
  entity: string;
  annotations: Annotation[];
  elements: AnnotatedElement[];
}

/** Element inside a metadata extension: @Anno field; */
export interface AnnotatedElement extends AstNode {
  annotations: Annotation[];
  name: string;
}

// ============================================
// Parameters
// ============================================

export interface ParameterDefinition extends AstNode {
  annotations: Annotation[];
  name: string;
  type: TypeRef;
  /** default literal value, if any (e.g. `default 'X'`) */
  defaultValue?: AnnotationValue;
}

// ============================================
// Expressions
// ============================================

/**
 * A path to a data-source field: `_Item.Field`, `_Item._Assoc.Field`.
 */
export interface FieldRefExpr extends AstNode {
  kind: 'fieldRef';
  /** The path segments, e.g. `['_Item', 'Field']`. */
  path: string[];
}

/**
 * `$projection.Element` — an element of the current view.
 *
 * It is **not** a field of the data source: a lineage tool has to treat it
 * differently from {@link FieldRefExpr}.
 */
export interface ProjectionRefExpr extends AstNode {
  kind: 'projectionRef';
  /** The element name without the `$projection.` prefix. */
  name: string;
}

/** `$parameters.P_X` — a parameter of the consuming view. */
export interface ParamRefExpr extends AstNode {
  kind: 'paramRef';
  /** The parameter name without the `$parameters.` prefix. */
  name: string;
}

/** `$session.client`, `$session.system_language`. */
export interface SessionVarExpr extends AstNode {
  kind: 'sessionVar';
  /** The variable name without the `$session.` prefix. */
  name: string;
}

export type LiteralKind = 'string' | 'number' | 'boolean' | 'null';

/** A literal value. `value` is omitted for the `null` literal. */
export interface LiteralExpr extends AstNode {
  kind: 'literal';
  literal: LiteralKind;
  value?: string | number | boolean;
}

/**
 * Binary operators.
 *
 * The set is frozen: arithmetic is part of the vocabulary from the start, so
 * that the AST type does not have to change when the grammar grows.
 */
export type BinaryOp =
  | 'eq'
  | 'ne'
  | 'lt'
  | 'le'
  | 'gt'
  | 'ge'
  | 'and'
  | 'or'
  | 'like'
  | 'add'
  | 'sub'
  | 'mul'
  | 'div';

export interface BinaryExpr extends AstNode {
  kind: 'binary';
  op: BinaryOp;
  left: Expr;
  right: Expr;
}

/** `not <operand>` */
export interface NotExpr extends AstNode {
  kind: 'not';
  operand: Expr;
}

/** `<operand> is null` / `<operand> is not null` */
export interface IsNullExpr extends AstNode {
  kind: 'isNull';
  operand: Expr;
  /** `true` for `is not null`. */
  negated: boolean;
}

/** `<operand> is initial` / `<operand> is not initial` */
export interface IsInitialExpr extends AstNode {
  kind: 'isInitial';
  operand: Expr;
  /** `true` for `is not initial`. */
  negated: boolean;
}

/**
 * `<operand> in (a, b, …)` / `<operand> not in (a, b, …)`.
 *
 * The right-hand side is an explicit value list — it is not a binary
 * expression.
 */
export interface InExpr extends AstNode {
  kind: 'in';
  operand: Expr;
  values: Expr[];
  /** `true` for `not in`. */
  negated?: boolean;
}

/** An ordinary function call: `coalesce(a, b)`, `division(x, y, 2)`. */
export interface CallExpr extends AstNode {
  kind: 'call';
  name: string;
  args: Expr[];
}

/**
 * `cast(<value> as <type> [preserving type])`.
 *
 * A cast is not an ordinary call — it carries a target type and a flag.
 */
export interface CastExpr extends AstNode {
  kind: 'cast';
  expression: Expr;
  targetType: string;
  preservingType?: boolean;
}

/**
 * A structured expression.
 *
 * The AST is structural, not a source mirror: whitespace and the original
 * spelling are not preserved. The canonical text form is produced by
 * `serializeExpr()`.
 */
export type Expr =
  | FieldRefExpr
  | ProjectionRefExpr
  | ParamRefExpr
  | SessionVarExpr
  | LiteralExpr
  | BinaryExpr
  | NotExpr
  | IsNullExpr
  | IsInitialExpr
  | InExpr
  | CallExpr
  | CastExpr;

// ============================================
// Associations
// ============================================

/** Cardinality, e.g. `[0..1]`, `[1..*]`, `[*]`, `[5]` */
export interface Cardinality extends AstNode {
  min?: number;
  /** `undefined` means unbounded (`*`) when present. */
  max?: number | '*';
}

export type AssociationKind = 'association' | 'composition';

export interface AssociationDeclaration extends AstNode {
  kind: 'association';
  /** `association` or `composition` */
  associationKind: AssociationKind;
  annotations: Annotation[];
  cardinality?: Cardinality;
  /** `of many` / `of one` modifier (optional). */
  targetMultiplicity?: 'many' | 'one';
  /** Fully qualified target entity (e.g. `I_SalesOrder`). */
  target: string;
  /** `to redirected to <target>` (projection association). */
  redirected?: boolean;
  alias?: string;
  on?: Expr;
}

// ============================================
// View entities / projection views
// ============================================

export type DataSourceKind = 'select' | 'projection';

/**
 * Normalized join type.
 *
 * The different surface spellings are folded into one vocabulary so that
 * downstream consumers (dependency / lineage tooling) do not have to know
 * about surface syntax:
 *
 * | spelling              | normalized   |
 * |-----------------------|--------------|
 * | `JOIN`                | `inner`      |
 * | `INNER JOIN`          | `inner`      |
 * | `LEFT JOIN`           | `leftOuter`  |
 * | `LEFT OUTER JOIN`     | `leftOuter`  |
 * | `RIGHT JOIN`          | `rightOuter` |
 * | `RIGHT OUTER JOIN`    | `rightOuter` |
 * | `FULL JOIN`           | `fullOuter`  |
 * | `FULL OUTER JOIN`     | `fullOuter`  |
 * | `CROSS JOIN`          | `cross`      |
 */
export type JoinType =
  'inner' | 'leftOuter' | 'rightOuter' | 'fullOuter' | 'cross';

/**
 * A single parameter binding of a parameterized data source.
 *
 * `value` keeps the original binding text, e.g. `:P_StartDate` (reference to
 * a parameter of the consuming view), `$session.client` / `$parameters.P_X`
 * (system variable) or a literal such as `'X'` / `42`.
 */
export interface DataSourceParameter extends AstNode {
  /** Name of the target parameter, e.g. `P_StartDate`. */
  name: string;
  /** Raw binding text as written in the source. */
  value: string;
}

/** A data source in a FROM clause: a view, table, projection or parameter. */
export interface DataSource extends AstNode {
  name: string;
  alias?: string;
  /** Parameter bindings — present for parameterized sources only. */
  parameters?: DataSourceParameter[];
}

/** A join in a FROM clause: `LEFT OUTER JOIN <source> ON <condition>`. */
export interface JoinClause extends AstNode {
  kind: 'join';
  /** Normalized join type (see {@link JoinType}). */
  joinType: JoinType;
  /** The joined data source (with optional alias and parameters). */
  source: DataSource;
  /** The `ON` condition. */
  on?: Expr;
}

/** Single element in a view's projection list. */
export interface ViewElement extends AstNode {
  annotations: Annotation[];
  isKey: boolean;
  isVirtual: boolean;
  isRedirected: boolean;
  /** Either a typed field (abstract/custom entities) or projection expression. */
  expression: string;
  alias?: string;
  /** Present only when element is a typed field (`name : type`). */
  type?: TypeRef;
  notNull?: boolean;
}

export type ViewMember = ViewElement | AssociationDeclaration;

export interface ViewEntityDefinition extends AstNode {
  kind: 'viewEntity';
  name: string;
  annotations: Annotation[];
  /**
   * `true` for the legacy `define view <name>` syntax (classic SQL view).
   * Absent for `define view entity <name>`.
   */
  legacy?: boolean;
  sourceKind: DataSourceKind;
  source: DataSource;
  /**
   * Ordered join chain applied to {@link source}. Empty when the view has no
   * joins. The first entry is joined against `source`, the second against the
   * result of the first, and so on.
   */
  joins: JoinClause[];
  /**
   * Associations declared in the FROM region (between the data source and
   * the element list). Distinct from the associations declared inside the
   * element list, which are part of {@link members}.
   */
  fromAssociations?: AssociationDeclaration[];
  parameters: ParameterDefinition[];
  members: ViewMember[];
  /** Top-level filter clause (`where ...`). */
  where?: Expr;
}

export interface AbstractEntityDefinition extends AstNode {
  kind: 'abstractEntity';
  name: string;
  annotations: Annotation[];
  parameters: ParameterDefinition[];
  members: ViewMember[];
}

export interface CustomEntityDefinition extends AstNode {
  kind: 'customEntity';
  name: string;
  annotations: Annotation[];
  parameters: ParameterDefinition[];
  members: ViewMember[];
}

// ============================================
// DCL — access control (role)
// ============================================

export interface GrantStatement extends AstNode {
  /** The granted privilege, always `select` for now. */
  privilege: 'select';
  /** Target entity (qualified). */
  entity: string;
  where?: Expr;
}

export interface RoleDefinition extends AstNode {
  kind: 'role';
  name: string;
  annotations: Annotation[];
  grants: GrantStatement[];
}

// ============================================
// Union type for all definitions
// ============================================

export type CdsDefinition =
  | TableDefinition
  | StructureDefinition
  | SimpleTypeDefinition
  | ServiceDefinition
  | MetadataExtension
  | RoleDefinition
  | ViewEntityDefinition
  | AbstractEntityDefinition
  | CustomEntityDefinition;

// ============================================
// Source file (root AST node)
// ============================================

/** Root AST node representing a parsed CDS source file */
export interface CdsSourceFile extends AstNode {
  definitions: CdsDefinition[];
}
