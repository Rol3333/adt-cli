/**
 * Chevrotain Token Definitions for ABAP CDS
 *
 * Token order matters: more specific patterns must come before general ones.
 * Keywords use `longer_alt` to avoid matching prefixes of identifiers.
 */
import { createToken, Lexer } from 'chevrotain';

// ============================================
// Whitespace & Comments
// ============================================

export const WhiteSpace = createToken({
  name: 'WhiteSpace',
  pattern: /\s+/,
  group: Lexer.SKIPPED,
});

export const LineComment = createToken({
  name: 'LineComment',
  pattern: /\/\/[^\n]*/,
  group: Lexer.SKIPPED,
});

export const BlockComment = createToken({
  name: 'BlockComment',
  pattern: /\/\*[\s\S]*?\*\//,
  group: Lexer.SKIPPED,
});

/**
 * SQL-style line comment: `-- some text`.
 *
 * ABAP CDS sources (especially the classic `define view` ones) use SQL
 * comments. The pattern is tried before the `Minus` token, so `--` always
 * wins over two minus signs.
 */
export const SqlLineComment = createToken({
  name: 'SqlLineComment',
  pattern: /--[^\n]*/,
  group: Lexer.SKIPPED,
});

// ============================================
// Literals
// ============================================

export const StringLiteral = createToken({
  name: 'StringLiteral',
  pattern: /'(?:[^'\\]|\\.)*'/,
});

export const NumberLiteral = createToken({
  name: 'NumberLiteral',
  pattern: /\d+(?:\.\d+)?/,
});

/** Hash-prefixed enum value: #TRANSPARENT, #NOT_EXTENSIBLE */
export const EnumLiteral = createToken({
  name: 'EnumLiteral',
  pattern: /#[A-Za-z_][A-Za-z0-9_]*/,
});

// ============================================
// Identifier (must come AFTER all keywords)
// ============================================

export const Identifier = createToken({
  name: 'Identifier',
  pattern: /[A-Za-z_][A-Za-z0-9_]*/,
});

// ============================================
// Keywords (use longer_alt: Identifier)
// ============================================

/**
 * Case-insensitive keyword pattern.
 *
 * ABAP CDS sources are written in upper, lower or mixed case, so a keyword
 * has to be recognized in all of them. The token image keeps the original
 * spelling — identifiers therefore keep their case in the AST.
 */
function keyword(word: string): RegExp {
  // `word` is always a plain identifier literal, but escape it so the
  // helper stays safe for any future keyword containing regex syntax.
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped, 'i');
}

export const Define = createToken({
  name: 'Define',
  pattern: keyword('define'),
  longer_alt: Identifier,
});

export const Table = createToken({
  name: 'Table',
  pattern: keyword('table'),
  longer_alt: Identifier,
});

export const Structure = createToken({
  name: 'Structure',
  pattern: keyword('structure'),
  longer_alt: Identifier,
});

export const Type = createToken({
  name: 'Type',
  pattern: keyword('type'),
  longer_alt: Identifier,
});

export const Service = createToken({
  name: 'Service',
  pattern: keyword('service'),
  longer_alt: Identifier,
});

export const Expose = createToken({
  name: 'Expose',
  pattern: keyword('expose'),
  longer_alt: Identifier,
});

export const Annotate = createToken({
  name: 'Annotate',
  pattern: keyword('annotate'),
  longer_alt: Identifier,
});

export const Entity = createToken({
  name: 'Entity',
  pattern: keyword('entity'),
  longer_alt: Identifier,
});

export const With = createToken({
  name: 'With',
  pattern: keyword('with'),
  longer_alt: Identifier,
});

export const Key = createToken({
  name: 'Key',
  pattern: keyword('key'),
  longer_alt: Identifier,
});

export const Not = createToken({
  name: 'Not',
  pattern: keyword('not'),
  longer_alt: Identifier,
});

export const Null = createToken({
  name: 'Null',
  pattern: keyword('null'),
  longer_alt: Identifier,
});

export const As = createToken({
  name: 'As',
  pattern: keyword('as'),
  longer_alt: Identifier,
});

export const Include = createToken({
  name: 'Include',
  pattern: keyword('include'),
  longer_alt: Identifier,
});

export const Suffix = createToken({
  name: 'Suffix',
  pattern: keyword('suffix'),
  longer_alt: Identifier,
});

export const True = createToken({
  name: 'True',
  pattern: keyword('true'),
  longer_alt: Identifier,
});

