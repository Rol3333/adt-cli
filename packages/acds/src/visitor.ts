/**
 * CST → AST Visitor
 *
 * Transforms Chevrotain's Concrete Syntax Tree into our typed AST.
 */
import type { CstNode, IToken } from 'chevrotain';
import { cdsParser } from './parser';
import type {
  AbstractEntityDefinition,
  Annotation,
  AnnotationValue,
  AnnotationProperty,
  AnnotatedElement,
  AssociationDeclaration,
  AssociationKind,
  BinaryOp,
  BuiltinTypeRef,
  Cardinality,
  CdsDefinition,
  CdsSourceFile,
  CustomEntityDefinition,
  DataSource,
  DataSourceKind,
  DataSourceParameter,
  ExposeStatement,
  Expr,
  FieldDefinition,
  GrantStatement,
  IncludeDirective,
  JoinClause,
  JoinType,
  LiteralExpr,
  MetadataExtension,
  NamedTypeRef,
  ParameterDefinition,
  RoleDefinition,
  ServiceDefinition,
  SimpleTypeDefinition,
  StructureDefinition,
  TableDefinition,
  TableMember,
  TypeRef,
  ViewElement,
  ViewEntityDefinition,
  ViewMember,
} from './ast';

// Generate the base visitor class from the parser's grammar
const BaseCstVisitor = cdsParser.getBaseCstVisitorConstructor<
  unknown,
  unknown
>();

type Ctx = Record<string, CstNode[] | IToken[] | undefined>;

/**
 * The default value of a parameter is an annotation value — the literal of
 * the expression grammar is mapped back to it.
 */
function toAnnotationValue(expr: LiteralExpr): AnnotationValue {
  switch (expr.literal) {
    case 'string':
      return { kind: 'string', value: String(expr.value ?? '') };
    case 'number':
      return { kind: 'number', value: Number(expr.value ?? 0) };
    case 'boolean':
      return { kind: 'boolean', value: Boolean(expr.value) };
    default:
      return { kind: 'string', value: 'null' };
  }
}

function asNodes(v: CstNode[] | IToken[] | undefined): CstNode[] {
  return (v as CstNode[]) ?? [];
}

function asTokens(v: CstNode[] | IToken[] | undefined): IToken[] {
  return (v as IToken[]) ?? [];
}

function collectTokenImages(node: CstNode | undefined): IToken[] {
  if (!node) return [];
  const out: IToken[] = [];
  const walk = (n: CstNode) => {
    for (const children of Object.values(n.children)) {
      for (const child of children) {
        if ('tokenType' in child) {
          out.push(child as IToken);
        } else {
          walk(child as CstNode);
        }
      }
    }
  };
  walk(node);
  out.sort((a, b) => (a.startOffset ?? 0) - (b.startOffset ?? 0));
  return out;
}

/** All tokens of a rule context, in source order. */
function ctxTokens(ctx: Ctx): IToken[] {
  const out: IToken[] = [];
  for (const value of Object.values(ctx)) {
    for (const child of (value ?? []) as Array<CstNode | IToken>) {
      if ('tokenType' in child) out.push(child as IToken);
      else out.push(...collectTokenImages(child as CstNode));
    }
  }
  out.sort((a, b) => (a.startOffset ?? 0) - (b.startOffset ?? 0));
  return out;
}

/**
 * Format tokens as source-like text: no space before `(` `,` `)` `]` `.`,
 * none after `(` and none after `.` — e.g. `coalesce(a.b, c)`.
 */
function formatTokens(toks: IToken[]): string {
  let out = '';
  for (const t of toks) {
    const img = t.image;
    if (!out) {
      out = img;
      continue;
    }
    const tight =
      ['(', ',', ')', ']', '.'].includes(img) ||
      out.endsWith('(') ||
      out.endsWith('.');
    out += tight ? img : ` ${img}`;
  }
  return out;
}

/** Tokens sorted by their position in the source. */
function sortedTokens(tokens: IToken[]): IToken[] {
  return [...tokens].sort(
    (a, b) => (a.startOffset ?? 0) - (b.startOffset ?? 0),
  );
}

/**
 * The comparison operator of a `comparisonExpression` — `undefined` when the
 * expression is not a comparison.
 */
