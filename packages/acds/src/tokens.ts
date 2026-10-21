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
  return new RegExp(word, 'i');
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
// `RIGHT [OUTER] JOIN` and `CROSS JOIN`. The keywords are tokenized
// separately so the parser can normalize the different spellings.

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

/**
 * `OUTER` — must be listed BEFORE `Or`, because `or` is a prefix of `outer`
 * and the lexer resolves the first matching token in list order.
 */
export const Outer = createToken({
  name: 'Outer',
  pattern: keyword('outer'),
  longer_alt: Identifier,
});

// Operators for simple expressions inside where-clauses / associations
export const EqEq = createToken({ name: 'EqEq', pattern: /==/ });
export const Eq = createToken({ name: 'Eq', pattern: /=/ });
export const NotEq = createToken({ name: 'NotEq', pattern: /!=|<>/ });
export const LtEq = createToken({ name: 'LtEq', pattern: /<=/ });
export const GtEq = createToken({ name: 'GtEq', pattern: />=/ });
export const Lt = createToken({ name: 'Lt', pattern: /</ });
export const Gt = createToken({ name: 'Gt', pattern: />/ });

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
  // NOTE: longer keywords that share a prefix with shorter ones (e.g.
  // `association` starts with `as`, `one` starts with `on`) MUST be listed
  // before the shorter keyword otherwise Chevrotain's lexer will complain
  // that they are unreachable.
  Association,
  Composition,
  Abstract,
  Annotate,
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
  As,
  Include,
  Suffix,
  True,
  False,
  Abap,
  One,
  View,
  Projection,
  Select,
  From,
  On,
  To,
  Many,
  Of,
  Parameters,
  Role,
  Grant,
  Where,
  Custom,
  Virtual,
  Redirected,
  Default,
  Join,
  Inner,
  Left,
  Right,
  Cross,
  // NOTE: `Outer` must precede `Or` ("or" is a prefix of "outer").
  Outer,
  And,
  Or,

  // Identifier (catch-all for names)
  Identifier,

  // Multi-char symbols (before single-char equivalents)
  EqEq,
  NotEq,
  LtEq,
  GtEq,

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
  Star,
  Plus,
  Minus,
  Slash,
];

export const CdsLexer = new Lexer(allTokens);