export const False = createToken({
  name: 'False',
  pattern: keyword('false'),
  longer_alt: Identifier,
});

export const Abap = createToken({
  name: 'Abap',
  pattern: keyword('abap'),
  longer_alt: Identifier,
});

// ---- Phase 2/3 additions ----

export const View = createToken({
  name: 'View',
  pattern: keyword('view'),
  longer_alt: Identifier,
});

export const Projection = createToken({
  name: 'Projection',
  pattern: keyword('projection'),
  longer_alt: Identifier,
});

export const Select = createToken({
  name: 'Select',
  pattern: keyword('select'),
  longer_alt: Identifier,
});

export const From = createToken({
  name: 'From',
  pattern: keyword('from'),
  longer_alt: Identifier,
});

export const On = createToken({
  name: 'On',
  pattern: keyword('on'),
  longer_alt: Identifier,
});

export const Association = createToken({
  name: 'Association',
  pattern: keyword('association'),
  longer_alt: Identifier,
});

export const Composition = createToken({
  name: 'Composition',
  pattern: keyword('composition'),
  longer_alt: Identifier,
});

export const To = createToken({
  name: 'To',
  pattern: keyword('to'),
  longer_alt: Identifier,
});

export const Many = createToken({
  name: 'Many',
  pattern: keyword('many'),
  longer_alt: Identifier,
});

export const One = createToken({
  name: 'One',
  pattern: keyword('one'),
  longer_alt: Identifier,
});

export const Of = createToken({
  name: 'Of',
  pattern: keyword('of'),
  longer_alt: Identifier,
});

export const Parameters = createToken({
  name: 'Parameters',
  pattern: keyword('parameters'),
  longer_alt: Identifier,
});

export const Role = createToken({
  name: 'Role',
  pattern: keyword('role'),
  longer_alt: Identifier,
});

export const Grant = createToken({
  name: 'Grant',
  pattern: keyword('grant'),
  longer_alt: Identifier,
});

export const Where = createToken({
  name: 'Where',
  pattern: keyword('where'),
  longer_alt: Identifier,
});

export const Abstract = createToken({
  name: 'Abstract',
  pattern: keyword('abstract'),
  longer_alt: Identifier,
});

export const Custom = createToken({
  name: 'Custom',
  pattern: keyword('custom'),
  longer_alt: Identifier,
});

export const Virtual = createToken({
  name: 'Virtual',
  pattern: keyword('virtual'),
  longer_alt: Identifier,
});

export const Redirected = createToken({
  name: 'Redirected',
  pattern: keyword('redirected'),
  longer_alt: Identifier,
});

export const Default = createToken({
  name: 'Default',
  pattern: keyword('default'),
  longer_alt: Identifier,
});

// ---- JOIN keywords ----------------------------------------------------
//
// ABAP CDS supports `JOIN` (= INNER JOIN), `INNER JOIN`, `LEFT [OUTER] JOIN`,
// `RIGHT [OUTER] JOIN` and `CROSS JOIN`. The SQL-standard `FULL [OUTER] JOIN`
// is supported as well, so that HANA CDS / CAP CDS sources (which use the
// standard SQL join syntax) can be read with the same grammar.
//
// The keywords are tokenized separately so the parser can normalize the
// different spellings.

export const Join = createToken({
  name: 'Join',
  pattern: keyword('join'),
  longer_alt: Identifier,
});

export const Inner = createToken({
  name: 'Inner',
  pattern: keyword('inner'),
  longer_alt: Identifier,
});

export const Left = createToken({
  name: 'Left',
  pattern: keyword('left'),
  longer_alt: Identifier,
});

export const Right = createToken({
  name: 'Right',
  pattern: keyword('right'),
  longer_alt: Identifier,
});

export const Cross = createToken({
  name: 'Cross',
  pattern: keyword('cross'),
  longer_alt: Identifier,
});

export const Full = createToken({
  name: 'Full',
  pattern: keyword('full'),
  longer_alt: Identifier,
});

/**
 * `OUTER` — must be listed BEFORE `Or`, because `or` is a prefix of `outer`
 * and the lexer resolves the first matching token in list order.
 */
export const Outer = createToken({
  name: 'Outer',
  pattern: keyword('outer'),
  longer_alt: Identifier,
});

// ---- SELECT clauses & set operators -------------------------------------

export const Distinct = createToken({
  name: 'Distinct',
  pattern: keyword('distinct'),
  longer_alt: Identifier,
});