function comparisonOperator(ctx: Ctx): BinaryOp | undefined {
  if (asTokens(ctx.EqEq).length || asTokens(ctx.Eq).length) return 'eq';
  if (asTokens(ctx.NotEq).length) return 'ne';
  if (asTokens(ctx.LtEq).length) return 'le';
  if (asTokens(ctx.GtEq).length) return 'ge';
  if (asTokens(ctx.Lt).length) return 'lt';
  if (asTokens(ctx.Gt).length) return 'gt';
  if (asTokens(ctx.Like).length) return 'like';
  return undefined;
}

/**
 * Raw text of a CST node — the token images concatenated without separators.
 * Used for parameter bindings, where the original spelling matters
 * (`:P_Param`, `$session.client`, `'X'`).
 */
function toRawText(node: CstNode | undefined): string {
  return collectTokenImages(node)
    .map((t) => t.image)
    .join('');
}

/** The FROM region of a view: the root source plus joins and associations. */
interface FromClause {
  source: DataSource;
  joins: JoinClause[];
  fromAssociations: AssociationDeclaration[];
}

export class CdsVisitor extends BaseCstVisitor {
  constructor() {
    super();
    this.validateVisitor();
  }

  sourceFile(ctx: Ctx): CdsSourceFile {
    const annotations: Annotation[] = asNodes(ctx.topLevelAnnotation).map(
      (node) => this.visit(node) as Annotation,
    );
    const def = this.visit(asNodes(ctx.definition)[0]) as CdsDefinition;

    // Attach top-level annotations to the definition
    if ('annotations' in def) {
      (def as { annotations: Annotation[] }).annotations = [
        ...annotations,
        ...(def as { annotations: Annotation[] }).annotations,
      ];
    }

    return { definitions: [def] };
  }

  definition(ctx: Ctx): CdsDefinition {
    if (ctx.defineStatement) {
      return this.visit(asNodes(ctx.defineStatement)[0]) as CdsDefinition;
    }
    return this.visit(asNodes(ctx.annotateStatement)[0]) as CdsDefinition;
  }

  defineStatement(ctx: Ctx): CdsDefinition {
    const dispatch: Array<[string, undefined | CstNode]> = [
      ['tableDefinition', asNodes(ctx.tableDefinition)[0]],
      ['structureDefinition', asNodes(ctx.structureDefinition)[0]],
      ['viewEntityDefinition', asNodes(ctx.viewEntityDefinition)[0]],
      ['abstractEntityDefinition', asNodes(ctx.abstractEntityDefinition)[0]],
      ['customEntityDefinition', asNodes(ctx.customEntityDefinition)[0]],
      ['simpleTypeDefinition', asNodes(ctx.simpleTypeDefinition)[0]],
      ['serviceDefinition', asNodes(ctx.serviceDefinition)[0]],
      ['roleDefinition', asNodes(ctx.roleDefinition)[0]],
    ];
    for (const [, node] of dispatch) {
      if (node) return this.visit(node) as CdsDefinition;
    }
    // should not happen
    return { kind: 'table', name: '', annotations: [], members: [] };
  }

  tableDefinition(ctx: Ctx): TableDefinition {
    const name = this.visit(asNodes(ctx.cdsName)[0]) as string;
    const members = asNodes(ctx.tableMember).map(
      (node) => this.visit(node) as TableMember,
    );
    return { kind: 'table', name, annotations: [], members };
  }

  structureDefinition(ctx: Ctx): StructureDefinition {
    const name = this.visit(asNodes(ctx.cdsName)[0]) as string;
    const members = asNodes(ctx.tableMember).map(
      (node) => this.visit(node) as TableMember,
    );
    return { kind: 'structure', name, annotations: [], members };
  }

  // ---- View entities ----------------------------------------

