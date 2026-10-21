/**
 * CST → AST Visitor
 *
 * Transforms Chevrotain's Concrete Syntax Tree into our typed AST.
 */
import type { CstNode, IToken } from 'chevrotain';
import { cdsParser } from './parser';
import type {
  AbstractEntityDefinition,
  AccessPolicyDefinition,
  Annotation,
  AnnotationDefinition,
  AnnotationProperty,
  AnnotationValue,
  AnnotatedElement,
  AspectBinding,
  AspectBindingMapping,
  AspectDefinition,
  AspectElement,
  AssociationDeclaration,
  AssociationKind,
  AssociationRedirection,
  BuiltinTypeRef,
  Cardinality,
  CardinalityWord,
  CdsDefinition,
  CdsSourceFile,
  CustomEntityDefinition,
  DataSource,
  DataSourceKind,
  DataSourceParameter,
  DclOptionalElement,
  Expression,
  ExposeStatement,
  ExtensionDefinition,
  ExtendSetOperation,
  ExternalEntityDefinition,
  FieldDefinition,
  GrantStatement,
  HierarchyDefinition,
  HierarchyPeriod,
  IncludeDirective,
  InheritStatement,
  InheritingConditionsStatement,
  JoinClause,
  JoinGroup,
  JoinSource,
  JoinType,
  MetadataExtension,
  NamedTypeRef,
  ParameterDefinition,
  RedefinedAssociation,
  RoleDefinition,
  RoleMember,
  ScalarFunctionDefinition,
  SelectStatement,
  ServiceDefinition,
  SetOperation,
  SimpleTypeDefinition,
  SortItem,
  StructureDefinition,
  TableDefinition,
  TableFunctionDefinition,
  TableMember,
  TypeRef,
  ViewElement,
  ViewEntityDefinition,
  ViewMember,
  WordCardinality,
} from './ast';

// Generate the base visitor class from the parser's grammar
const BaseCstVisitor = cdsParser.getBaseCstVisitorConstructor<
  unknown,
  unknown
>();

type Ctx = Record<string, CstNode[] | IToken[] | undefined>;

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
 * and none after `(` `[` `.` `$` `:` `@` — e.g. `coalesce(a.b, c)`,
 * `$session.client`, `:P_Param`, `@Anno.value`.
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
      ['(', ',', ')', ']', '.', ':'].includes(img) ||
      out.endsWith('(') ||
      out.endsWith('[') ||
      out.endsWith('.') ||
      out.endsWith('$') ||
      out.endsWith(':') ||
      out.endsWith('@');
    out += tight ? img : ` ${img}`;
  }
  return out;
}