export const Union = createToken({
  name: 'Union',
  pattern: keyword('union'),
  longer_alt: Identifier,
});

export const Intersect = createToken({
  name: 'Intersect',
  pattern: keyword('intersect'),
  longer_alt: Identifier,
});

export const Except = createToken({
  name: 'Except',
  pattern: keyword('except'),
  longer_alt: Identifier,
});

export const Allowed = createToken({
  name: 'Allowed',
  pattern: keyword('allowed'),
  longer_alt: Identifier,
});

/** NOTE: `allowed` must precede `all` (`all` is a prefix of `allowed`). */
export const All = createToken({
  name: 'All',
  pattern: keyword('all'),
  longer_alt: Identifier,
});

export const Group = createToken({
  name: 'Group',
  pattern: keyword('group'),
  longer_alt: Identifier,
});

export const Having = createToken({
  name: 'Having',
  pattern: keyword('having'),
  longer_alt: Identifier,
});

// ---- Entity modifiers ----------------------------------------------------

export const Root = createToken({
  name: 'Root',
  pattern: keyword('root'),
  longer_alt: Identifier,
});

export const Writable = createToken({
  name: 'Writable',
  pattern: keyword('writable'),
  longer_alt: Identifier,
});

export const Switchable = createToken({
  name: 'Switchable',
  pattern: keyword('switchable'),
  longer_alt: Identifier,
});

// ---- Cardinality words & association flavours ----------------------------

export const Exact = createToken({
  name: 'Exact',
  pattern: keyword('exact'),
  longer_alt: Identifier,
});

export const Parents = createToken({
  name: 'Parents',
  pattern: keyword('parents'),
  longer_alt: Identifier,
});

export const Parent = createToken({
  name: 'Parent',
  pattern: keyword('parent'),
  longer_alt: Identifier,
});

export const Child = createToken({
  name: 'Child',
  pattern: keyword('child'),
  longer_alt: Identifier,
});

export const Localized = createToken({
  name: 'Localized',
  pattern: keyword('localized'),
  longer_alt: Identifier,
});

export const Redefine = createToken({
  name: 'Redefine',
  pattern: keyword('redefine'),
  longer_alt: Identifier,
});

export const Redefinition = createToken({
  name: 'Redefinition',
  pattern: keyword('redefinition'),
  longer_alt: Identifier,
});

export const Filter = createToken({
  name: 'Filter',
  pattern: keyword('filter'),
  longer_alt: Identifier,
});

export const Bind = createToken({
  name: 'Bind',
  pattern: keyword('bind'),
  longer_alt: Identifier,
});

// ---- Functions -----------------------------------------------------------

export const FunctionKeyword = createToken({
  name: 'Function',
  pattern: keyword('function'),
  longer_alt: Identifier,
});

export const Returns = createToken({
  name: 'Returns',
  pattern: keyword('returns'),
  longer_alt: Identifier,
});

export const Implemented = createToken({
  name: 'Implemented',
  pattern: keyword('implemented'),
  longer_alt: Identifier,
});

export const Method = createToken({
  name: 'Method',
  pattern: keyword('method'),
  longer_alt: Identifier,
});

export const Scalar = createToken({
  name: 'Scalar',
  pattern: keyword('scalar'),
  longer_alt: Identifier,
});

// ---- Further entity kinds ------------------------------------------------

export const Hierarchy = createToken({
  name: 'Hierarchy',
  pattern: keyword('hierarchy'),
  longer_alt: Identifier,
});

export const Aspect = createToken({
  name: 'Aspect',
  pattern: keyword('aspect'),
  longer_alt: Identifier,
});

export const AnnotationKeyword = createToken({
  name: 'AnnotationKeyword',
  pattern: keyword('annotation'),
  longer_alt: Identifier,
});

export const Extend = createToken({
  name: 'Extend',
  pattern: keyword('extend'),
  longer_alt: Identifier,
});

export const Accesspolicy = createToken({
  name: 'Accesspolicy',
  pattern: keyword('accesspolicy'),
  longer_alt: Identifier,
});

export const External = createToken({
  name: 'External',
  pattern: keyword('external'),
  longer_alt: Identifier,
});

export const Provider = createToken({
  name: 'Provider',
  pattern: keyword('provider'),
  longer_alt: Identifier,
});

export const Contract = createToken({
  name: 'Contract',
  pattern: keyword('contract'),
  longer_alt: Identifier,
});