  viewEntityDefinition(ctx: Ctx): ViewEntityDefinition {
    const name = this.visit(asNodes(ctx.cdsName)[0]) as string;
    // `define view <name>` (legacy classic SQL view) vs `define view entity <name>`
    const legacy = asTokens(ctx.Entity).length === 0;
    const parameters = ctx.parametersClause
      ? (this.visit(asNodes(ctx.parametersClause)[0]) as ParameterDefinition[])
      : [];

    let sourceKind: DataSourceKind = 'select';
    let source: DataSource = { name: '' };
    let joins: JoinClause[] = [];
    let fromAssociations: AssociationDeclaration[] = [];
    if (ctx.selectFromClause) {
      sourceKind = 'select';
      const from = this.visit(asNodes(ctx.selectFromClause)[0]) as FromClause;
      source = from.source;
      joins = from.joins;
      fromAssociations = from.fromAssociations;
    } else if (ctx.projectionOnClause) {
      sourceKind = 'projection';
      source = this.visit(asNodes(ctx.projectionOnClause)[0]) as DataSource;
    }

    const members = ctx.elementList
      ? (this.visit(asNodes(ctx.elementList)[0]) as ViewMember[])
      : [];

    const where = ctx.orExpression
      ? (this.visit(asNodes(ctx.orExpression)[0]) as Expr | undefined)
      : undefined;

    return {
      kind: 'viewEntity',
      name,
      annotations: [],
      sourceKind,
      source,
      joins,
      ...(fromAssociations.length > 0 && { fromAssociations }),
      ...(legacy && { legacy: true }),
      parameters,
      members,
      ...(where && { where }),
    };
  }

  abstractEntityDefinition(ctx: Ctx): AbstractEntityDefinition {
    const name = this.visit(asNodes(ctx.cdsName)[0]) as string;
    const parameters = ctx.parametersClause
      ? (this.visit(asNodes(ctx.parametersClause)[0]) as ParameterDefinition[])
      : [];
    const members = this.visit(asNodes(ctx.elementList)[0]) as ViewMember[];
    return {
      kind: 'abstractEntity',
      name,
      annotations: [],
      parameters,
      members,
    };
  }

  customEntityDefinition(ctx: Ctx): CustomEntityDefinition {
    const name = this.visit(asNodes(ctx.cdsName)[0]) as string;
    const parameters = ctx.parametersClause
      ? (this.visit(asNodes(ctx.parametersClause)[0]) as ParameterDefinition[])
      : [];
    const members = this.visit(asNodes(ctx.elementList)[0]) as ViewMember[];
    return {
      kind: 'customEntity',
      name,
      annotations: [],
      parameters,
      members,
    };
  }

  selectFromClause(ctx: Ctx): FromClause {
    const source = this.visit(asNodes(ctx.dataSource)[0]) as DataSource;
    const joins = asNodes(ctx.joinClause).map(
      (node) => this.visit(node) as JoinClause,
    );
    const fromAssociations = asNodes(ctx.associationTail).map(
      (node) => this.visit(node) as AssociationDeclaration,
    );
    return { source, joins, fromAssociations };
  }

  projectionOnClause(ctx: Ctx): DataSource {
    return this.visit(asNodes(ctx.dataSource)[0]) as DataSource;
  }

  dataSource(ctx: Ctx): DataSource {
    const name = this.visit(asNodes(ctx.qualifiedName)[0]) as string;
    const aliasNode = asNodes(ctx.cdsName)[0] ?? asNodes(ctx.bareAliasName)[0];
    const alias = aliasNode ? (this.visit(aliasNode) as string) : undefined;
    const parameters = ctx.dataSourceParameters
      ? (this.visit(
          asNodes(ctx.dataSourceParameters)[0],
        ) as DataSourceParameter[])
      : undefined;
    return {
      name,
      ...(alias && { alias }),
      ...(parameters && { parameters }),
    };
  }

  // ---- Joins -----------------------------------------------

  joinClause(ctx: Ctx): JoinClause {
    if (ctx.dataSource) {
      // A cross join — it has no ON condition.
      const source = this.visit(asNodes(ctx.dataSource)[0]) as DataSource;
      return { kind: 'join', joinType: 'cross', source };
    }

    const joinType = this.visit(asNodes(ctx.joinType)[0]) as JoinType;
    const joined = this.visit(asNodes(ctx.joinSource)[0]) as {
      source: DataSource;
      on?: Expr;
    };
    return {
      kind: 'join',
      joinType,
      source: joined.source,
      ...(joined.on && { on: joined.on }),
    };
  }

  joinType(ctx: Ctx): JoinType {
    // The spellings are normalized: `JOIN` / `INNER JOIN` → inner,
    // `LEFT [OUTER] JOIN` → leftOuter, `RIGHT [OUTER] JOIN` → rightOuter,
    // `FULL [OUTER] JOIN` → fullOuter.
    if (asTokens(ctx.Full).length) return 'fullOuter';
    if (asTokens(ctx.Left).length) return 'leftOuter';
    if (asTokens(ctx.Right).length) return 'rightOuter';
    return 'inner';
  }

