/**
 * Chevrotain CstParser for ABAP CDS.
 *
 * Grammar coverage (see src/lib/grammar/*.ts for the per-topic index):
 *   - DDL  : table, structure, simple type, view entity, projection view,
 *            abstract/custom entity
 *   - DCL  : role definitions (grant select on ... where ...)
 *   - DDLX : metadata extensions (`annotate entity ... with { ... }`)
 *   - SRVD : service definitions (`define service ... { expose ...; }`)
 *   - Elements / associations / parameters / annotations
 *
 * Rules are kept in this single class (Chevrotain requirement). Logical
 * groupings are delimited with section banners and documented in
 * `src/lib/grammar/`.
 */
import { CstParser } from 'chevrotain';
import type { TokenType } from 'chevrotain';
import {
  allTokens,
  At,
  Colon,
  Semicolon,
  Dot,
  Comma,
  LBrace,
  RBrace,
  LParen,
  RParen,
  LBracket,
  RBracket,
  Define,
  Table,
  Structure,
  Type,
  Service,
  Expose,
  Annotate,
  Entity,
  With,
  Key,
  Not,
  Null,
  As,
  Include,
  Suffix,
  True,
  False,
  Abap,
  View,
  Projection,
  Select,
  From,
  On,
  Association,
  Composition,
  To,
  Many,
  One,
  Of,
  Parameters,
  Role,
  Grant,
  Where,
  Abstract,
  Custom,
  Virtual,
  Redirected,
  Default,
  Join,
  Inner,
  Left,
  Right,
  Cross,
  Outer,
  And,
  Or,
  Identifier,
  StringLiteral,
  NumberLiteral,
  EnumLiteral,
  EqEq,
  Eq,
  NotEq,
  LtEq,
  GtEq,
  Lt,
  Gt,
  Star,
  Dollar,
} from './tokens';

export class CdsParser extends CstParser {
  /**
   * `true` while a CDS **view entity** (`define view entity <name>`) is
   * parsed, `false` for the legacy `define view <name>` (classic SQL view).
   *
   * The two flavours differ in the accepted join spelling:
   *
   * - view entities: the documented syntax is `[INNER] JOIN`, `LEFT OUTER
   *   JOIN`, `RIGHT OUTER JOIN`, `CROSS JOIN` — `LEFT JOIN` / `RIGHT JOIN`
   *   without `OUTER` are rejected;
   * - legacy views: `LEFT JOIN` / `RIGHT JOIN` are accepted for
   *   compatibility (the legacy rule could not be verified against the ABAP
   *   keyword documentation — see `src/lib/grammar/joins.ts`).
   */
  private isViewEntity = false;

  /**
   * All token types that may be used as a CDS name.
   *
   * The list is the single source of truth for the `cdsName` rule and for the
   * bare-alias rule — the latter is derived from it by removing the
   * FROM-region starters.
   */
  private static readonly NAME_TOKENS: readonly TokenType[] = [
    Identifier,
    Table,
    Structure,
    Type,
    Service,
    Expose,
    Entity,
    Key,
    View,
    Role,
    Association,
    Composition,
    Abstract,
    Custom,
    Virtual,
    Redirected,
    Default,
    Parameters,
    Grant,
    Many,
    One,
    Of,
    Projection,
    Select,
    From,
    To,
    Where,
    // The join keywords are reserved words, but they are still valid
    // identifiers in name positions (`A.left`, `as inner`, …).
    Join,
    Inner,
    Left,
    Right,
    Outer,
    Cross,
  ];

  /**
   * Tokens that may start an item of the FROM region.
   *
   * A *bare* (implicit) source alias must not be one of them, otherwise the
   * alias would swallow the token that starts the next FROM item — e.g.
   * `from A association [0..1] to B …` would read `association` as the alias.
   * An explicit `as <alias>` stays unrestricted (`from A as left`).
   *
   * `outer` is deliberately **not** part of the set: it can never start a
   * FROM item (it always follows `left` / `right`), so excluding it would
   * only needlessly forbid a bare alias named `outer`.
   */
  private static readonly FROM_REGION_STARTERS: ReadonlySet<TokenType> =
    new Set<TokenType>([
      Association,
      Composition,
      Join,
      Inner,
      Left,
      Right,
      Cross,
    ]);