function toExpression(node: CstNode | undefined): Expression {
  const toks = collectTokenImages(node);
  return {
    source: formatTokens(toks),
    tokens: toks.map((t) => t.image),
  };
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

/**
 * The pieces gathered from a `projection on …` header — folded onto the
 * view's own AST fields.
 */
interface ProjectionTail {
  source: DataSource;
  associations: AssociationDeclaration[];
  redefinedAssociations: RedefinedAssociation[];
  aspectBindings: AspectBinding[];
  members: ViewMember[];
  where?: Expression;
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
    if (ctx.extendStatement) {
      return this.visit(asNodes(ctx.extendStatement)[0]) as ExtensionDefinition;
    }
    return this.visit(asNodes(ctx.annotateStatement)[0]) as CdsDefinition;
  }

  defineStatement(ctx: Ctx): CdsDefinition {
    const dispatch: Array<undefined | CstNode> = [
      asNodes(ctx.prefixedDefinition)[0],
      asNodes(ctx.tableDefinition)[0],
      asNodes(ctx.structureDefinition)[0],
      asNodes(ctx.viewEntityDefinition)[0],
      asNodes(ctx.abstractEntityDefinition)[0],
      asNodes(ctx.customEntityDefinition)[0],
      asNodes(ctx.simpleTypeDefinition)[0],
      asNodes(ctx.serviceDefinition)[0],
      asNodes(ctx.roleDefinition)[0],
      asNodes(ctx.hierarchyDefinition)[0],
      asNodes(ctx.aspectDefinition)[0],
      asNodes(ctx.externalEntityDefinition)[0],
      asNodes(ctx.scalarFunctionDefinition)[0],
      asNodes(ctx.annotationDefinition)[0],
      asNodes(ctx.accessPolicyDefinition)[0],
    ];
    for (const node of dispatch) {
      if (node) return this.visit(node) as CdsDefinition;
    }
    // should not happen
    return { kind: 'table', name: '', annotations: [], members: [] };
  }

  /**
   * `define (writable|root)+ <view|external entity|table entity>` — applies
   * the leading modifiers to whichever entity form followed them.
   */
  prefixedDefinition(ctx: Ctx): CdsDefinition {
    const writable = !!asTokens(ctx.Writable).length;
    const root = !!asTokens(ctx.Root).length;
    const node =
      asNodes(ctx.viewEntityDefinition)[0] ??
      asNodes(ctx.externalEntityDefinition)[0] ??
      asNodes(ctx.rootTableEntityDefinition)[0];
    const def = this.visit(node) as CdsDefinition;
    if (root) {
      (def as { root?: boolean }).root = true;
    }
    if (writable) {
      (def as { writable?: boolean }).writable = true;
    }
    return def;
  }

  rootTableEntityDefinition(ctx: Ctx): TableDefinition {
    const name = this.visit(asNodes(ctx.cdsName)[0]) as string;
    const members = asNodes(ctx.tableMember).map(
      (node) => this.visit(node) as TableMember,
    );
    return {
      kind: 'table',
      name,
      annotations: [],
      entity: true,
      root: true,
      members,
    };
  }

  // ---- Tables / table entities / table functions -------------

  tableDefinition(ctx: Ctx): TableDefinition | TableFunctionDefinition {
    if (ctx.tableFunctionTail) {
      return this.visit(
        asNodes(ctx.tableFunctionTail)[0],
      ) as TableFunctionDefinition;
    }
    const name = this.visit(asNodes(ctx.cdsName)[0]) as string;
    const members = asNodes(ctx.tableMember).map(
      (node) => this.visit(node) as TableMember,
    );
    const entity = !!asTokens(ctx.Entity).length;
    return {
      kind: 'table',
      name,
      annotations: [],
      ...(entity && { entity: true }),
      members,
    };
  }

  tableFunctionTail(ctx: Ctx): TableFunctionDefinition {
    const name = this.visit(asNodes(ctx.cdsName)[0]) as string;
    const parameters = ctx.parametersClause
      ? (this.visit(asNodes(ctx.parametersClause)[0]) as ParameterDefinition[])
      : [];
    const members = asNodes(ctx.fieldDefinition).map(
      (node) => this.visit(node) as FieldDefinition,
    );
    const implementingClass = this.visit(
      asNodes(ctx.qualifiedName)[0],
    ) as string;
    const implementingMethod = asNodes(ctx.cdsName)[1]
      ? (this.visit(asNodes(ctx.cdsName)[1]) as string)
      : undefined;
    return {
      kind: 'tableFunction',
      name,
      annotations: [],
      parameters,
      members,
      implementingClass,
      ...(implementingMethod && { implementingMethod }),
    };
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
    // `define view <name>` (legacy classic SQL view) vs
    // `define view entity <name>` — `entity` is the modifier iff followed by
    // another name (the parser disambiguates); a missing Entity token means
    // the legacy form.
    const legacy = asTokens(ctx.Entity).length === 0;
    const names = asNodes(ctx.cdsName).map((n) => this.visit(n) as string);
    const name = names[0] ?? '';
    const providerContract = ctx.Contract ? names[1] : undefined;
    const parameters = ctx.parametersClause
      ? (this.visit(asNodes(ctx.parametersClause)[0]) as ParameterDefinition[])
      : [];

    let sourceKind: DataSourceKind = 'select';
    let distinct = false;
    let source: DataSource = { name: '' };
    let joins: JoinClause[] = [];
    let fromAssociations: AssociationDeclaration[] = [];
    let redefinedAssociations: RedefinedAssociation[] = [];
    let aspectBindings: AspectBinding[] = [];
    let members: ViewMember[] = [];
    let where: Expression | undefined;
    let groupBy: string[] | undefined;
    let having: Expression | undefined;
    let setOperations: SetOperation[] | undefined;

    if (ctx.selectStatement) {
      sourceKind = 'select';
      const select = this.visit(
        asNodes(ctx.selectStatement)[0],
      ) as SelectStatement;
      distinct = !!select.distinct;
      source = select.source;
      joins = select.joins;
      fromAssociations = select.fromAssociations ?? [];
      aspectBindings = select.aspectBindings ?? [];
      members = select.members;
      where = select.where;
      groupBy = select.groupBy;
      having = select.having;
      setOperations = select.setOperations;
    } else if (ctx.projectionTail) {
      sourceKind = 'projection';
      const proj = this.visit(asNodes(ctx.projectionTail)[0]) as ProjectionTail;
      source = proj.source;
      fromAssociations = proj.associations;
      redefinedAssociations = proj.redefinedAssociations;
      aspectBindings = proj.aspectBindings;
      members = proj.members;
      where = proj.where;
    }

    return {
      kind: 'viewEntity',
      name,
      annotations: [],
      sourceKind,
      source,
      joins,
      parameters,
      members,
      ...(legacy && { legacy: true }),
      ...(distinct && { distinct: true }),
      ...(providerContract && { providerContract }),
      ...(fromAssociations.length > 0 && { fromAssociations }),
      ...(redefinedAssociations.length > 0 && { redefinedAssociations }),
      ...(aspectBindings.length > 0 && { aspectBindings }),
      ...(where && { where }),
      ...(groupBy && { groupBy }),
      ...(having && { having }),
      ...(setOperations && setOperations.length > 0 && { setOperations }),
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

  externalEntityDefinition(ctx: Ctx): ExternalEntityDefinition {
    const names = asNodes(ctx.cdsName).map((n) => this.visit(n) as string);
    const name = names[0] ?? '';
    const externalName = ctx.Name ? names[1] : undefined;
    const parameters = ctx.parametersClause
      ? (this.visit(asNodes(ctx.parametersClause)[0]) as ParameterDefinition[])
      : [];
    const members = asNodes(ctx.fieldDefinition).map(
      (node) => this.visit(node) as FieldDefinition,
    );
    return {
      kind: 'externalEntity',
      name,
      annotations: [],
      parameters,
      members,
      ...(externalName && { externalName }),
    };
  }

  // ---- SELECT / projection tails ----------------------------

  selectStatement(ctx: Ctx): SelectStatement {
    const distinct = !!asTokens(ctx.Distinct).length;
    const source = this.visit(asNodes(ctx.dataSource)[0]) as DataSource;
    const joins = asNodes(ctx.joinClause).map(
      (node) => this.visit(node) as JoinClause,
    );
    const fromAssociations = asNodes(ctx.associationTail).map(
      (node) => this.visit(node) as AssociationDeclaration,
    );
    const aspectBindings = asNodes(ctx.bindAspect).map(
      (node) => this.visit(node) as AspectBinding,
    );
    const members = ctx.elementList
      ? (this.visit(asNodes(ctx.elementList)[0]) as ViewMember[])
      : [];
    const clauses = ctx.selectClauses
      ? (this.visit(asNodes(ctx.selectClauses)[0]) as {
          where?: Expression;
          groupBy?: string[];
          having?: Expression;
          setOperations?: SetOperation[];
        })
      : {};
    return {
      kind: 'selectStatement',
      ...(distinct && { distinct: true }),
      source,
      joins,
      ...(fromAssociations.length > 0 && { fromAssociations }),
      ...(aspectBindings.length > 0 && { aspectBindings }),
      members,
      ...(clauses.where && { where: clauses.where }),
      ...(clauses.groupBy && { groupBy: clauses.groupBy }),
      ...(clauses.having && { having: clauses.having }),
      ...(clauses.setOperations &&
        clauses.setOperations.length > 0 && {
          setOperations: clauses.setOperations,
        }),
    };
  }

  selectClauses(ctx: Ctx): {
    where?: Expression;
    groupBy?: string[];
    having?: Expression;
    setOperations?: SetOperation[];
  } {
    const conditions = asNodes(ctx.condition);
    const groupBy = asNodes(ctx.qualifiedName).map(
      (n) => this.visit(n) as string,
    );
    // `where` is the first condition, `having` the second (when present).
    const where = ctx.Where ? toExpression(conditions[0]) : undefined;
    const having = ctx.Having
      ? toExpression(conditions[ctx.Where ? 1 : 0])
      : undefined;
    const setOperations = asNodes(ctx.setOperation).map(
      (n) => this.visit(n) as SetOperation,
    );
    return {
      ...(where && { where }),
      ...(groupBy.length > 0 && { groupBy }),
      ...(having && { having }),
      ...(setOperations.length > 0 && { setOperations }),
    };
  }

  setOperation(ctx: Ctx): SetOperation {
    const operator = ctx.Union
      ? ctx.All
        ? 'unionAll'
        : 'union'
      : ctx.Intersect
        ? 'intersect'
        : 'except';
    const statement = this.visit(
      asNodes(ctx.selectStatement)[0],
    ) as SelectStatement;
    return { kind: 'setOperation', operator, statement };
  }

  projectionTail(ctx: Ctx): ProjectionTail {
    const source = this.visit(asNodes(ctx.dataSource)[0]) as DataSource;
    const associations = asNodes(ctx.associationTail).map(
      (node) => this.visit(node) as AssociationDeclaration,
    );
    const redefinedAssociations = asNodes(ctx.redefinedAssociation).map(
      (node) => this.visit(node) as RedefinedAssociation,
    );
    const aspectBindings = asNodes(ctx.bindAspect).map(
      (node) => this.visit(node) as AspectBinding,
    );
    const members = ctx.elementList
      ? (this.visit(asNodes(ctx.elementList)[0]) as ViewMember[])
      : [];
    const where = ctx.condition
      ? toExpression(asNodes(ctx.condition)[0])
      : undefined;
    return {
      source,
      associations,
      redefinedAssociations,
      aspectBindings,
      members,
      ...(where && { where }),
    };
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

  parameterBinding(): unknown {
    // The raw binding text is read directly from the CST node.
    return null;
  }

  // ---- Joins -------------------------------------------------

  joinClause(ctx: Ctx): JoinClause {
    if (ctx.Cross) {
      // A cross join never carries an ON condition.
      const source = this.visit(asNodes(ctx.joinOperand)[0]) as JoinSource;
      return { kind: 'join', joinType: 'cross', source };
    }
    const prefix = this.visit(asNodes(ctx.joinPrefix)[0]) as {
      joinType: JoinType;
      cardinality?: WordCardinality;
    };
    const source = this.visit(asNodes(ctx.joinOperand)[0]) as JoinSource;
    const on = toExpression(asNodes(ctx.condition)[0]);
    return {
      kind: 'join',
      joinType: prefix.joinType,
      source,
      on,
      ...(prefix.cardinality && { cardinality: prefix.cardinality }),
    } as JoinClause;
  }

  joinPrefix(ctx: Ctx): {
    joinType: JoinType;
    cardinality?: WordCardinality;
  } {
    const joinType: JoinType = asTokens(ctx.Full).length
      ? 'fullOuter'
      : asTokens(ctx.Left).length
        ? 'leftOuter'
        : asTokens(ctx.Right).length
          ? 'rightOuter'
          : 'inner';
    const cardinality = ctx.joinCardinality
      ? (this.visit(asNodes(ctx.joinCardinality)[0]) as WordCardinality)
      : undefined;
    return { joinType, ...(cardinality && { cardinality }) };
  }

  joinCardinality(ctx: Ctx): WordCardinality {
    const words = asNodes(ctx.cardinalWord).map(
      (n) => this.visit(n) as CardinalityWord,
    );
    // `[src] to tgt` — two words means a source bound was given.
    if (words.length === 2) {
      return { source: words[0], target: words[1] };
    }
    return { target: words[0] };
  }

  cardinalWord(ctx: Ctx): CardinalityWord {
    if (asTokens(ctx.Exact).length) return 'exactOne';
    if (asTokens(ctx.Many).length) return 'many';
    return 'one';
  }

  joinOperand(ctx: Ctx): JoinSource {
    if (ctx.joinGroup) {
      return this.visit(asNodes(ctx.joinGroup)[0]) as JoinGroup;
    }
    return this.visit(asNodes(ctx.dataSource)[0]) as DataSource;
  }

  joinGroup(ctx: Ctx): JoinGroup {
    const source = this.visit(asNodes(ctx.joinOperand)[0]) as JoinSource;
    const joins = asNodes(ctx.joinClause).map(
      (node) => this.visit(node) as JoinClause,
    );
    return { kind: 'joinGroup', source, joins };
  }

  // ---- Elements ----------------------------------------------

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
    const proj = this.visit(asNodes(ctx.elementExpression)[0]) as {
      expression: string;
      alias?: string;
      localized?: boolean;
      redirectedTo?: AssociationRedirection;
    };
    return {
      annotations: [],
      isKey,
      isVirtual,
      isRedirected,
      expression: proj.expression,
      ...(proj.alias && { alias: proj.alias }),
      ...(proj.localized && { localized: true }),
      ...(proj.redirectedTo && { redirectedTo: proj.redirectedTo }),
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

  elementExpression(ctx: Ctx): {
    expression: string;
    alias?: string;
    localized?: boolean;
    redirectedTo?: AssociationRedirection;
  } {
    // The expression text is everything of the operand — formatted from its
    // own tokens so aliases/suffixes are excluded.
    const expression = formatTokens(
      collectTokenImages(asNodes(ctx.operand)[0]),
    );
    const aliasNode = asNodes(ctx.cdsName)[0];
    const alias = aliasNode ? (this.visit(aliasNode) as string) : undefined;
    const localized = !!asTokens(ctx.Localized).length;
    const redirectedTo = ctx.redirection
      ? (this.visit(asNodes(ctx.redirection)[0]) as AssociationRedirection)
      : undefined;
    return {
      expression,
      ...(alias && { alias }),
      ...(localized && { localized: true }),
      ...(redirectedTo && { redirectedTo }),
    };
  }

  redirection(ctx: Ctx): AssociationRedirection {
    const mode = ctx.Composition
      ? 'compositionChild'
      : ctx.Parent
        ? 'parent'
        : 'default';
    const target = this.visit(asNodes(ctx.qualifiedName)[0]) as string;
    return { mode, target };
  }

  redefinedAssociation(ctx: Ctx): RedefinedAssociation {
    const associationKind: AssociationKind = asTokens(ctx.Association).length
      ? 'association'
      : 'composition';
    const name = this.visit(asNodes(ctx.qualifiedName)[0]) as string;
    const aliasNode = asNodes(ctx.cdsName)[0];
    const alias = aliasNode ? (this.visit(aliasNode) as string) : undefined;
    const filter = ctx.bracketTokens
      ? toExpression(asNodes(ctx.bracketTokens)[0])
      : undefined;
    const redirectedTo = ctx.redirection
      ? (this.visit(asNodes(ctx.redirection)[0]) as AssociationRedirection)
      : undefined;
    return {
      kind: 'redefinedAssociation',
      associationKind,
      name,
      ...(filter && { filter }),
      ...(alias && { alias }),
      ...(redirectedTo && { redirectedTo }),
    };
  }

  bindAspect(ctx: Ctx): AspectBinding {
    const aspect = this.visit(asNodes(ctx.qualifiedName)[0]) as string;
    const mappings = asNodes(ctx.bindMapping).map(
      (n) => this.visit(n) as AspectBindingMapping,
    );
    const aliasNode = asNodes(ctx.cdsName)[0];
    const alias = aliasNode ? (this.visit(aliasNode) as string) : undefined;
    return {
      kind: 'aspectBinding',
      aspect,
      mappings,
      ...(alias && { alias }),
    };
  }

  bindMapping(ctx: Ctx): AspectBindingMapping {
    const element = this.visit(asNodes(ctx.cdsName)[0]) as string;
    const target = formatTokens(collectTokenImages(asNodes(ctx.operand)[0]));
    return { element, target };
  }

  // ---- Associations -------------------------------------------

  associationTail(ctx: Ctx): AssociationDeclaration {
    const associationKind: AssociationKind = asTokens(ctx.Association).length
      ? 'association'
      : 'composition';

    const cardinality = ctx.cardinality
      ? (this.visit(asNodes(ctx.cardinality)[0]) as Cardinality)
      : undefined;

    // Word-form cardinality — at most one `cardinalWord` per branch:
    // `of <w> X`, `of <w> to X`, `to <w> X` all give a single target word.
    const words = asNodes(ctx.cardinalWord).map(
      (n) => this.visit(n) as CardinalityWord,
    );
    let wordCardinality: WordCardinality | undefined;
    let targetMultiplicity: 'many' | 'one' | undefined;
    if (words.length === 1) {
      wordCardinality = { target: words[0] };
      if (words[0] === 'many' || words[0] === 'one') {
        targetMultiplicity = words[0];
      }
    }

    const toParent = !!asTokens(ctx.Parent).length;
    const redirected = !!asTokens(ctx.Redirected).length;

    const target = this.visit(asNodes(ctx.qualifiedName)[0]) as string;
    const aliasNode = asNodes(ctx.cdsName)[0];
    const alias = aliasNode ? (this.visit(aliasNode) as string) : undefined;
    const conditions = asNodes(ctx.condition);
    const on = conditions[0] ? toExpression(conditions[0]) : undefined;
    const withDefaultFilter = conditions[1]
      ? toExpression(conditions[1])
      : undefined;

    return {
      kind: 'association',
      associationKind,
      annotations: [], // populated by elementMember()
      ...(cardinality && { cardinality }),
      ...(wordCardinality && { wordCardinality }),
      ...(targetMultiplicity && { targetMultiplicity }),
      ...(toParent && { toParent: true }),
      target,
      ...(redirected && { redirected: true }),
      ...(alias && { alias }),
      ...(on && { on }),
      ...(withDefaultFilter && { withDefaultFilter }),
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
      // `[N..*]` or `[N..M]` (M handled below)
      if (stars.length >= 1) {
        return { min: Number.parseInt(nums[0].image, 10), max: '*' };
      }
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

  // ---- Parameters ---------------------------------------------

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
      ? (this.visit(asNodes(ctx.literal)[0]) as AnnotationValue)
      : undefined;
    return {
      annotations,
      name,
      type,
      ...(defaultValue && { defaultValue }),
    };
  }

  // ---- Tables / structures ------------------------------------

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

  scalarFunctionDefinition(ctx: Ctx): ScalarFunctionDefinition {
    const name = this.visit(asNodes(ctx.cdsName)[0]) as string;
    const parameters = ctx.parametersClause
      ? (this.visit(asNodes(ctx.parametersClause)[0]) as ParameterDefinition[])
      : [];
    const returnType = this.visit(asNodes(ctx.typeReference)[0]) as TypeRef;
    return {
      kind: 'scalarFunction',
      name,
      annotations: [],
      parameters,
      returnType,
    };
  }

  // ---- Hierarchy ----------------------------------------------

  hierarchyDefinition(ctx: Ctx): HierarchyDefinition {
    const name = this.visit(asNodes(ctx.cdsName)[0]) as string;
    const parameters = ctx.parametersClause
      ? (this.visit(asNodes(ctx.parametersClause)[0]) as ParameterDefinition[])
      : [];
    const source = (this.visit(asNodes(ctx.qualifiedName)[0]) as string) ?? '';
    const childToParentAssociation = asNodes(ctx.cdsName)[1]
      ? (this.visit(asNodes(ctx.cdsName)[1]) as string)
      : undefined;

    const period = ctx.hierarchyPeriod
      ? (this.visit(asNodes(ctx.hierarchyPeriod)[0]) as HierarchyPeriod)
      : undefined;
    const directory = ctx.hierarchyDirectory
      ? (this.visit(asNodes(ctx.hierarchyDirectory)[0]) as {
          entity: string;
          filter: Expression;
        })
      : undefined;
    const startWhere = ctx.hierarchyStart
      ? (this.visit(asNodes(ctx.hierarchyStart)[0]) as Expression)
      : undefined;

    const siblingsOrderBy = asNodes(ctx.sortItem).map(
      (n) => this.visit(n) as SortItem,
    );

    const depth = ctx.hierarchyDepth
      ? (this.visit(asNodes(ctx.hierarchyDepth)[0]) as string)
      : undefined;
    const nodetype = ctx.hierarchyNodetype
      ? (this.visit(asNodes(ctx.hierarchyNodetype)[0]) as string)
      : undefined;
    const load = ctx.hierarchyLoad
      ? (this.visit(asNodes(ctx.hierarchyLoad)[0]) as string)
      : undefined;
    const multipleParents = ctx.hierarchyMultiple
      ? (this.visit(
          asNodes(ctx.hierarchyMultiple)[0],
        ) as HierarchyDefinition['multipleParents'])
      : undefined;
    const orphans = ctx.hierarchyOrphans
      ? (this.visit(
          asNodes(ctx.hierarchyOrphans)[0],
        ) as HierarchyDefinition['orphans'])
      : undefined;
    const cycles = ctx.hierarchyCycles
      ? (this.visit(
          asNodes(ctx.hierarchyCycles)[0],
        ) as HierarchyDefinition['cycles'])
      : undefined;
    const cache = ctx.hierarchyCache
      ? (this.visit(
          asNodes(ctx.hierarchyCache)[0],
        ) as HierarchyDefinition['cache'])
      : undefined;

    const members = ctx.elementList
      ? (this.visit(asNodes(ctx.elementList)[0]) as ViewMember[])
      : [];

    return {
      kind: 'hierarchy',
      name,
      annotations: [],
      parameters,
      source,
      ...(childToParentAssociation && { childToParentAssociation }),
      ...(period && { period }),
      ...(directory && { directory }),
      ...(startWhere && { startWhere }),
      siblingsOrderBy,
      ...(depth !== undefined && { depth }),
      ...(nodetype && { nodetype }),
      ...(load && { load }),
      ...(multipleParents && { multipleParents }),
      ...(orphans && { orphans }),
      ...(cycles && { cycles }),
      ...(ctx.hierarchyGenerate && { generateSpantree: true }),
      ...(cache && { cache }),
      members,
    };
  }

  hierarchyPeriod(ctx: Ctx): HierarchyPeriod {
    const names = asNodes(ctx.qualifiedName).map(
      (n) => this.visit(n) as string,
    );
    const period: HierarchyPeriod = {
      from: names[0] ?? '',
      to: names[1] ?? '',
    };
    if (ctx.Valid) {
      period.validFrom = names[2] ?? '';
      period.validTo = names[3] ?? '';
    }
    return period;
  }

  hierarchyDirectory(ctx: Ctx): { entity: string; filter: Expression } {
    const entity = this.visit(asNodes(ctx.qualifiedName)[0]) as string;
    const filter = toExpression(asNodes(ctx.condition)[0]);
    return { entity, filter };
  }

  hierarchyStart(ctx: Ctx): Expression {
    return toExpression(asNodes(ctx.condition)[0]);
  }

  hierarchyDepth(ctx: Ctx): string {
    const num = asTokens(ctx.NumberLiteral)[0];
    if (num) return num.image;
    return this.visit(asNodes(ctx.qualifiedName)[0]) as string;
  }

  hierarchyNodetype(ctx: Ctx): string {
    return this.visit(asNodes(ctx.qualifiedName)[0]) as string;
  }

  hierarchyLoad(ctx: Ctx): string {
    if (asTokens(ctx.Bulk).length) return 'bulk';
    if (asTokens(ctx.Incremental).length) return 'incremental';
    if (ctx.systemVariable) {
      return formatTokens(collectTokenImages(asNodes(ctx.systemVariable)[0]));
    }
    return this.visit(asNodes(ctx.qualifiedName)[0]) as string;
  }

  hierarchyMultiple(ctx: Ctx): HierarchyDefinition['multipleParents'] {
    if (asTokens(ctx.Not).length) return 'notAllowed';
    if (asTokens(ctx.Leaves).length) return 'leavesOnly';
    return 'allowed';
  }

  hierarchyOrphans(ctx: Ctx): HierarchyDefinition['orphans'] {
    if (asTokens(ctx.Ignore).length) return 'ignore';
    if (asTokens(ctx.Error).length) return 'error';
    return 'root';
  }

  hierarchyCycles(ctx: Ctx): HierarchyDefinition['cycles'] {
    return asTokens(ctx.Breakup).length ? 'breakup' : 'error';
  }

  hierarchyGenerate(): unknown {
    return null;
  }

  hierarchyCache(ctx: Ctx): HierarchyDefinition['cache'] {
    if (asTokens(ctx.Off).length) return 'off';
    if (asTokens(ctx.Force).length) return 'force';
    return 'on';
  }

  sortItem(ctx: Ctx): SortItem {
    const name = this.visit(asNodes(ctx.qualifiedName)[0]) as string;
    const direction = asTokens(ctx.Descending).length
      ? 'descending'
      : asTokens(ctx.Ascending).length
        ? 'ascending'
        : undefined;
    return { name, ...(direction && { direction }) };
  }

  // ---- Aspect -------------------------------------------------

  aspectDefinition(ctx: Ctx): AspectDefinition {
    const name = this.visit(asNodes(ctx.cdsName)[0]) as string;
    const members = asNodes(ctx.aspectElement).map(
      (n) => this.visit(n) as AspectElement,
    );
    return { kind: 'aspect', name, annotations: [], members };
  }

  aspectElement(ctx: Ctx): AspectElement {
    const annotations = asNodes(ctx.annotation).map(
      (n) => this.visit(n) as Annotation,
    );
    const isKey = !!asTokens(ctx.Key).length;
    const name = this.visit(asNodes(ctx.cdsName)[0]) as string;
    if (ctx.typeReference) {
      const type = this.visit(asNodes(ctx.typeReference)[0]) as TypeRef;
      return { annotations, name, isKey, type };
    }
    const expression = formatTokens(
      collectTokenImages(asNodes(ctx.operand)[0]),
    );
    return { annotations, name, isKey, expression };
  }

  // ---- DDLA / access policy (opaque blocks) -------------------

  annotationDefinition(ctx: Ctx): AnnotationDefinition {
    const name = this.visit(asNodes(ctx.cdsName)[0]) as string;
    const bodyNode = asNodes(ctx.tokenBlock)[0] ?? asNodes(ctx.simpleTail)[0];
    const body = formatTokens(collectTokenImages(bodyNode));
    return { kind: 'annotationDefinition', name, annotations: [], body };
  }

  accessPolicyDefinition(ctx: Ctx): AccessPolicyDefinition {
    const name = this.visit(asNodes(ctx.cdsName)[0]) as string;
    const body = formatTokens(collectTokenImages(asNodes(ctx.tokenBlock)[0]));
    return { kind: 'accessPolicy', name, annotations: [], body };
  }

  tokenBlock(): unknown {
    // Body is captured via collectTokenImages at the definition level.
    return null;
  }

  tokenGroup(): unknown {
    return null;
  }

  simpleTail(): unknown {
    return null;
  }

  // ---- DCL / roles ---------------------------------------------

  roleDefinition(ctx: Ctx): RoleDefinition {
    const name = this.visit(asNodes(ctx.cdsName)[0]) as string;
    const switchable = !!asTokens(ctx.Switchable).length;
    const members = asNodes(ctx.roleMember).map(
      (n) => this.visit(n) as RoleMember,
    );
    const grants = members.filter((m): m is GrantStatement => 'privilege' in m);
    return {
      kind: 'role',
      name,
      annotations: [],
      ...(switchable && { switchable: true }),
      grants,
      members,
    };
  }

  roleMember(ctx: Ctx): RoleMember {
    if (ctx.inheritStatement) {
      return this.visit(asNodes(ctx.inheritStatement)[0]) as InheritStatement;
    }
    if (ctx.inheritingStatement) {
      return this.visit(
        asNodes(ctx.inheritingStatement)[0],
      ) as InheritingConditionsStatement;
    }
    return this.visit(asNodes(ctx.grantStatement)[0]) as GrantStatement;
  }

  grantStatement(ctx: Ctx): GrantStatement {
    const entity = this.visit(asNodes(ctx.qualifiedName)[0]) as string;
    const result: GrantStatement = { privilege: 'select', entity };
    for (const clauseNode of asNodes(ctx.grantClause)) {
      const clause = this.visit(clauseNode) as {
        optionalElements?: DclOptionalElement[];
        combinationMode?: 'or' | 'and' | 'redefinition';
        inheritRole?: string;
        inheritConditionConnector?: 'and' | 'or';
        inheritCondition?: Expression;
        where?: Expression;
      };
      if (clause.optionalElements) {
        result.optionalElements = clause.optionalElements;
      }
      if (clause.combinationMode) {
        result.combinationMode = clause.combinationMode;
      }
      if (clause.inheritRole) {
        result.inheritRole = clause.inheritRole;
      }
      if (clause.inheritConditionConnector) {
        result.inheritConditionConnector = clause.inheritConditionConnector;
        result.inheritCondition = clause.inheritCondition;
      }
      if (clause.where) {
        result.where = clause.where;
      }
    }
    return result;
  }

  grantClause(ctx: Ctx): Record<string, unknown> {
    for (const key of Object.keys(ctx)) {
      const node = asNodes(ctx[key])[0];
      if (node) return this.visit(node) as Record<string, unknown>;
    }
    return {};
  }

  grantOptionalElements(ctx: Ctx): { optionalElements: DclOptionalElement[] } {
    return {
      optionalElements: asNodes(ctx.optionalElement).map(
        (n) => this.visit(n) as DclOptionalElement,
      ),
    };
  }

  grantCombination(ctx: Ctx): {
    combinationMode: 'or' | 'and' | 'redefinition';
  } {
    const combinationMode = ctx.Redefinition
      ? 'redefinition'
      : ctx.Or
        ? 'or'
        : 'and';
    return { combinationMode };
  }

  grantInherit(ctx: Ctx): {
    inheritRole: string;
    inheritConditionConnector?: 'and' | 'or';
    inheritCondition?: Expression;
  } {
    const inheritRole = this.visit(asNodes(ctx.qualifiedName)[0]) as string;
    const inheritConditionConnector = ctx.dclCondition
      ? asTokens(ctx.And).length
        ? ('and' as const)
        : ('or' as const)
      : undefined;
    return {
      inheritRole,
      ...(inheritConditionConnector && { inheritConditionConnector }),
      ...(ctx.dclCondition && {
        inheritCondition: toExpression(asNodes(ctx.dclCondition)[0]),
      }),
    };
  }

  grantWhere(ctx: Ctx): { where: Expression } {
    return { where: toExpression(asNodes(ctx.dclCondition)[0]) };
  }

  optionalElement(ctx: Ctx): DclOptionalElement {
    const name = this.visit(asNodes(ctx.qualifiedName)[0]) as string;
    const def = ctx.Default ? asTokens(ctx.True).length > 0 : undefined;
    return { name, ...(def !== undefined && { default: def }) };
  }

  inheritStatement(ctx: Ctx): InheritStatement {
    const names = asNodes(ctx.qualifiedName).map(
      (n) => this.visit(n) as string,
    );
    const where = ctx.dclCondition
      ? toExpression(asNodes(ctx.dclCondition)[0])
      : undefined;
    return {
      role: names[0] ?? '',
      ...(names.length > 1 && { entity: names[1] }),
      ...(where && { where }),
    };
  }

  inheritingStatement(ctx: Ctx): InheritingConditionsStatement {
    const sourceKind = ctx.Entity ? 'entity' : 'super';
    const entity = ctx.Entity
      ? (this.visit(asNodes(ctx.qualifiedName)[0]) as string)
      : undefined;
    const def = ctx.Default ? asTokens(ctx.True).length > 0 : undefined;
    const condition = ctx.dclCondition
      ? toExpression(asNodes(ctx.dclCondition)[0])
      : undefined;
    return {
      sourceKind,
      ...(entity && { entity }),
      ...(def !== undefined && { default: def }),
      ...(condition && { condition }),
    };
  }

  dclCondition(): unknown {
    // Captured via toExpression() on the raw CstNode.
    return null;
  }

  // ---- Extensions ----------------------------------------------

  extendStatement(ctx: Ctx): ExtensionDefinition {
    const names = asNodes(ctx.qualifiedName).map(
      (n) => this.visit(n) as string,
    );
    const targetKind: ExtensionDefinition['targetKind'] = ctx.View
      ? 'view'
      : ctx.Abstract
        ? 'abstract'
        : 'custom';
    const isViewEntity = !!asTokens(ctx.Entity).length;
    const name = names[0] ?? '';
    const associations = asNodes(ctx.associationTail).map(
      (node) => this.visit(node) as AssociationDeclaration,
    );
    const members = ctx.elementList
      ? (this.visit(asNodes(ctx.elementList)[0]) as ViewMember[])
      : [];
    const groupBy = ctx.Group ? names.slice(1) : undefined;
    const setOperations = asNodes(ctx.extendSetOperation).map(
      (n) => this.visit(n) as ExtendSetOperation,
    );
    return {
      kind: 'extension',
      name,
      annotations: [],
      targetKind,
      ...(isViewEntity && { isViewEntity: true }),
      associations,
      members,
      ...(groupBy && groupBy.length > 0 && { groupBy }),
      ...(setOperations.length > 0 && { setOperations }),
    };
  }

  extendSetOperation(ctx: Ctx): ExtendSetOperation {
    const operator = ctx.Union
      ? ctx.All
        ? 'unionAll'
        : 'union'
      : ctx.Intersect
        ? 'intersect'
        : 'except';
    const members = ctx.elementList
      ? (this.visit(asNodes(ctx.elementList)[0]) as ViewMember[])
      : [];
    return { kind: 'extendSetOperation', operator, members };
  }

  // ---- Metadata extensions --------------------------------------

  annotateStatement(ctx: Ctx): MetadataExtension {
    const targetKind = ctx.View ? 'view' : 'entity';
    const entity = this.visit(asNodes(ctx.cdsName)[0]) as string;
    const elements = asNodes(ctx.annotatedElement).map(
      (node) => this.visit(node) as AnnotatedElement,
    );
    return {
      kind: 'metadataExtension',
      targetKind,
      entity,
      annotations: [],
      elements,
    };
  }

  annotatedElement(ctx: Ctx): AnnotatedElement {
    const annotations = asNodes(ctx.annotation).map(
      (node) => this.visit(node) as Annotation,
    );
    const name = this.visit(asNodes(ctx.qualifiedName)[0]) as string;
    return { annotations, name };
  }

  // ---- Annotations ----------------------------------------------

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

  // ---- Literals ------------------------------------------------

  literal(ctx: Ctx): AnnotationValue {
    const negative = !!asTokens(ctx.Minus).length;
    if (ctx.StringLiteral) {
      const raw = asTokens(ctx.StringLiteral)[0].image;
      // A typed literal (`abap.dats'…'`) keeps its raw text.
      if (ctx.Abap) {
        return { kind: 'string', value: formatTokens(ctxTokens(ctx)) };
      }
      return { kind: 'string', value: raw.slice(1, -1) };
    }
    if (ctx.EnumLiteral) {
      const raw = asTokens(ctx.EnumLiteral)[0].image;
      return { kind: 'enum', value: raw.slice(1) };
    }
    if (ctx.True) return { kind: 'boolean', value: true };
    if (ctx.False) return { kind: 'boolean', value: false };
    if (ctx.Null) return { kind: 'string', value: 'null' };
    const num = Number.parseFloat(asTokens(ctx.NumberLiteral)[0].image);
    return { kind: 'number', value: negative ? -num : num };
  }

  // ---- Expressions (opaque) -------------------------------------

  condition(): unknown {
    // Captured via toExpression() on the raw CstNode.
    return null;
  }

  conditionOperand(): unknown {
    return null;
  }

  predicate(): unknown {
    return null;
  }

  expression(): unknown {
    return null;
  }

  comparison(): unknown {
    return null;
  }

  operand(): unknown {
    return null;
  }

  primary(): unknown {
    return null;
  }

  pathOperand(): unknown {
    return null;
  }

  pathSegment(): unknown {
    return null;
  }

  bracketTokens(): unknown {
    return null;
  }

  callArgument(): unknown {
    return null;
  }

  overClause(): unknown {
    return null;
  }

  parenthesizedExpression(): unknown {
    return null;
  }

  castExpression(): unknown {
    return null;
  }

  caseExpression(): unknown {
    return null;
  }

  systemVariable(): unknown {
    return null;
  }

  parameterRef(): unknown {
    return null;
  }

  // ---- Type references -------------------------------------------

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