  joinSource(ctx: Ctx): { source: DataSource; on?: Expr } {
    const source = this.visit(asNodes(ctx.dataSource)[0]) as DataSource;
    const on = ctx.orExpression
      ? (this.visit(asNodes(ctx.orExpression)[0]) as Expr | undefined)
      : undefined;
    return { source, ...(on && { on }) };
  }

  dataSourceParameters(ctx: Ctx): DataSourceParameter[] {
    return asNodes(ctx.dataSourceParameter).map(
      (node) => this.visit(node) as DataSourceParameter,
    );
  }

  dataSourceParameter(ctx: Ctx): DataSourceParameter {
    const name = this.visit(asNodes(ctx.qualifiedName)[0]) as string;
    const value = toRawText(asNodes(ctx.parameterBinding)[0]);
    return { name, value };
  }

  elementList(ctx: Ctx): ViewMember[] {
    return asNodes(ctx.elementMember).map(
      (node) => this.visit(node) as ViewMember,
    );
  }

  elementMember(ctx: Ctx): ViewMember {
    const annotations = asNodes(ctx.annotation).map(
      (n) => this.visit(n) as Annotation,
    );
    if (ctx.associationTail) {
      const decl = this.visit(
        asNodes(ctx.associationTail)[0],
      ) as AssociationDeclaration;
      decl.annotations = annotations;
      return decl;
    }
    const el = this.visit(asNodes(ctx.viewElementTail)[0]) as ViewElement;
    el.annotations = annotations;
    return el;
  }

  viewElementTail(ctx: Ctx): ViewElement {
    const isKey = !!asTokens(ctx.Key).length;
    const isVirtual = !!asTokens(ctx.Virtual).length;
    const isRedirected = !!asTokens(ctx.Redirected).length;

    if (ctx.typedFieldTail) {
      const tail = this.visit(asNodes(ctx.typedFieldTail)[0]) as {
        name: string;
        type: TypeRef;
        notNull: boolean;
      };
      return {
        annotations: [],
        isKey,
        isVirtual,
        isRedirected,
        expression: tail.name,
        type: tail.type,
        notNull: tail.notNull,
      };
    }
    const proj = this.visit(asNodes(ctx.projectionExpression)[0]) as {
      expression: string;
      alias?: string;
    };
    return {
      annotations: [],
      isKey,
      isVirtual,
      isRedirected,
      expression: proj.expression,
      ...(proj.alias && { alias: proj.alias }),
    };
  }

  typedFieldTail(ctx: Ctx): {
    name: string;
    type: TypeRef;
    notNull: boolean;
  } {
    const name = this.visit(asNodes(ctx.cdsName)[0]) as string;
    const type = this.visit(asNodes(ctx.typeReference)[0]) as TypeRef;
    const notNull = !!asTokens(ctx.Not).length;
    return { name, type, notNull };
  }

  projectionExpression(ctx: Ctx): { expression: string; alias?: string } {
    const expression = ctx.castExpression
      ? (this.visit(asNodes(ctx.castExpression)[0]) as { expression: string })
          .expression
      : (
          this.visit(asNodes(ctx.projectionOperand)[0]) as {
            expression: string;
          }
        ).expression;
    const aliasNode = asNodes(ctx.cdsName)[0];
    const alias = aliasNode ? (this.visit(aliasNode) as string) : undefined;
    return { expression, ...(alias && { alias }) };
  }

  castExpression(ctx: Ctx): { expression: string } {
    return { expression: formatTokens(ctxTokens(ctx)) };
  }

  /** A projection element is captured as source-like text. */
  projectionOperand(ctx: Ctx): { expression: string } {
    return { expression: formatTokens(ctxTokens(ctx)) };
  }

  // ---- Associations -----------------------------------------