export const Name = createToken({
  name: 'Name',
  pattern: keyword('name'),
  longer_alt: Identifier,
});

export const Federated = createToken({
  name: 'Federated',
  pattern: keyword('federated'),
  longer_alt: Identifier,
});

export const Data = createToken({
  name: 'Data',
  pattern: keyword('data'),
  longer_alt: Identifier,
});

export const Provided = createToken({
  name: 'Provided',
  pattern: keyword('provided'),
  longer_alt: Identifier,
});

export const AtKeyword = createToken({
  name: 'AtKeyword',
  pattern: keyword('at'),
  longer_alt: Identifier,
});

export const Runtime = createToken({
  name: 'Runtime',
  pattern: keyword('runtime'),
  longer_alt: Identifier,
});

// ---- CASE expressions ----------------------------------------------------

export const Case = createToken({
  name: 'Case',
  pattern: keyword('case'),
  longer_alt: Identifier,
});

export const When = createToken({
  name: 'When',
  pattern: keyword('when'),
  longer_alt: Identifier,
});

export const Then = createToken({
  name: 'Then',
  pattern: keyword('then'),
  longer_alt: Identifier,
});

export const Else = createToken({
  name: 'Else',
  pattern: keyword('else'),
  longer_alt: Identifier,
});

export const End = createToken({
  name: 'End',
  pattern: keyword('end'),
  longer_alt: Identifier,
});

// ---- Condition operators -------------------------------------------------

export const Like = createToken({
  name: 'Like',
  pattern: keyword('like'),
  longer_alt: Identifier,
});

export const Between = createToken({
  name: 'Between',
  pattern: keyword('between'),
  longer_alt: Identifier,
});

export const Over = createToken({
  name: 'Over',
  pattern: keyword('over'),
  longer_alt: Identifier,
});

export const Partition = createToken({
  name: 'Partition',
  pattern: keyword('partition'),
  longer_alt: Identifier,
});

// ---- Hierarchy clauses ----------------------------------------------------

export const Siblings = createToken({
  name: 'Siblings',
  pattern: keyword('siblings'),
  longer_alt: Identifier,
});

export const Order = createToken({
  name: 'Order',
  pattern: keyword('order'),
  longer_alt: Identifier,
});

export const Start = createToken({
  name: 'Start',
  pattern: keyword('start'),
  longer_alt: Identifier,
});

export const Source = createToken({
  name: 'Source',
  pattern: keyword('source'),
  longer_alt: Identifier,
});

export const Directory = createToken({
  name: 'Directory',
  pattern: keyword('directory'),
  longer_alt: Identifier,
});

export const Period = createToken({
  name: 'Period',
  pattern: keyword('period'),
  longer_alt: Identifier,
});

export const Valid = createToken({
  name: 'Valid',
  pattern: keyword('valid'),
  longer_alt: Identifier,
});

export const Depth = createToken({
  name: 'Depth',
  pattern: keyword('depth'),
  longer_alt: Identifier,
});

export const Nodetype = createToken({
  name: 'Nodetype',
  pattern: keyword('nodetype'),
  longer_alt: Identifier,
});

export const Load = createToken({
  name: 'Load',
  pattern: keyword('load'),
  longer_alt: Identifier,
});

export const Multiple = createToken({
  name: 'Multiple',
  pattern: keyword('multiple'),
  longer_alt: Identifier,
});

export const Orphans = createToken({
  name: 'Orphans',
  pattern: keyword('orphans'),
  longer_alt: Identifier,
});

export const Cycles = createToken({
  name: 'Cycles',
  pattern: keyword('cycles'),
  longer_alt: Identifier,
});

export const Generate = createToken({
  name: 'Generate',
  pattern: keyword('generate'),
  longer_alt: Identifier,
});

export const Spantree = createToken({
  name: 'Spantree',
  pattern: keyword('spantree'),
  longer_alt: Identifier,
});

export const Cache = createToken({
  name: 'Cache',
  pattern: keyword('cache'),
  longer_alt: Identifier,
});

export const Bulk = createToken({
  name: 'Bulk',
  pattern: keyword('bulk'),
  longer_alt: Identifier,
});

export const Incremental = createToken({
  name: 'Incremental',
  pattern: keyword('incremental'),
  longer_alt: Identifier,
});

export const Leaves = createToken({
  name: 'Leaves',
  pattern: keyword('leaves'),
  longer_alt: Identifier,
});

export const Only = createToken({
  name: 'Only',
  pattern: keyword('only'),
  longer_alt: Identifier,
});