  constructor() {
    super(allTokens, {
      recoveryEnabled: true,
      maxLookahead: 4,
    });
    this.performSelfAnalysis();
  }

  // ============================================================
  // Root rule
  // ============================================================

  public sourceFile = this.RULE('sourceFile', () => {
    this.MANY(() => {
      this.SUBRULE(this.topLevelAnnotation);
    });
    this.SUBRULE(this.definition);
  });

  // ============================================================
  // Top-level definition dispatch
  // ============================================================

  private readonly definition = this.RULE('definition', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.defineStatement) },
      { ALT: () => this.SUBRULE(this.annotateStatement) },
    ]);
  });

  private readonly defineStatement = this.RULE('defineStatement', () => {
    this.CONSUME(Define);
    this.OR([
      { ALT: () => this.SUBRULE(this.tableDefinition) },
      { ALT: () => this.SUBRULE(this.structureDefinition) },
      { ALT: () => this.SUBRULE(this.viewEntityDefinition) },
      { ALT: () => this.SUBRULE(this.abstractEntityDefinition) },
      { ALT: () => this.SUBRULE(this.customEntityDefinition) },
      { ALT: () => this.SUBRULE(this.simpleTypeDefinition) },
      { ALT: () => this.SUBRULE(this.serviceDefinition) },
      { ALT: () => this.SUBRULE(this.roleDefinition) },
    ]);
  });

  // ============================================================
  // Table definition
  // ============================================================

  private readonly tableDefinition = this.RULE('tableDefinition', () => {
    this.CONSUME(Table);
    this.SUBRULE(this.cdsName);
    this.CONSUME(LBrace);
    this.MANY(() => {
      this.SUBRULE(this.tableMember);
    });
    this.CONSUME(RBrace);
  });

  // ============================================================
  // Structure definition
  // ============================================================

  private readonly structureDefinition = this.RULE(
    'structureDefinition',
    () => {
      this.CONSUME(Structure);
      this.SUBRULE(this.cdsName);
      this.CONSUME(LBrace);
      this.MANY(() => {
        this.SUBRULE(this.tableMember);
      });
      this.CONSUME(RBrace);
    },
  );

  // ============================================================
  // View entity: `view entity <name> [with parameters ...] as select from ...`
  //                                                 or `as projection on ...`
  // ============================================================

  private readonly viewEntityDefinition = this.RULE(
    'viewEntityDefinition',
    () => {
      this.CONSUME(View);
      // `define view entity <name>` (CDS view entity) and the legacy
      // `define view <name>` (classic SQL view) share the same body.
      this.isViewEntity = false;
      this.OPTION(() => {
        this.CONSUME(Entity);
        this.isViewEntity = true;
      });
      this.SUBRULE(this.cdsName);
      this.OPTION2(() => {
        this.SUBRULE(this.parametersClause);
      });
      this.CONSUME(As);
      this.OR([
        { ALT: () => this.SUBRULE(this.selectFromClause) },
        { ALT: () => this.SUBRULE(this.projectionOnClause) },
      ]);
      this.OPTION3(() => {
        this.SUBRULE(this.elementList);
      });
      // optional where at top-level of view (consume expression if present)
      this.OPTION4(() => {
        this.CONSUME(Where);
        this.SUBRULE(this.expression);
      });
    },
  );

  private readonly abstractEntityDefinition = this.RULE(
    'abstractEntityDefinition',
    () => {
      this.CONSUME(Abstract);
      this.CONSUME(Entity);
      this.SUBRULE(this.cdsName);
      this.OPTION(() => {
        this.SUBRULE(this.parametersClause);
      });
      this.SUBRULE(this.elementList);
    },
  );

  private readonly customEntityDefinition = this.RULE(
    'customEntityDefinition',
    () => {
      this.CONSUME(Custom);
      this.CONSUME(Entity);
      this.SUBRULE(this.cdsName);
      this.OPTION(() => {
        this.SUBRULE(this.parametersClause);
      });
      this.SUBRULE(this.elementList);
    },
  );

  private readonly selectFromClause = this.RULE('selectFromClause', () => {
    this.CONSUME(Select);
    this.OPTION(() => {
      this.CONSUME(From);
    });
    // CDS allows either "select from X" (view entity syntax) or "select from X".
    // To stay permissive the `from` is optional above.
    this.SUBRULE(this.dataSource);
    // FROM region: an ordered chain of joins and/or association declarations.
    // ABAP CDS allows both to appear here; associations are usually written
    // after the join chain.
    this.MANY(() => {
      this.OR([
        { ALT: () => this.SUBRULE(this.joinClause) },
        { ALT: () => this.SUBRULE(this.associationTail) },
      ]);
    });
  });

  private readonly projectionOnClause = this.RULE('projectionOnClause', () => {
    this.CONSUME(Projection);
    this.CONSUME(On);
    this.SUBRULE(this.dataSource);
  });

  /**
   * A data source: `<name> [ ( <parameter bindings> ) ] [ as <alias> ]`.
   *
   * The parameter list precedes the alias, e.g.
   * `ZP_MM_PR_DOC_TF( mandt: $session.client ) as _PRDocList`.
   */
  private readonly dataSource = this.RULE('dataSource', () => {
    this.SUBRULE(this.qualifiedName);
    this.OPTION(() => {
      this.SUBRULE(this.dataSourceParameters);
    });
    this.OPTION2(() => {
      this.OR([
        {
          // An explicit alias is never ambiguous.
          ALT: () => {
            this.CONSUME(As);
            this.SUBRULE(this.cdsName);
          },
        },
        {
          // A bare (implicit) alias — the FROM-region starters are excluded,
          // see FROM_REGION_STARTERS.
          ALT: () => this.SUBRULE(this.bareAliasName),
        },
      ]);
    });
  });

  /** `( <param> : <value> , ... )` — parameter bindings of a data source. */
  private readonly dataSourceParameters = this.RULE(
    'dataSourceParameters',
    () => {
      this.CONSUME(LParen);
      this.MANY_SEP({
        SEP: Comma,
        DEF: () => {
          this.SUBRULE(this.dataSourceParameter);
        },
      });
      this.CONSUME(RParen);
    },
  );

  /** `<name> : <value>` — a single parameter binding. */
  private readonly dataSourceParameter = this.RULE(
    'dataSourceParameter',
    () => {
      this.SUBRULE(this.qualifiedName);
      this.CONSUME(Colon);
      this.SUBRULE(this.parameterBinding);
    },
  );

  /**
   * The value bound to a source parameter. Kept as written in the source:
   *   - `:P_Param`   — parameter of the consuming view
   *   - `$session.client`, `$parameters.P_X` — system variable
   *   - `'X'`, `42`   — literal
   */
  private readonly parameterBinding = this.RULE('parameterBinding', () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME(Colon);
          this.SUBRULE(this.qualifiedName);
        },
      },
      { ALT: () => this.SUBRULE(this.systemVariable) },
      { ALT: () => this.SUBRULE(this.literal) },
    ]);
  });

  // ============================================================
  // Joins
  //
  //   [INNER] JOIN      <source> ON <expr>   -- ON is mandatory
  //   LEFT OUTER JOIN   <source> ON <expr>   -- ON is mandatory
  //   RIGHT OUTER JOIN  <source> ON <expr>   -- ON is mandatory
  //   CROSS JOIN        <source>             -- ON is not allowed
  //
  // `LEFT JOIN` / `RIGHT JOIN` (without `OUTER`) are only accepted in the
  // legacy `define view` syntax — see `isViewEntity`.
  // ============================================================

  private readonly joinClause = this.RULE('joinClause', () => {
    this.OR([
      {
        // A cross join must not carry an ON condition — it consumes the
        // data source itself.
        ALT: () => {
          this.CONSUME(Cross);
          this.CONSUME(Join);
          this.SUBRULE(this.dataSource);
        },
      },
      {
        // Every other join type requires an ON condition.
        ALT: () => {
          this.SUBRULE(this.joinType);
          this.SUBRULE(this.joinSource);
        },
      },
    ]);
  });

  /**
   * The join type of a join clause:
   *
   *   JOIN | INNER JOIN | LEFT OUTER JOIN | RIGHT OUTER JOIN
   *   LEFT JOIN | RIGHT JOIN      -- legacy `define view` only
   */
  private readonly joinType = this.RULE('joinType', () => {
    // NOTE: Chevrotain requires unique occurrence indices per rule, hence the
    // numbered CONSUME variants inside the alternatives.
    this.OR([
      {
        // legacy view only: `LEFT JOIN`
        GATE: () => this.isBareOuterJoin(Left),
        ALT: () => {
          this.CONSUME(Left);
          this.CONSUME(Join);
        },
      },
      {
        // legacy view only: `RIGHT JOIN`
        GATE: () => this.isBareOuterJoin(Right),
        ALT: () => {
          this.CONSUME(Right);
          this.CONSUME2(Join);
        },
      },
      {
        ALT: () => {
          this.CONSUME2(Left);
          this.CONSUME(Outer);
          this.CONSUME3(Join);
        },
      },
      {
        ALT: () => {
          this.CONSUME2(Right);
          this.CONSUME2(Outer);
          this.CONSUME4(Join);
        },
      },
      {
        ALT: () => {
          this.CONSUME(Inner);
          this.CONSUME5(Join);
        },
      },
      {
        ALT: () => {
          this.CONSUME6(Join);
        },
      },
    ]);
  });

  /** `<data source> ON <expression>` — the ON condition is mandatory. */
  private readonly joinSource = this.RULE('joinSource', () => {
    this.SUBRULE(this.dataSource);
    this.CONSUME(On);
    this.SUBRULE(this.expression);
  });

  /**
   * Is the next clause the legacy `LEFT JOIN` / `RIGHT JOIN` spelling?
   *
   * Only the legacy `define view` syntax accepts it — for a view entity the
   * documented spelling is `LEFT OUTER JOIN` / `RIGHT OUTER JOIN`.
   */
  private isBareOuterJoin(tokenType: TokenType): boolean {
    if (this.isViewEntity) return false;
    const first = this.LA(1);
    const second = this.LA(2);
    return first.tokenType === tokenType && second.tokenType === Join;
  }

  // ============================================================
  // Element list: `{ [key] [virtual] <expr> [as <alias>] ; ... }`
  // ============================================================

  private readonly elementList = this.RULE('elementList', () => {
    this.CONSUME(LBrace);
    this.MANY(() => {
      this.SUBRULE(this.elementMember);
    });
    this.CONSUME(RBrace);
  });

  private readonly elementMember = this.RULE('elementMember', () => {
    // Annotations are shared between projection elements and associations to
    // keep the LL(k) grammar unambiguous. The branch decision is made on the
    // `association` / `composition` keyword (or the absence thereof).
    this.MANY(() => this.SUBRULE(this.annotation));
    this.OR([
      { ALT: () => this.SUBRULE(this.associationTail) },
      { ALT: () => this.SUBRULE(this.viewElementTail) },
    ]);
  });

  private readonly viewElementTail = this.RULE('viewElementTail', () => {
    this.OPTION(() => this.CONSUME(Key));
    this.OPTION2(() => this.CONSUME(Virtual));
    this.OPTION3(() => this.CONSUME(Redirected));
    // Either a typed field `name : type` (valid for abstract/custom entities)
    // or a projection expression `expr [as alias]`.
    this.OR([
      {
        GATE: () => this.isTypedField(),
        ALT: () => this.SUBRULE(this.typedFieldTail),
      },
      { ALT: () => this.SUBRULE(this.projectionExpression) },
    ]);
    // Element terminator is optional for the trailing element.
    this.OPTION4(() => {
      this.OR2([
        { ALT: () => this.CONSUME(Semicolon) },
        { ALT: () => this.CONSUME(Comma) },
      ]);
    });
  });

  private readonly typedFieldTail = this.RULE('typedFieldTail', () => {
    this.SUBRULE(this.cdsName);
    this.CONSUME(Colon);
    this.SUBRULE(this.typeReference);
    this.OPTION(() => {
      this.CONSUME(Not);
      this.CONSUME(Null);
    });
  });

  /**
   * projection expression:
   *    <path> [as <alias>]
   *    <function>( <arg> , ... ) [as <alias>]        e.g. coalesce(a, b), sum(x)
   *    cast( <value> as <type> [preserving type] ) [as <alias>]
   *
   * Kept intentionally narrow — full SQL expression support is out of scope.
   * Only paths, calls and the `cast(...)` form are supported.
   */
  private readonly projectionExpression = this.RULE(
    'projectionExpression',
    () => {
      this.OR([
        {
          GATE: () => this.isCastExpression(),
          ALT: () => this.SUBRULE(this.castExpression),
        },
        { ALT: () => this.SUBRULE(this.pathOperand) },
      ]);
      this.OPTION(() => {
        this.CONSUME(As);
        this.SUBRULE(this.cdsName);
      });
    },
  );

  /** `cast( <value> as <type> [preserving type] )` */
  private readonly castExpression = this.RULE('castExpression', () => {
    this.CONSUME(Identifier); // `cast`
    this.CONSUME(LParen);
    this.SUBRULE(this.operand);
    this.CONSUME(As);
    this.SUBRULE(this.typeReference);
    this.OPTION(() => {
      this.CONSUME2(Identifier); // `preserving`
      this.CONSUME(Type); // `type`
    });
    this.CONSUME(RParen);
  });

  /** Cheap lookahead: `cast (` — the cast form of a projection element. */
  private isCastExpression(): boolean {
    const first = this.LA(1);
    const second = this.LA(2);
    if (!first || !second) return false;
    return (
      first.tokenType?.name === 'Identifier' &&
      first.image.toLowerCase() === 'cast' &&
      second.tokenType?.name === 'LParen'
    );
  }

  /** Cheap lookahead: `ident :` (optionally following `key`/`virtual`) → typed field. */
  private isTypedField(): boolean {
    // Look ahead: skip name token, expect Colon.
    // Both tokens should already be past the optional markers (handled by parser).
    const first = this.LA(1);
    const second = this.LA(2);
    if (!first || !second) return false;
    const isName = first.tokenType?.name === 'Identifier' || false;
    return isName && second.tokenType?.name === 'Colon';
  }

  // ============================================================
  // Associations
  //   association[<card>] [of many|one]? to <target> [as _<alias>]
  //     [on <expr>]
  // ============================================================

  private readonly associationTail = this.RULE('associationTail', () => {
    this.OR([
      { ALT: () => this.CONSUME(Association) },
      { ALT: () => this.CONSUME(Composition) },
    ]);
    this.OPTION(() => this.SUBRULE(this.cardinality));
    // connector:  "to [redirected to]? <target>"  (associations)
    //          |  "of [many|one]? [to]? <target>" (compositions / explicit)
    this.OR2([
      {
        ALT: () => {
          this.CONSUME(To);
          this.OPTION2(() => {
            this.CONSUME(Redirected);
            this.CONSUME2(To);
          });
        },
      },
      {
        ALT: () => {
          this.CONSUME(Of);
          this.OPTION3(() => {
            this.OR3([
              { ALT: () => this.CONSUME(Many) },
              { ALT: () => this.CONSUME(One) },
            ]);
          });
          this.OPTION4(() => this.CONSUME3(To));
        },
      },
    ]);
    this.SUBRULE(this.qualifiedName);
    this.OPTION5(() => {
      this.CONSUME(As);
      this.SUBRULE(this.cdsName);
    });
    this.OPTION6(() => {
      this.CONSUME(On);
      this.SUBRULE(this.expression);
    });
    this.OPTION7(() => {
      this.OR4([
        { ALT: () => this.CONSUME(Semicolon) },
        { ALT: () => this.CONSUME(Comma) },
      ]);
    });
  });

  /** `[<lower>..<upper>]`, `[<n>]`, `[*]`, `[<lower>..*]` */
  private readonly cardinality = this.RULE('cardinality', () => {
    this.CONSUME(LBracket);
    this.OR([
      { ALT: () => this.CONSUME(Star) },
      {
        ALT: () => {
          this.CONSUME(NumberLiteral);
          this.OPTION(() => {
            this.CONSUME(Dot);
            this.CONSUME2(Dot);
            this.OR2([
              { ALT: () => this.CONSUME2(NumberLiteral) },
              { ALT: () => this.CONSUME2(Star) },
            ]);
          });
        },
      },
    ]);
    this.CONSUME(RBracket);
  });

  // ============================================================
  // Parameters clause: `with parameters p1 : type, p2 : type`
  // ============================================================

  private readonly parametersClause = this.RULE('parametersClause', () => {
    this.CONSUME(With);
    this.CONSUME(Parameters);
    this.SUBRULE(this.parameterDefinition);
    this.MANY(() => {
      this.CONSUME(Comma);
      this.SUBRULE2(this.parameterDefinition);
    });
  });

  private readonly parameterDefinition = this.RULE(
    'parameterDefinition',
    () => {
      this.MANY(() => this.SUBRULE(this.annotation));
      this.SUBRULE(this.cdsName);
      this.CONSUME(Colon);
      this.SUBRULE(this.typeReference);
      this.OPTION(() => {
        this.CONSUME(Default);
        this.SUBRULE(this.literal);
      });
    },
  );

  // ============================================================
  // Simple type definition
  // ============================================================

  private readonly simpleTypeDefinition = this.RULE(
    'simpleTypeDefinition',
    () => {
      this.CONSUME(Type);
      this.SUBRULE(this.cdsName);
      this.CONSUME(Colon);
      this.SUBRULE(this.typeReference);
      this.CONSUME(Semicolon);
    },
  );

  // ============================================================
  // Service definition
  // ============================================================

  private readonly serviceDefinition = this.RULE('serviceDefinition', () => {
    this.CONSUME(Service);
    this.SUBRULE(this.cdsName);
    this.CONSUME(LBrace);
    this.MANY(() => {
      this.SUBRULE(this.exposeStatement);
    });
    this.CONSUME(RBrace);
  });

  private readonly exposeStatement = this.RULE('exposeStatement', () => {
    this.CONSUME(Expose);
    this.SUBRULE(this.cdsName);
    this.OPTION(() => {
      this.CONSUME(As);
      this.SUBRULE2(this.cdsName);
    });
    this.CONSUME(Semicolon);
  });

  // ============================================================
  // DCL — `define role X { grant select on Y where cond; }`
  // ============================================================

  private readonly roleDefinition = this.RULE('roleDefinition', () => {
    this.CONSUME(Role);
    this.SUBRULE(this.cdsName);
    this.CONSUME(LBrace);
    this.MANY(() => {
      this.SUBRULE(this.grantStatement);
    });
    this.CONSUME(RBrace);
  });

  private readonly grantStatement = this.RULE('grantStatement', () => {
    this.CONSUME(Grant);
    this.CONSUME(Select);
    this.CONSUME(On);
    this.SUBRULE(this.qualifiedName);
    this.OPTION(() => {
      this.CONSUME(Where);
      this.SUBRULE(this.expression);
    });
    this.CONSUME(Semicolon);
  });

  // ============================================================
  // Table/structure members
  // ============================================================

  private readonly tableMember = this.RULE('tableMember', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.includeDirective) },
      { ALT: () => this.SUBRULE(this.fieldDefinition) },
    ]);
  });

  private readonly includeDirective = this.RULE('includeDirective', () => {
    this.CONSUME(Include);
    this.SUBRULE(this.cdsName);
    this.OPTION(() => {
      this.CONSUME(With);
      this.CONSUME(Suffix);
      this.SUBRULE2(this.cdsName);
    });
    this.CONSUME(Semicolon);
  });

  private readonly fieldDefinition = this.RULE('fieldDefinition', () => {
    this.MANY(() => {
      this.SUBRULE(this.annotation);
    });
    this.OPTION(() => {
      this.CONSUME(Key);
    });
    this.SUBRULE(this.cdsName);
    this.CONSUME(Colon);
    this.SUBRULE(this.typeReference);
    this.OPTION2(() => {
      this.CONSUME(Not);
      this.CONSUME(Null);
    });
    this.CONSUME(Semicolon);
  });

  // ============================================================
  // Metadata extension (annotate entity ... with { ... })
  // ============================================================

  private readonly annotateStatement = this.RULE('annotateStatement', () => {
    this.CONSUME(Annotate);
    this.CONSUME(Entity);
    this.SUBRULE(this.cdsName);
    this.CONSUME(With);
    this.CONSUME(LBrace);
    this.MANY(() => {
      this.SUBRULE(this.annotatedElement);
    });
    this.CONSUME(RBrace);
  });

  private readonly annotatedElement = this.RULE('annotatedElement', () => {
    this.MANY(() => {
      this.SUBRULE(this.annotation);
    });
    this.SUBRULE(this.cdsName);
    this.CONSUME(Semicolon);
  });

  // ============================================================
  // Annotations
  // ============================================================

  private readonly topLevelAnnotation = this.RULE('topLevelAnnotation', () => {
    this.SUBRULE(this.annotation);
  });

  private readonly annotation = this.RULE('annotation', () => {
    this.CONSUME(At);
    this.SUBRULE(this.dottedName);
    this.OPTION(() => {
      this.CONSUME(Colon);
      this.SUBRULE(this.annotationValue);
    });
  });

  private readonly dottedName = this.RULE('dottedName', () => {
    this.SUBRULE(this.cdsName);
    this.MANY(() => {
      this.CONSUME(Dot);
      this.SUBRULE2(this.cdsName);
    });
  });

  private readonly annotationValue = this.RULE('annotationValue', () => {
    this.OR([
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.CONSUME(EnumLiteral) },
      { ALT: () => this.CONSUME(True) },
      { ALT: () => this.CONSUME(False) },
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.SUBRULE(this.annotationArray) },
      { ALT: () => this.SUBRULE(this.annotationObject) },
    ]);
  });

  private readonly annotationArray = this.RULE('annotationArray', () => {
    this.CONSUME(LBracket);
    this.MANY_SEP({
      SEP: Comma,
      DEF: () => {
        this.SUBRULE(this.annotationValue);
      },
    });
    this.CONSUME(RBracket);
  });

  private readonly annotationObject = this.RULE('annotationObject', () => {
    this.CONSUME(LBrace);
    this.MANY_SEP({
      SEP: Comma,
      DEF: () => {
        this.SUBRULE(this.annotationProperty);
      },
    });
    this.CONSUME(RBrace);
  });

  private readonly annotationProperty = this.RULE('annotationProperty', () => {
    this.SUBRULE(this.dottedName);
    this.CONSUME(Colon);
    this.SUBRULE(this.annotationValue);
  });

  // ============================================================
  // Literals
  // ============================================================

  private readonly literal = this.RULE('literal', () => {
    this.OR([
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.CONSUME(EnumLiteral) },
      { ALT: () => this.CONSUME(True) },
      { ALT: () => this.CONSUME(False) },
    ]);
  });

  // ============================================================
  // Expressions (narrow subset: operands + binary comparisons + AND/OR)
  // Used by `on` / `where` clauses. Expression trees are intentionally
  // kept opaque — consumers see a flat token list through the visitor.
  // ============================================================

  private readonly expression = this.RULE('expression', () => {
    this.SUBRULE(this.comparison);
    this.MANY(() => {
      this.OR([
        { ALT: () => this.CONSUME(And) },
        { ALT: () => this.CONSUME(Or) },
      ]);
      this.SUBRULE2(this.comparison);
    });
  });

  private readonly comparison = this.RULE('comparison', () => {
    this.SUBRULE(this.operand);
    this.OPTION(() => {
      this.OR([
        {
          ALT: () => {
            this.OR2([
              { ALT: () => this.CONSUME(EqEq) },
              { ALT: () => this.CONSUME(Eq) },
              { ALT: () => this.CONSUME(NotEq) },
              { ALT: () => this.CONSUME(LtEq) },
              { ALT: () => this.CONSUME(GtEq) },
              { ALT: () => this.CONSUME(Lt) },
              { ALT: () => this.CONSUME(Gt) },
            ]);
            this.SUBRULE2(this.operand);
          },
        },
        {
          // `is null` / `is not null` / `is initial` / `is not initial`
          GATE: () => this.isIsPredicate(),
          ALT: () => {
            this.CONSUME(Identifier); // `is`
            this.OPTION2(() => this.CONSUME(Not));
            this.OR3([
              { ALT: () => this.CONSUME(Null) },
              { ALT: () => this.CONSUME2(Identifier) }, // `initial`
            ]);
          },
        },
      ]);
    });
  });

  /** Cheap lookahead: `is` — the `is null` / `is initial` predicate. */
  private isIsPredicate(): boolean {
    const first = this.LA(1);
    if (!first) return false;
    return (
      first.tokenType?.name === 'Identifier' &&
      first.image.toLowerCase() === 'is'
    );
  }

  private readonly operand = this.RULE('operand', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.literal) },
      { ALT: () => this.SUBRULE(this.systemVariable) },
      { ALT: () => this.SUBRULE(this.parenthesizedExpression) },
      { ALT: () => this.SUBRULE(this.pathOperand) },
    ]);
  });

  /**
   * A path operand: `<name>[.<name>...]` optionally followed by an argument
   * list, e.g. `a.b` or `coalesce(a, b)`.
   *
   * The arguments are parsed as expressions so that nested structures
   * (including the commas inside them) are not truncated.
   */
  private readonly pathOperand = this.RULE('pathOperand', () => {
    this.SUBRULE(this.qualifiedName);
    this.OPTION(() => {
      this.CONSUME(LParen);
      this.OPTION2(() => {
        this.SUBRULE(this.expression);
        this.MANY(() => {
          this.CONSUME(Comma);
          this.SUBRULE2(this.expression);
        });
      });
      this.CONSUME(RParen);
    });
  });

  /** `( <expression> )` — a parenthesized sub-condition. */
  private readonly parenthesizedExpression = this.RULE(
    'parenthesizedExpression',
    () => {
      this.CONSUME(LParen);
      this.SUBRULE(this.expression);
      this.CONSUME(RParen);
    },
  );

  /** `$session.client`, `$parameters.P_X`, `$projection.Field`. */
  private readonly systemVariable = this.RULE('systemVariable', () => {
    this.CONSUME(Dollar);
    this.SUBRULE(this.qualifiedName);
  });

  // ============================================================
  // Type references
  // ============================================================

  private readonly typeReference = this.RULE('typeReference', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.builtinType) },
      { ALT: () => this.SUBRULE(this.namedType) },
    ]);
  });

  /** `abap.char(10)` or `abap.dec(11,2)` */
  private readonly builtinType = this.RULE('builtinType', () => {
    this.CONSUME(Abap);
    this.CONSUME(Dot);
    this.SUBRULE(this.cdsName);
    this.OPTION(() => {
      this.CONSUME(LParen);
      this.CONSUME(NumberLiteral);
      this.OPTION2(() => {
        this.CONSUME(Comma);
        this.CONSUME2(NumberLiteral);
      });
      this.CONSUME(RParen);
    });
  });

  /** Data element or other named type reference */
  private readonly namedType = this.RULE('namedType', () => {
    this.SUBRULE(this.qualifiedName);
  });

  // ============================================================
  // Name helpers
  // ============================================================

  /** An identifier that may also be a keyword used as a name. */
  private readonly cdsName = this.RULE('cdsName', () => {
    this.OR(
      CdsParser.NAME_TOKENS.map((tokenType) => ({
        ALT: () => this.CONSUME(tokenType),
      })),
    );
  });

  /**
   * A name usable as an *implicit* (bare) source alias.
   *
   * It is `cdsName` without the FROM-region starters — those tokens belong
   * to the next item of the FROM region and must not be read as an alias.
   */
  private readonly bareAliasName = this.RULE('bareAliasName', () => {
    this.OR(
      CdsParser.NAME_TOKENS.filter(
        (tokenType) => !CdsParser.FROM_REGION_STARTERS.has(tokenType),
      ).map((tokenType) => ({
        ALT: () => this.CONSUME(tokenType),
      })),
    );
  });

  /** Dot-separated qualified name: foo.bar.baz */
  private readonly qualifiedName = this.RULE('qualifiedName', () => {
    this.SUBRULE(this.cdsName);
    this.MANY(() => {
      this.CONSUME(Dot);
      this.SUBRULE2(this.cdsName);
    });
  });
}

/** Singleton parser instance (Chevrotain parsers are reusable) */
export const cdsParser = new CdsParser();