  associationTail(ctx: Ctx): AssociationDeclaration {
    const associationKind: AssociationKind = asTokens(ctx.Association).length
      ? 'association'
      : 'composition';

    const cardinality = ctx.cardinality
      ? (this.visit(asNodes(ctx.cardinality)[0]) as Cardinality)
      : undefined;

    let targetMultiplicity: 'many' | 'one' | undefined;
    if (asTokens(ctx.Many).length) targetMultiplicity = 'many';
    else if (asTokens(ctx.One).length) targetMultiplicity = 'one';

    const redirected = !!asTokens(ctx.Redirected).length;

    const target = this.visit(asNodes(ctx.qualifiedName)[0]) as string;
    const aliasNode = asNodes(ctx.cdsName)[0];
    const alias = aliasNode ? (this.visit(aliasNode) as string) : undefined;
    const on = ctx.orExpression
      ? (this.visit(asNodes(ctx.orExpression)[0]) as Expr | undefined)
      : undefined;

    return {
      kind: 'association',
      associationKind,
      annotations: [], // populated by elementMember()
      ...(cardinality && { cardinality }),
      ...(targetMultiplicity && { targetMultiplicity }),
      target,
      ...(redirected && { redirected: true }),
      ...(alias && { alias }),
      ...(on && { on }),
    };
  }

  cardinality(ctx: Ctx): Cardinality {
    const nums = asTokens(ctx.NumberLiteral);
    const stars = asTokens(ctx.Star);
    if (nums.length === 0 && stars.length >= 1) {
      // `[*]`
      return { max: '*' };
    }
    if (nums.length === 1) {
      const dotCount = asTokens(ctx.Dot).length;
      if (dotCount === 0) {
        return { max: Number.parseInt(nums[0].image, 10) };
      }
      // `[N..*]`  (Star present as second operand) or `[N..M]` (handled below)
      if (stars.length >= 1) {
        return { min: Number.parseInt(nums[0].image, 10), max: '*' };
      }
      // Fallback — shouldn't happen if grammar is consistent.
      return { min: Number.parseInt(nums[0].image, 10), max: '*' };
    }
    if (nums.length === 2) {
      return {
        min: Number.parseInt(nums[0].image, 10),
        max: Number.parseInt(nums[1].image, 10),
      };
    }
    return { max: '*' };
  }

  // ---- Parameters -------------------------------------------

  parametersClause(ctx: Ctx): ParameterDefinition[] {
    return asNodes(ctx.parameterDefinition).map(
      (n) => this.visit(n) as ParameterDefinition,
    );
  }

  parameterDefinition(ctx: Ctx): ParameterDefinition {
    const annotations = asNodes(ctx.annotation).map(
      (n) => this.visit(n) as Annotation,
    );
    const name = this.visit(asNodes(ctx.cdsName)[0]) as string;
    const type = this.visit(asNodes(ctx.typeReference)[0]) as TypeRef;
    const defaultValue = ctx.literal
      ? toAnnotationValue(this.visit(asNodes(ctx.literal)[0]) as LiteralExpr)
      : undefined;
    return {
      annotations,
      name,
      type,
      ...(defaultValue && { defaultValue }),
    };
  }

  // ---- Tables / structures ----------------------------------

  tableMember(ctx: Ctx): TableMember {
    if (ctx.includeDirective) {
      return this.visit(asNodes(ctx.includeDirective)[0]) as IncludeDirective;
    }
    return this.visit(asNodes(ctx.fieldDefinition)[0]) as FieldDefinition;
  }

  includeDirective(ctx: Ctx): IncludeDirective {
    const name = this.visit(asNodes(ctx.cdsName)[0]) as string;
    const suffix = asNodes(ctx.cdsName)[1]
      ? (this.visit(asNodes(ctx.cdsName)[1]) as string)
      : undefined;
    return { kind: 'include', name, ...(suffix !== undefined && { suffix }) };
  }

  fieldDefinition(ctx: Ctx): FieldDefinition {
    const annotations: Annotation[] = asNodes(ctx.annotation).map(
      (node) => this.visit(node) as Annotation,
    );
    const isKey = !!asTokens(ctx.Key).length;
    const name = this.visit(asNodes(ctx.cdsName)[0]) as string;
    const type = this.visit(asNodes(ctx.typeReference)[0]) as TypeRef;
    const notNull = !!asTokens(ctx.Not).length;
    return { annotations, name, type, isKey, notNull };
  }

  simpleTypeDefinition(ctx: Ctx): SimpleTypeDefinition {
    const name = this.visit(asNodes(ctx.cdsName)[0]) as string;
    const type = this.visit(asNodes(ctx.typeReference)[0]) as TypeRef;
    return { kind: 'simpleType', name, annotations: [], type };
  }

  serviceDefinition(ctx: Ctx): ServiceDefinition {
    const name = this.visit(asNodes(ctx.cdsName)[0]) as string;
    const exposes = asNodes(ctx.exposeStatement).map(
      (node) => this.visit(node) as ExposeStatement,
    );
    return { kind: 'service', name, annotations: [], exposes };
  }