export const Ascending = createToken({
  name: 'Ascending',
  pattern: keyword('ascending'),
  longer_alt: Identifier,
});

export const Descending = createToken({
  name: 'Descending',
  pattern: keyword('descending'),
  longer_alt: Identifier,
});

export const ErrorKeyword = createToken({
  name: 'Error',
  pattern: keyword('error'),
  longer_alt: Identifier,
});

export const Ignore = createToken({
  name: 'Ignore',
  pattern: keyword('ignore'),
  longer_alt: Identifier,
});

export const Breakup = createToken({
  name: 'Breakup',
  pattern: keyword('breakup'),
  longer_alt: Identifier,
});

export const Force = createToken({
  name: 'Force',
  pattern: keyword('force'),
  longer_alt: Identifier,
});

/** `FOR` — must be listed AFTER `Force` (`for` is a prefix of `force`). */
export const For = createToken({
  name: 'For',
  pattern: keyword('for'),
  longer_alt: Identifier,
});

export const By = createToken({
  name: 'By',
  pattern: keyword('by'),
  longer_alt: Identifier,
});

/** `OFF` — must be listed BEFORE `Of` (`of` is a prefix of `off`). */
export const Off = createToken({
  name: 'Off',
  pattern: keyword('off'),
  longer_alt: Identifier,
});

// ---- DCL additions ---------------------------------------------------------

export const Inheriting = createToken({
  name: 'Inheriting',
  pattern: keyword('inheriting'),
  longer_alt: Identifier,
});

export const Inherit = createToken({
  name: 'Inherit',
  pattern: keyword('inherit'),
  longer_alt: Identifier,
});

export const Conditions = createToken({
  name: 'Conditions',
  pattern: keyword('conditions'),
  longer_alt: Identifier,
});

export const Super = createToken({
  name: 'Super',
  pattern: keyword('super'),
  longer_alt: Identifier,
});

export const Void = createToken({
  name: 'Void',
  pattern: keyword('void'),
  longer_alt: Identifier,
});

export const Combination = createToken({
  name: 'Combination',
  pattern: keyword('combination'),
  longer_alt: Identifier,
});

export const Mode = createToken({
  name: 'Mode',
  pattern: keyword('mode'),
  longer_alt: Identifier,
});

export const Optional = createToken({
  name: 'Optional',
  pattern: keyword('optional'),
  longer_alt: Identifier,
});

export const Elements = createToken({
  name: 'Elements',
  pattern: keyword('elements'),
  longer_alt: Identifier,
});

/**
 * `IN` — must be listed AFTER every `in*` keyword (`inner`, `intersect`,
 * `include`, `inherit`, `inheriting`, `incremental`), because `in` is a
 * prefix of all of them.
 */
export const In = createToken({
  name: 'In',
  pattern: keyword('in'),
  longer_alt: Identifier,
});

// Operators for simple expressions inside where-clauses / associations
export const EqEq = createToken({ name: 'EqEq', pattern: /==/ });
export const FatArrow = createToken({ name: 'FatArrow', pattern: /=>/ });
export const Eq = createToken({ name: 'Eq', pattern: /=/ });
export const NotEq = createToken({ name: 'NotEq', pattern: /!=|<>/ });
export const LtEq = createToken({ name: 'LtEq', pattern: /<=/ });
export const GtEq = createToken({ name: 'GtEq', pattern: />=/ });
export const Lt = createToken({ name: 'Lt', pattern: /</ });
export const Gt = createToken({ name: 'Gt', pattern: />/ });
export const Quest = createToken({ name: 'Quest', pattern: /\?/ });

export const And = createToken({
  name: 'And',
  pattern: keyword('and'),
  longer_alt: Identifier,
});

export const Or = createToken({
  name: 'Or',
  pattern: keyword('or'),
  longer_alt: Identifier,
});

// ============================================
// Symbols
// ============================================