  exposeStatement(ctx: Ctx): ExposeStatement {
    const names = asNodes(ctx.cdsName).map((n) => this.visit(n) as string);
    const entity = names[0];
    const alias = names.length > 1 ? names[1] : undefined;
    return { entity, ...(alias && { alias }) };
  }

  // ---- DCL / roles ------------------------------------------

  roleDefinition(ctx: Ctx): RoleDefinition {
    const name = this.visit(asNodes(ctx.cdsName)[0]) as string;
    const grants = asNodes(ctx.grantStatement).map(
      (n) => this.visit(n) as GrantStatement,
    );
    return { kind: 'role', name, annotations: [], grants };
  }

  grantStatement(ctx: Ctx): GrantStatement {
    const entity = this.visit(asNodes(ctx.qualifiedName)[0]) as string;
    const where = ctx.orExpression
      ? (this.visit(asNodes(ctx.orExpression)[0]) as Expr | undefined)
      : undefined;
    return { privilege: 'select', entity, ...(where && { where }) };
  }

  // ---- Metadata extensions ----------------------------------

  annotateStatement(ctx: Ctx): MetadataExtension {
    const entity = this.visit(asNodes(ctx.cdsName)[0]) as string;
    const elements = asNodes(ctx.annotatedElement).map(
      (node) => this.visit(node) as AnnotatedElement,
    );
    return { kind: 'metadataExtension', entity, annotations: [], elements };
  }

  annotatedElement(ctx: Ctx): AnnotatedElement {
    const annotations = asNodes(ctx.annotation).map(
      (node) => this.visit(node) as Annotation,
    );
    const name = this.visit(asNodes(ctx.cdsName)[0]) as string;
    return { annotations, name };
  }

  // ---- Annotations ------------------------------------------

  topLevelAnnotation(ctx: Ctx): Annotation {
    return this.visit(asNodes(ctx.annotation)[0]) as Annotation;
  }

  annotation(ctx: Ctx): Annotation {
    const key = this.visit(asNodes(ctx.dottedName)[0]) as string;
    const value: AnnotationValue = ctx.annotationValue
      ? (this.visit(asNodes(ctx.annotationValue)[0]) as AnnotationValue)
      : { kind: 'boolean', value: true };
    return { key, value };
  }

  dottedName(ctx: Ctx): string {
    return asNodes(ctx.cdsName)
      .map((node) => this.visit(node) as string)
      .join('.');
  }

  annotationValue(ctx: Ctx): AnnotationValue {
    if (ctx.StringLiteral) {
      const raw = asTokens(ctx.StringLiteral)[0].image;
      return { kind: 'string', value: raw.slice(1, -1) };
    }
    if (ctx.EnumLiteral) {
      const raw = asTokens(ctx.EnumLiteral)[0].image;
      return { kind: 'enum', value: raw.slice(1) };
    }
    if (ctx.True) return { kind: 'boolean', value: true };
    if (ctx.False) return { kind: 'boolean', value: false };
    if (ctx.NumberLiteral) {
      return {
        kind: 'number',
        value: Number.parseFloat(asTokens(ctx.NumberLiteral)[0].image),
      };
    }
    if (ctx.annotationArray) {
      return this.visit(asNodes(ctx.annotationArray)[0]) as AnnotationValue;
    }
    return this.visit(asNodes(ctx.annotationObject)[0]) as AnnotationValue;
  }

  annotationArray(ctx: Ctx): AnnotationValue {
    const items = asNodes(ctx.annotationValue).map(
      (node) => this.visit(node) as AnnotationValue,
    );
    return { kind: 'array', items };
  }

  annotationObject(ctx: Ctx): AnnotationValue {
    const properties = asNodes(ctx.annotationProperty).map(
      (node) => this.visit(node) as AnnotationProperty,
    );
    return { kind: 'object', properties };
  }

  annotationProperty(ctx: Ctx): AnnotationProperty {
    const key = this.visit(asNodes(ctx.dottedName)[0]) as string;
    const value = this.visit(
      asNodes(ctx.annotationValue)[0],
    ) as AnnotationValue;
    return { key, value };
  }

  // ---- Literals ---------------------------------------------

  literal(ctx: Ctx): LiteralExpr {
    if (ctx.StringLiteral) {
      const raw = asTokens(ctx.StringLiteral)[0].image;
      return { kind: 'literal', literal: 'string', value: raw.slice(1, -1) };
    }
    if (ctx.NumberLiteral) {
      return {
        kind: 'literal',
        literal: 'number',
        value: Number.parseFloat(asTokens(ctx.NumberLiteral)[0].image),
      };
    }
    if (ctx.EnumLiteral) {
      // An enum literal (`#TRANSPARENT`) is kept as its source text.
      return {
        kind: 'literal',
        literal: 'string',
        value: asTokens(ctx.EnumLiteral)[0].image,
      };
    }
    if (ctx.True) return { kind: 'literal', literal: 'boolean', value: true };
    return { kind: 'literal', literal: 'boolean', value: false };
  }

  // ---- Expressions ------------------------------------------
  //
  // The expression rules are visited defensively: a broken condition must
  // not throw — the parser reports the error and the AST keeps the parts
  // that could be read.

  orExpression(ctx: Ctx): Expr | undefined {
    const parts = asNodes(ctx.andExpression);
    let result = this.visit(parts[0]) as Expr | undefined;
    for (const part of parts.slice(1)) {
      const right = this.visit(part) as Expr | undefined;
      if (!result || !right) return undefined;
      result = { kind: 'binary', op: 'or', left: result, right };
    }
    return result;
  }

  andExpression(ctx: Ctx): Expr | undefined {
    const parts = asNodes(ctx.notExpression);
    let result = this.visit(parts[0]) as Expr | undefined;
    for (const part of parts.slice(1)) {
      const right = this.visit(part) as Expr | undefined;
      if (!result || !right) return undefined;
      result = { kind: 'binary', op: 'and', left: result, right };
    }
    return result;
  }

  notExpression(ctx: Ctx): Expr | undefined {
    const operand = this.visit(asNodes(ctx.comparisonExpression)[0]) as
      Expr | undefined;
    if (!operand) return undefined;
    return asTokens(ctx.Not).length ? { kind: 'not', operand } : operand;
  }

  comparisonExpression(ctx: Ctx): Expr | undefined {
    const operands = asNodes(ctx.additiveExpression);
    const left = this.visit(operands[0]) as Expr | undefined;
    if (!left) return undefined;

    // `<operand> <operator> <operand>`
    const op = comparisonOperator(ctx);
    if (op) {
      const right = this.visit(operands[1]) as Expr | undefined;
      return right ? { kind: 'binary', op, left, right } : undefined;
    }

    // `<operand> [not] in ( <values> )`
    if (ctx.In) {
      const values = ctx.expressionList
        ? (this.visit(asNodes(ctx.expressionList)[0]) as Expr[])
        : [];
      return {
        kind: 'in',
        operand: left,
        values,
        ...(asTokens(ctx.Not).length && { negated: true }),
      };
    }

    // `<operand> is [not] null | initial`
    if (ctx.Is) {
      const negated = asTokens(ctx.Not).length > 0;
      if (ctx.Initial) {
        return { kind: 'isInitial', operand: left, negated };
      }
      return { kind: 'isNull', operand: left, negated };
    }

    return left;
  }

  additiveExpression(ctx: Ctx): Expr | undefined {
    const parts = asNodes(ctx.multiplicativeExpression);
    const operators = sortedTokens([
      ...asTokens(ctx.Plus),
      ...asTokens(ctx.Minus),
    ]);
    let result = this.visit(parts[0]) as Expr | undefined;
    for (let i = 0; i < parts.length - 1; i++) {
      const right = this.visit(parts[i + 1]) as Expr | undefined;
      if (!result || !right) return undefined;
      const op: BinaryOp = operators[i]?.image === '-' ? 'sub' : 'add';
      result = { kind: 'binary', op, left: result, right };
    }
    return result;
  }

  multiplicativeExpression(ctx: Ctx): Expr | undefined {
    const parts = asNodes(ctx.primaryExpression);
    const operators = sortedTokens([
      ...asTokens(ctx.Star),
      ...asTokens(ctx.Slash),
    ]);
    let result = this.visit(parts[0]) as Expr | undefined;
    for (let i = 0; i < parts.length - 1; i++) {
      const right = this.visit(parts[i + 1]) as Expr | undefined;
      if (!result || !right) return undefined;
      const op: BinaryOp = operators[i]?.image === '/' ? 'div' : 'mul';
      result = { kind: 'binary', op, left: result, right };
    }
    return result;
  }