export const At = createToken({ name: 'At', pattern: /@/ });
export const Colon = createToken({ name: 'Colon', pattern: /:/ });
/** `$` — prefix of system variables such as `$session`, `$parameters`, `$projection`. */
export const Dollar = createToken({ name: 'Dollar', pattern: /\$/ });
export const Semicolon = createToken({ name: 'Semicolon', pattern: /;/ });
export const Dot = createToken({ name: 'Dot', pattern: /\./ });
export const Comma = createToken({ name: 'Comma', pattern: /,/ });
export const LBrace = createToken({ name: 'LBrace', pattern: /\{/ });
export const RBrace = createToken({ name: 'RBrace', pattern: /\}/ });
export const LParen = createToken({ name: 'LParen', pattern: /\(/ });
export const RParen = createToken({ name: 'RParen', pattern: /\)/ });
export const LBracket = createToken({ name: 'LBracket', pattern: /\[/ });
export const RBracket = createToken({ name: 'RBracket', pattern: /\]/ });
export const Star = createToken({ name: 'Star', pattern: /\*/ });
export const Plus = createToken({ name: 'Plus', pattern: /\+/ });
export const Minus = createToken({ name: 'Minus', pattern: /-/ });
export const Slash = createToken({ name: 'Slash', pattern: /\// });

// ============================================
// Token list (ORDER MATTERS)
// Keywords must come before Identifier
// ============================================

/**
 * All keyword tokens. Exported so the parser can derive its name-token set
 * (every keyword may legally appear as an identifier in CDS).
 */
export const keywordTokens = [
  // NOTE: longer keywords that share a prefix with shorter ones (e.g.
  // `association` starts with `as`, `one` starts with `on`, `in` is a
  // prefix of `inner`) MUST be listed before the shorter keyword otherwise
  // Chevrotain's lexer will complain that they are unreachable.
  Association,
  Composition,
  Abstract,
  Annotate,
  AnnotationKeyword,
  Accesspolicy,
  Ascending,
  Aspect,
  Allowed,
  As,
  Define,
  Table,
  Structure,
  Type,
  Service,
  Expose,
  Entity,
  With,
  Key,
  Not,
  Null,
  Include,
  Suffix,
  True,
  False,
  Abap,
  One,
  // NOTE: `Only` must precede `On` (`on` is a prefix of `only`).
  Only,
  View,
  Projection,
  Select,
  From,
  On,
  To,
  Many,
  // NOTE: `Off` must precede `Of` (`of` is a prefix of `off`).
  Off,
  Of,
  Parameters,
  Role,
  Grant,
  Where,
  Custom,
  Virtual,
  Redirected,
  Redefine,
  Redefinition,
  Default,
  Distinct,
  Union,
  Intersect,
  Except,
  All,
  Group,
  Having,
  Root,
  Writable,
  Switchable,
  Exact,
  Parents,
  Parent,
  Child,
  Localized,
  Filter,
  Bind,
  FunctionKeyword,
  Returns,
  Implemented,
  Method,
  Scalar,
  Hierarchy,
  Extend,
  External,
  Provider,
  Provided,
  Contract,
  Name,
  Federated,
  Data,
  AtKeyword,
  Runtime,
  Case,
  When,
  Then,
  Else,
  End,
  Like,
  Between,
  Over,
  Partition,
  Siblings,
  Order,
  Orphans,
  Optional,
  Start,
  Source,
  Directory,
  Period,
  Valid,
  Depth,
  Nodetype,
  Load,
  Multiple,
  Cycles,
  Generate,
  Spantree,
  Cache,
  Bulk,
  Incremental,
  Leaves,
  Descending,
  ErrorKeyword,
  Ignore,
  Breakup,
  Force,
  For,
  By,
  Conditions,
  Inheriting,
  Inherit,
  Super,
  Void,
  Combination,
  Mode,
  Elements,
  Join,
  Inner,
  Left,
  Right,
  Cross,
  Full,
  // NOTE: `Outer`/`Order`/`Orphans`/`Optional` must precede `Or`.
  Outer,
  And,
  Or,
  // NOTE: `In` must come after every `in*` keyword.
  In,
];

export const allTokens = [
  // Whitespace & comments (skipped)
  WhiteSpace,
  LineComment,
  BlockComment,
  SqlLineComment,

  // Literals
  StringLiteral,
  NumberLiteral,
  EnumLiteral,

  // Keywords (before Identifier!)
  ...keywordTokens,

  // Identifier (catch-all for names)
  Identifier,

  // Multi-char symbols (before single-char equivalents)
  EqEq,
  NotEq,
  LtEq,
  GtEq,
  FatArrow,

  // Symbols
  At,
  Colon,
  Dollar,
  Semicolon,
  Dot,
  Comma,
  LBrace,
  RBrace,
  LParen,
  RParen,
  LBracket,
  RBracket,
  Eq,
  Lt,
  Gt,
  Quest,
  Star,
  Plus,
  Minus,
  Slash,
];

export const CdsLexer = new Lexer(allTokens);