  primaryExpression(ctx: Ctx): Expr | undefined {
    if (ctx.parenthesizedExpression) {
      return this.visit(asNodes(ctx.parenthesizedExpression)[0]) as
        Expr | undefined;
    }
    if (ctx.operand) {
      return this.visit(asNodes(ctx.operand)[0]) as Expr | undefined;
    }
    if (ctx.systemVariable) {
      return this.visit(asNodes(ctx.systemVariable)[0]) as Expr | undefined;
    }
    if (ctx.literal) {
      return this.visit(asNodes(ctx.literal)[0]) as Expr | undefined;
    }
    return undefined;
  }

  /** `( <expression> )` — the parentheses are grouping only. */
  parenthesizedExpression(ctx: Ctx): Expr | undefined {
    return this.visit(asNodes(ctx.orExpression)[0]) as Expr | undefined;
  }

  /** A path (`_Item.Field`) or a call (`coalesce(a, b)`). */
  operand(ctx: Ctx): Expr | undefined {
    const name = this.visit(asNodes(ctx.qualifiedName)[0]) as string;
    if (!name) return undefined;
    if (ctx.LParen) {
      const args = ctx.expressionList
        ? (this.visit(asNodes(ctx.expressionList)[0]) as Expr[])
        : [];
      return { kind: 'call', name, args };
    }
    return { kind: 'fieldRef', path: name.split('.') };
  }

  expressionList(ctx: Ctx): Expr[] {
    return asNodes(ctx.orExpression)
      .map((node) => this.visit(node) as Expr | undefined)
      .filter((expr): expr is Expr => expr !== undefined);
  }

  /** `$session.client`, `$parameters.P_X`, `$projection.Field`. */
  systemVariable(ctx: Ctx): Expr | undefined {
    const name = this.visit(asNodes(ctx.qualifiedName)[0]) as string;
    if (!name) return undefined;
    const [root, ...rest] = name.split('.');
    const path = rest.join('.');
    if (root === 'projection') return { kind: 'projectionRef', name: path };
    if (root === 'parameters') return { kind: 'paramRef', name: path };
    if (root === 'session') return { kind: 'sessionVar', name: path };
    // An unknown system variable keeps the `$` prefix in the first path
    // segment, so that no information is lost.
    return { kind: 'fieldRef', path: [`$${root}`, ...rest] };
  }

  parameterBinding(): unknown {
    // The raw binding text is read directly from the CST node.
    return null;
  }

  // ---- Type references --------------------------------------

  typeReference(ctx: Ctx): TypeRef {
    if (ctx.builtinType) {
      return this.visit(asNodes(ctx.builtinType)[0]) as BuiltinTypeRef;
    }
    return this.visit(asNodes(ctx.namedType)[0]) as NamedTypeRef;
  }

  builtinType(ctx: Ctx): BuiltinTypeRef {
    const name = this.visit(asNodes(ctx.cdsName)[0]) as string;
    const numberTokens = asTokens(ctx.NumberLiteral);
    const length = numberTokens[0]
      ? Number.parseInt(numberTokens[0].image, 10)
      : undefined;
    const decimals = numberTokens[1]
      ? Number.parseInt(numberTokens[1].image, 10)
      : undefined;
    return { kind: 'builtin', name, length, decimals };
  }

  namedType(ctx: Ctx): NamedTypeRef {
    const name = this.visit(asNodes(ctx.qualifiedName)[0]) as string;
    return { kind: 'named', name };
  }

  cdsName(ctx: Ctx): string {
    const t = ctx as Record<string, IToken[] | undefined>;
    // cdsName accepts many keyword tokens as names — return the image of
    // whichever token matched (only one key in `ctx` will be populated).
    for (const key of Object.keys(t)) {
      const tok = t[key]?.[0];
      if (tok && 'image' in tok) return tok.image;
    }
    return '';
  }

  bareAliasName(ctx: Ctx): string {
    return this.cdsName(ctx);
  }

  qualifiedName(ctx: Ctx): string {
    return asNodes(ctx.cdsName)
      .map((node) => this.visit(node) as string)
      .join('.');
  }
}

/** Singleton visitor instance */
export const cdsVisitor = new CdsVisitor();
