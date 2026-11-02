// Source normalization shared by the Node worker and the browser worker.
//
// Real-world TikZ arrives as Markdown fences, JSON-escaped strings, bare
// pictures with `\usepackage` lines in front, article/beamer documents, Czech
// labels with Unicode symbols, `_`/`&`/`%` in node text, colours from CSS and
// packages the bundled TeX tree does not ship. `prepareTikzDocument` turns all
// of that into one standalone document the DVI→SVG pipeline accepts, and
// `describeTikzFailure` turns a failed run into one short, actionable line.
//
// The TeX is parsed with unified-latex (PEG LaTeX parser; comments, groups,
// math, environments and macro arguments become an AST) and printed back with
// its raw printer. Regular expressions only touch what is not TeX: Markdown
// fences, JSON escapes, the TeX log, and keyword lookups for library detection.

import { getParser, parseMinimal } from '@unified-latex/unified-latex-util-parse';
import { printRaw } from '@unified-latex/unified-latex-util-print-raw';
import { parsePgfkeys } from '@unified-latex/unified-latex-util-pgfkeys';
import { BUNDLED_PACKAGES, BUNDLED_PGFPLOTS_LIBRARIES, BUNDLED_TIKZ_LIBRARIES } from './bundled.js';
import * as T from './tables.js';

export const DEFAULT_LIBRARIES = ['calc', 'intersections', 'angles', 'quotes', 'arrows.meta', 'positioning'];

/** Thrown before compilation when no picture can be made from the input. */
export class TikzSourceError extends Error {
  constructor(message) { super(message); this.name = 'TikzSourceError'; }
}

const parsers = new Map();
/**
 * A parser whose macro table omits `excluded`: names the document defines
 * itself (`\def\ang{60}`, `\foreach \num in …`) must not get siunitx's or
 * tkz-euclide's argument signature, or `(\ang:2)` re-prints as `(\ang{:}2)`.
 */
function parserFor(excluded) {
  const key = [...excluded].sort().join(' ');
  let parser = parsers.get(key);
  if (!parser) {
    const macros = key ? Object.fromEntries(Object.entries(T.MACRO_SIGNATURES).filter(([name]) => !excluded.has(name))) : T.MACRO_SIGNATURES;
    parser = getParser({ macros, environments: T.ENVIRONMENT_SIGNATURES });
    if (parsers.size > 64) parsers.delete(parsers.keys().next().value);
    parsers.set(key, parser);
  }
  return parser;
}
const DEFINING = new Set(['def', 'edef', 'gdef', 'xdef', 'let', 'newcommand', 'renewcommand', 'providecommand', 'DeclareRobustCommand', 'NewDocumentCommand', 'RenewDocumentCommand', 'ProvideDocumentCommand', 'DeclareDocumentCommand', 'newcommandx', 'pgfmathsetmacro', 'pgfmathtruncatemacro', 'pgfmathsetlengthmacro', 'pgfmathsetlength', 'newlength', 'newdimen', 'newcount', 'newcounter', 'newsavebox', 'newif', 'setlength', 'DeclareMathOperator']);
/** Discover bindings from the PEG parser's unprocessed tokens, never comments. */
export function definedMacroNames(text) {
  const names = new Set();
  const root = parseMinimal(text).content;
  walkArrays(root, array => {
    for (let i = 0; i < array.length; i++) {
      const node = array[i];
      if (!isMacro(node)) continue;
      if (DEFINING.has(node.content)) {
        let next = skipSpace(array, i + 1);
        if (isString(array[next], '*')) next = skipSpace(array, next + 1);
        const target = isGroup(array[next]) ? array[next].content.find(child => !isSpace(child)) : array[next];
        if (isMacro(target)) names.add(target.content);
      } else if (node.content === 'foreach') {
        for (let j = i + 1; j < array.length; j++) {
          if (isString(array[j], 'in') || isGroup(array[j])) break;
          if (isMacro(array[j])) names.add(array[j].content);
        }
      } else if (node.content === 'tikzmath') {
        const group = array[skipSpace(array, i + 1)];
        if (isGroup(group)) walkArrays(group.content, tokens => {
          for (let j = 0; j < tokens.length; j++) if (isMacro(tokens[j]) && isString(tokens[skipSpace(tokens, j + 1)], '=')) names.add(tokens[j].content);
        });
      } else if (node.content === 'pgfkeysgetvalue') {
        const value = array[skipSpace(array, skipSpace(array, i + 1) + 1)];
        const target = isGroup(value) ? value.content[0] : value;
        if (isMacro(target)) names.add(target.content);
      }
    }
  });
  return names;
}
/** Parse LaTeX into unified-latex's AST (`root.content` is the node list). */
export function parseLatex(text, excluded = definedMacroNames(text)) { return parserFor(excluded).parse(text); }

// ------------------------------------------------------------ node helpers

const str = content => ({ type: 'string', content });
const macro = (content, args) => (args ? { type: 'macro', content, args } : { type: 'macro', content });
const inlineMath = content => ({ type: 'inlinemath', content });
const isMacro = (node, name) => node?.type === 'macro' && (name == null || node.content === name);
const isString = (node, content) => node?.type === 'string' && (content == null || node.content === content);
const isSpace = node => node?.type === 'whitespace' || node?.type === 'parbreak';
const isGroup = node => node?.type === 'group';
const groupText = node => (isGroup(node) ? printRaw(node.content).trim() : '');
const argText = (node, index) => { const argument = node?.args?.[index]; return argument ? printRaw(argument.content).trim() : ''; };
const hasArgs = node => Array.isArray(node?.args) && node.args.length > 0;
const splitList = value => value.split(',').map(part => part.trim()).filter(Boolean);

/** Index of the string token closing the `open`…`close` pair that starts at `from` (same array level), or -1. */
function matchingToken(nodes, from, open, close) {
  let depth = 0;
  for (let i = from; i < nodes.length; i++) {
    if (isString(nodes[i], open)) depth++;
    else if (isString(nodes[i], close) && --depth === 0) return i;
  }
  return -1;
}

function skipSpace(nodes, i) { while (i < nodes.length && isSpace(nodes[i])) i++; return i; }

/** End index of the generic trailing arguments (`[…]`, `{…}`, `(…)`, `*`) a macro without a known signature takes. */
function takeArgs(nodes, i) {
  let end = i;
  for (;;) {
    const j = skipSpace(nodes, end);
    const node = nodes[j];
    if (isGroup(node)) end = j + 1;
    else if (isString(node, '[')) { const close = matchingToken(nodes, j, '[', ']'); if (close < 0) return end; end = close + 1; }
    else if (isString(node, '(')) { const close = matchingToken(nodes, j, '(', ')'); if (close < 0) return end; end = close + 1; }
    else if (isString(node, '*') && j === end) end = j + 1;
    else return end;
  }
}

/** End index just past the string token containing `;` (a path statement), or the array end. */
function pathEnd(nodes, i) {
  for (let j = i; j < nodes.length; j++) if (isString(nodes[j]) && nodes[j].content.includes(';')) return j + 1;
  return nodes.length;
}

/** Walk every node array in the tree (environment/group/argument/math content), parents first. */
function walkArrays(nodes, visit, context = {}) {
  visit(nodes, context);
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    const next = node._inDefinition ? { ...context, inDefinition: true } : context;
    if (Array.isArray(node.args)) for (const argument of node.args) if (Array.isArray(argument.content)) walkArrays(argument.content, visit, { ...next, inArgOf: node.content });
    if (Array.isArray(node.content)) walkArrays(node.content, visit, { ...next, parent: node });
  }
}

/**
 * The parser brackets every sub/superscript argument (`C_A` → `C_{A}`), which
 * renames TikZ coordinates and nodes. Print single-token scripts without braces.
 */
function tightScripts(root) {
  walkArrays(root, array => {
    for (const node of array) {
      if (!isMacro(node) || (node.content !== '_' && node.content !== '^') || !hasArgs(node)) continue;
      const argument = node.args[node.args.length - 1];
      const content = argument.content.filter(child => !isSpace(child));
      if (content.length === 1 && ((isString(content[0]) && content[0].content.length === 1) || isMacro(content[0]))) { argument.openMark = ''; argument.closeMark = ''; argument.content = content; }
    }
  });
}

/** Every string node in the tree. */
function visitStrings(nodes, fn) {
  walkArrays(nodes, array => { for (const node of array) if (node?.type === 'string') fn(node); });
}

// ------------------------------------------------------------ input cleanup

const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF\uFE0E\uFE0F]/g;
const ODD_SPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;
const ENTITY = /&(?:gt|lt|amp|quot|apos|nbsp|#\d+|#x[0-9a-fA-F]+);/g;
const HAS_ENTITY = /&(?:gt|lt|amp|quot|apos|nbsp|#\d+|#x[0-9a-fA-F]+);/;
const FENCE = /```[ \t]*([\w+-]*)[^\n]*\n([\s\S]*?)(?:\n[ \t]*```|$)/g;

function decodeEntities(text) {
  return text.replace(ENTITY, entity => {
    switch (entity.toLowerCase()) {
      case '&gt;': return '>';
      case '&lt;': return '<';
      case '&quot;': return '"';
      case '&apos;': return "'";
      case '&nbsp;': return ' ';
      case '&amp;': return '&';
      default: {
        const code = entity[2] === 'x' || entity[2] === 'X' ? parseInt(entity.slice(3, -1), 16) : parseInt(entity.slice(2, -1), 10);
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : entity;
      }
    }
  });
}

/** `\\begin{tikzpicture}\n\\draw …` (a JSON string pasted verbatim) → real TeX. */
function unescapeDoubled(text) {
  const doubled = /\\\\(?:begin|draw|node|fill|path|documentclass|coordinate|usetikzlibrary|tikz)\b/;
  const single = /(?:^|[^\\])\\(?:begin|draw|node|fill|path|documentclass|coordinate|usetikzlibrary|tikz)\b/;
  if (!doubled.test(text) || single.test(text)) return text;
  return text.replace(/\\\\/g, '\u0000').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\u0000/g, '\\');
}

/** Keep the TeX inside Markdown fences, dropping the prose around them. */
function unfence(text) {
  if (!text.includes('```')) return text.replace(/^[ \t]*(?:tikz|latex|tex)[ \t]*\n/i, '');
  const blocks = [];
  for (const match of text.matchAll(FENCE)) {
    const language = match[1].toLowerCase();
    if (!language || /^(?:tikz|latex|tex|pgf|tikzpicture)$/.test(language)) blocks.push(match[2]);
  }
  if (blocks.length) return blocks.join('\n\n');
  return text.replace(/^[ \t]*```[^\n]*\n?/gm, '');
}

/**
 * `50%` in a label is a percent sign, not a comment: a `%` right after a digit
 * becomes `\%` unless the line is already inside a comment.
 */
function literalPercents(text) {
  return text.split('\n').map(line => {
    let out = '';
    let comment = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (comment) { out += char; continue; }
      if (char === '\\') { out += char + (line[i + 1] ?? ''); i++; continue; }
      if (char === '%') {
        if (/\d/.test(line[i - 1] ?? '')) { out += '\\%'; continue; }
        comment = true;
      }
      out += char;
    }
    return out;
  }).join('\n');
}

/** Normalize encoding noise before any TeX-level work. */
export function cleanInput(code) {
  let text = String(code ?? '').replace(/\r\n?/g, '\n').replace(ZERO_WIDTH, '').replace(ODD_SPACES, ' ').replace(/\u2011/g, '-');
  if (HAS_ENTITY.test(text)) text = decodeEntities(text);
  text = unescapeDoubled(text);
  text = unfence(text);
  return literalPercents(text).trim();
}

// --------------------------------------------------------- statement reader

/**
 * Read one top-level statement starting at `nodes[i]`.
 * Returns { kind, name, env, end } where kind is one of
 * picture | inner | path | command | begin | end | env | prose.
 */
function readStatement(nodes, i) {
  const node = nodes[i];
  if (node.type === 'environment') {
    if (T.PICTURE_ENVS.has(node.env)) return { kind: 'picture', env: node.env, end: i + 1 };
    if (T.INNER_ENVS.has(node.env)) return { kind: 'inner', env: node.env, end: i + 1 };
    return { kind: 'env', env: node.env, end: i + 1 };
  }
  if (node.type !== 'macro') return { kind: 'prose', end: i + 1 };
  const name = node.content;
  if (name === 'begin' || name === 'end') {
    // An environment the parser could not close (no `\end{…}`): `\begin` + group.
    const env = groupText(nodes[i + 1]);
    const end = isGroup(nodes[i + 1]) ? i + 2 : i + 1;
    if (name === 'begin' && (T.PICTURE_ENVS.has(env) || T.INNER_ENVS.has(env))) {
      const synthesized = { type: 'environment', env, args: [], content: nodes.slice(end) };
      return { kind: T.PICTURE_ENVS.has(env) ? 'picture' : 'inner', env, end: nodes.length, replacement: synthesized };
    }
    return { kind: name, env, end };
  }
  if (name === 'schemestart') {
    let end = i + 1;
    while (end < nodes.length && !isMacro(nodes[end], 'schemestop')) end++;
    return { kind: 'picture', name, end: Math.min(nodes.length, end + 1) };
  }
  if (name === 'tikz' || T.PICTURE_MACROS.has(name)) return { kind: 'picture', name, end: hasArgs(node) ? i + 1 : takeArgs(nodes, i + 1) };
  if (name.startsWith('tkz')) return { kind: 'path', name, end: takeArgs(nodes, i + 1) };
  if (T.PATH_COMMANDS.has(name)) {
    if (hasArgs(node) && node.args.some(argument => argument.closeMark === ';')) return { kind: 'path', name, end: i + 1 };
    if (name === 'foreach') {
      // `\foreach \x in {list} {body}` or `\foreach … \draw …;`
      let j = i + 1;
      while (j < nodes.length && !isGroup(nodes[j])) j++;
      const afterList = skipSpace(nodes, j + 1);
      if (isGroup(nodes[afterList])) return { kind: 'path', name, end: afterList + 1 };
      return { kind: 'path', name, end: pathEnd(nodes, j + 1) };
    }
    return { kind: 'path', name, end: pathEnd(nodes, i + 1) };
  }
  if (name === 'def' || name === 'gdef' || name === 'edef' || name === 'xdef') {
    let j = i + 1;
    while (j < nodes.length && !isGroup(nodes[j])) j++;
    return { kind: 'command', name, end: Math.min(nodes.length, j + 1) };
  }
  if (name === 'let' || name === 'futurelet' || name === 'newif') {
    let j = skipSpace(nodes, i + 1);
    let macros = 0;
    const wanted = name === 'newif' ? 1 : 2;
    while (j < nodes.length && macros < wanted) { if (isMacro(nodes[j])) macros++; else if (!isSpace(nodes[j]) && !isString(nodes[j], '=')) break; j++; }
    return { kind: 'command', name, end: j };
  }
  if (name === 'tikzstyle') {
    let end = hasArgs(node) ? i + 1 : takeArgs(nodes, i + 1);
    let j = skipSpace(nodes, end);
    if (isString(nodes[j], '+')) j++;
    if (isString(nodes[j], '=')) {
      j = skipSpace(nodes, j + 1);
      if (isString(nodes[j], '[')) { const close = matchingToken(nodes, j, '[', ']'); if (close > 0) end = close + 1; }
    }
    return { kind: 'command', name, end };
  }
  return { kind: 'command', name, end: hasArgs(node) ? i + 1 : takeArgs(nodes, i + 1) };
}

/** Which environments wrap pictures without meaning here. */
function unwrapEnv(env, bare) {
  return T.UNWRAP_ALWAYS.has(env) || (bare && T.UNWRAP_BARE.has(env));
}

/** A statement's nodes for printing (the synthesized environment when the source never closed it). */
function statementNodes(nodes, i, statement) {
  return statement.replacement ? [statement.replacement] : nodes.slice(i, statement.end);
}

/**
 * Split a node list into preamble statements and body parts.
 * bare: prose, wrappers and typesetting commands around pictures are dropped.
 * full: body prose is kept; only preamble-only commands move up.
 */
function classify(nodes, { bare, preamble, body }) {
  for (let i = 0; i < nodes.length;) {
    const node = nodes[i];
    if (isSpace(node) || node.type === 'comment') {
      if (!bare) body.push({ kind: 'text', nodes: [node] });
      i++;
      continue;
    }
    const statement = readStatement(nodes, i);
    const slice = statementNodes(nodes, i, statement);
    i = Math.max(statement.end, i + 1);
    switch (statement.kind) {
      case 'picture':
      case 'inner':
      case 'path':
        body.push({ kind: statement.kind, nodes: slice });
        break;
      case 'env':
        if (unwrapEnv(statement.env, bare)) classify(node.content, { bare, preamble, body });
        else if (!bare) body.push({ kind: 'text', nodes: slice });
        break;
      case 'begin':
      case 'end':
        if (!bare && !unwrapEnv(statement.env, bare)) body.push({ kind: 'text', nodes: slice });
        break;
      case 'prose':
        if (isGroup(node)) classify(node.content, { bare, preamble, body });
        else if (!bare) body.push({ kind: 'text', nodes: slice });
        break;
      case 'command':
        if (T.HOISTED_COMMANDS.has(statement.name)) preamble.push(slice);
        else if (bare) {
          if (!T.DROP_AROUND_PICTURE.has(statement.name)) preamble.push(slice);
        } else if (T.DROP_IN_BODY.has(statement.name)) { /* slide chrome */ }
        else body.push({ kind: 'text', nodes: slice });
        break;
      default:
        break;
    }
  }
}

/** Move preamble-only macros found inside pictures (e.g. `\usepackage` in a tikzpicture) to the preamble. */
function hoistNested(parts, preamble) {
  for (const part of parts) {
    walkArrays(part.nodes, array => {
      for (let i = 0; i < array.length;) {
        const node = array[i];
        if (isMacro(node) && T.HOISTED_COMMANDS.has(node.content)) {
          const end = hasArgs(node) ? i + 1 : takeArgs(array, i + 1);
          preamble.push(array.slice(i, end));
          array.splice(i, end - i);
        } else i++;
      }
    });
  }
}

/** Box and slide environments nested anywhere (tcolorbox inside minipage, frame inside …) keep only their content. */
function unwrapNested(parts, bare) {
  for (const part of parts) {
    walkArrays(part.nodes, array => {
      for (let i = 0; i < array.length;) {
        const node = array[i];
        if (node?.type === 'environment' && unwrapEnv(node.env, bare)) array.splice(i, 1, ...node.content);
        else i++;
      }
    });
  }
}

/** Reject unbalanced braces up front: the parser leaves stray `{`/`}` as string tokens. */
function checkBraces(parts, source) {
  for (const part of parts) {
    walkArrays(part.nodes, array => {
      for (const node of array) {
        if (isString(node, '{') || isString(node, '}')) {
          const line = node.position?.start?.line;
          const context = line ? source.split('\n')[line - 1]?.trim().slice(0, 80) : printRaw(array).slice(0, 80);
          throw new TikzSourceError(`Unbalanced braces: a '${node.content}' has no match near "${context}".`);
        }
      }
    });
  }
}

/** Bare pictures: loose paths and inner environments get a tikzpicture of their own. */
function assembleBareBody(parts) {
  const blocks = [];
  let loose = [];
  const flush = () => {
    if (!loose.length) return;
    blocks.push({ type: 'environment', env: 'tikzpicture', args: [], content: [str('\n'), ...loose.flatMap(nodes => [...nodes, str('\n')])] });
    blocks.push(str('\n\n'));
    loose = [];
  };
  for (const part of parts) {
    if (part.kind === 'picture') { flush(); blocks.push(...part.nodes, str('\n\n')); }
    else loose.push(part.nodes);
  }
  flush();
  return blocks;
}

/** Split the input into { full, preamble: Node[][], bodyText }. */
function structure(text, excluded) {
  const root = parseLatex(text, excluded);
  const nodes = root.content;
  const classIndex = nodes.findIndex(node => isMacro(node, 'documentclass'));
  const docIndex = nodes.findIndex(node => node.type === 'environment' && node.env === 'document');
  const beginDoc = nodes.findIndex((node, index) => isMacro(node, 'begin') && groupText(nodes[index + 1]) === 'document');
  const full = classIndex >= 0 || docIndex >= 0 || beginDoc >= 0;
  const preamble = [];
  const body = [];
  if (!full) {
    classify(nodes, { bare: true, preamble, body });
  } else {
    const start = classIndex >= 0 ? classIndex + 1 : 0;
    const before = classIndex > 0 ? nodes.slice(0, classIndex) : [];
    let preambleNodes, bodyNodes;
    if (docIndex >= 0) { preambleNodes = nodes.slice(start, docIndex); bodyNodes = nodes[docIndex].content; }
    else if (beginDoc >= 0) { preambleNodes = nodes.slice(start, beginDoc); bodyNodes = nodes.slice(beginDoc + 2); }
    else {
      let at = -1;
      for (let i = start; i < nodes.length; i++) {
        if (isSpace(nodes[i]) || nodes[i].type === 'comment') continue;
        const kind = readStatement(nodes, i).kind;
        if (kind !== 'command') { at = i; break; }
      }
      preambleNodes = at < 0 ? nodes.slice(start) : nodes.slice(start, at);
      bodyNodes = at < 0 ? [] : nodes.slice(at);
    }
    classify([...before, ...preambleNodes], { bare: true, preamble, body: [] });
    classify(bodyNodes, { bare: false, preamble, body });
  }
  unwrapNested(body, !full);
  hoistNested(body, preamble);
  checkBraces(body, text);
  const bodyNodes = full ? body.flatMap(part => part.nodes) : assembleBareBody(body);
  return { full, preamble, body: bodyNodes };
}

// ------------------------------------------------------------ pgfkeys passes

/** Colour macros inside a `font=` value, removed in place; returns the last colour name. */
function pullColors(nodes) {
  let color = null;
  for (let i = 0; i < nodes.length;) {
    const node = nodes[i];
    if (isMacro(node, 'color') && hasArgs(node)) {
      color = argText(node, node.args.length - 1) || color;
      nodes.splice(i, 1);
      continue;
    }
    if (isGroup(node)) color = pullColors(node.content) ?? color;
    i++;
  }
  return color;
}

function significant(nodes) { return nodes.filter(node => !isSpace(node) && !(isGroup(node) && !significant(node.content).length)); }

/**
 * Rewrite one pgfkeys list (the nodes between `[` and `]`, or a `\tikzset`
 * argument) in place: `font=…\color{c}` becomes `font=…, text=c`, nested
 * `.style={…}` lists recurse, and label/pin texts get the node-text repairs.
 */
function processKeyList(nodes, context) {
  let items;
  try { items = parsePgfkeys(nodes); } catch { return; }
  items = mergeParenthesisedValues(items);
  const rebuilt = [];
  const trailing = [];
  for (const item of items) {
    const parts = item.itemParts ?? [];
    if (!parts.length) continue;
    const key = printRaw(parts[0]).trim();
    const value = parts[1];
    if (value && TEXT_KEYS.has(key)) repairTextNodes(value, context);
    if (value && /^(?:xtick|ytick|ztick)labels$|^legend entries$/.test(key)) for (const node of value) if (isGroup(node)) repairTextNodes(node.content, context);
    const styleName = /^(.+?)\/\.(?:style|append style)$/.exec(key)?.[1];
    if (styleName && value) for (const node of value) if (isGroup(node)) unloopStyle(node.content, styleName);
    if (key === 'font' && value) {
      const color = pullColors(value);
      if (color) {
        trailing.push([str('text'), str('='), str(color)]);
        if (!significant(value).length) continue; // the key only carried the colour
      }
    }
    if (value && /\/\.(?:style|append style|style 2 args|style n args|prefix style|append)\b/.test(key)) {
      for (const node of value) if (isGroup(node)) processKeyList(node.content, context);
    }
    if (value && (key === 'label' || key === 'pin')) {
      const inner = value.length === 1 && isGroup(value[0]) ? value[0].content : value;
      let at = 0;
      if (isString(inner[at], '[')) { const close = matchingToken(inner, at, '[', ']'); if (close > 0) { const options = inner.slice(at + 1, close); processKeyList(options, context); inner.splice(at + 1, close - at - 1, ...options); at = at + 1 + options.length + 1; } }
      const colon = inner.findIndex((node, index) => index >= at && isString(node, ':'));
      const textStart = colon >= 0 ? colon + 1 : at;
      const textNodes = inner.slice(textStart);
      repairTextNodes(textNodes, context);
      inner.splice(textStart, inner.length - textStart, ...textNodes);
    }
    rebuilt.push(keyItemNodes(parts));
  }
  nodes.splice(0, nodes.length, ...joinKeyItems([...rebuilt, ...trailing]));
}

const TEXT_KEYS = new Set(['xlabel', 'ylabel', 'zlabel', 'title', 'nodes near coords', 'text', 'node contents']);

/**
 * `shift=(1,2)` is split at the comma by pgfkeys; TikZ wants `shift={(1,2)}`.
 * Join the pieces of an item whose value has an unmatched `(` and brace it.
 */
function mergeParenthesisedValues(items) {
  const balance = nodes => { let depth = 0; for (const node of nodes) if (isString(node)) for (const char of node.content) { if (char === '(') depth++; else if (char === ')') depth--; } return depth; };
  const out = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const parts = item.itemParts ?? [];
    if (parts.length !== 2 || balance(parts[1]) <= 0) { out.push(item); continue; }
    const value = [...parts[1]];
    let depth = balance(value);
    while (depth > 0 && i + 1 < items.length && (items[i + 1].itemParts ?? []).length === 1) {
      const piece = items[++i].itemParts[0];
      value.push(str(','), { type: 'whitespace' }, ...piece);
      depth += balance(piece);
    }
    if (depth !== 0) { out.push(item); continue; }
    while (value.length && isSpace(value[0])) value.shift();
    while (value.length && isSpace(value[value.length - 1])) value.pop();
    out.push({ ...item, itemParts: [parts[0], [{ type: 'group', content: value }]] });
  }
  return out;
}

/**
 * `cloud/.style={cloud, draw}` recurses forever in TikZ (input stack
 * overflow): inside its own body the name means the shape, so say so.
 */
function unloopStyle(nodes, name) {
  let items;
  try { items = parsePgfkeys(nodes); } catch { return; }
  let changed = false;
  const kept = [];
  for (const item of items) {
    const parts = item.itemParts ?? [];
    if (parts.length === 1 && printRaw(parts[0]).trim() === name) {
      changed = true;
      if (T.SHAPE_NAMES.has(name)) kept.push([str('shape='), str(name)]);
      continue;
    }
    kept.push(keyItemNodes(parts));
  }
  if (changed) nodes.splice(0, nodes.length, ...joinKeyItems(kept));
}

/**
 * The nodes of one key list item, comments removed: a comment re-printed
 * inside a one-line option list would swallow every key after it.
 */
function keyItemNodes(parts) {
  const out = [];
  parts.forEach((part, index) => { if (index) out.push(str('=')); out.push(...stripComments(part)); });
  return out;
}
function stripComments(nodes) {
  const kept = [];
  for (const node of nodes) {
    if (node.type === 'comment') { if (kept.length && !isSpace(kept[kept.length - 1])) kept.push({ type: 'whitespace' }); continue; }
    if (isGroup(node)) kept.push({ ...node, content: stripComments(node.content) });
    else kept.push(node);
  }
  while (kept.length && isSpace(kept[kept.length - 1])) kept.pop();
  return kept;
}
function joinKeyItems(items) {
  const out = [];
  items.forEach((item, index) => { if (index) out.push(str(','), { type: 'whitespace' }); out.push(...item); });
  return out;
}

const KEY_LIST_MACROS = new Set(['tikzset', 'pgfkeys', 'pgfplotsset', 'ctikzset', 'tikzoption', 'pgfqkeys']);

/** Find every option list in the tree and run `processKeyList` on it. */
function processKeyLists(root, context) {
  walkArrays(root, (array, location) => {
    if (location.parent?.env === "forest") return;
    for (let i = 0; i < array.length; i++) {
      const node = array[i];
      if (isMacro(node, 'Tree')) {
        const start = skipSpace(array, i + 1);
        const end = isString(array[start], '[') ? matchingToken(array, start, '[', ']') : -1;
        if (end >= 0) { i = end; continue; }
      }
      if (isString(node, '[')) {
        const close = matchingToken(array, i, '[', ']');
        if (close < 0) continue;
        const inner = array.slice(i + 1, close);
        processKeyList(inner, context);
        array.splice(i + 1, close - i - 1, ...inner);
        i += inner.length + 1;
        continue;
      }
      if (node?.type === 'environment' && Array.isArray(node.args)) {
        for (const argument of node.args) if (argument.openMark === '[') processKeyList(argument.content, context);
      }
      if (isMacro(node) && KEY_LIST_MACROS.has(node.content) && hasArgs(node)) {
        for (const argument of node.args) if (argument.openMark === '{') processKeyList(argument.content, context);
      }
    }
  });
}

// ---------------------------------------------------------- node text repair

const DEFINITION_MACROS = new Set(['newcommand', 'renewcommand', 'providecommand', 'def', 'gdef', 'edef', 'xdef', 'tikzset', 'pgfkeys', 'pgfplotsset', 'tikzstyle', 'NewDocumentCommand', 'RenewDocumentCommand', 'ProvideDocumentCommand', 'DeclareDocumentCommand', 'newenvironment', 'renewenvironment', 'pgfmathdeclarefunction', 'pgfkeysdef', 'DeclareRobustCommand']);

/** Does a run of nodes need math mode to typeset? */
function needsMath(run) {
  for (const node of run) {
    if (isString(node) && /[_^]/.test(node.content)) return true;
    if (isMacro(node) && T.MATH_MACROS.has(node.content)) return true;
  }
  return false;
}

/**
 * Repair text-mode node content in place: display math becomes inline,
 * `&`/`#` are escaped, and words TeX only accepts in math mode (`x_1`,
 * `\frac{1}{2}`, `\alpha`) are wrapped in `$…$`.
 */
function repairTextNodes(nodes, context = {}) {
  const hash = !context.inDefinition;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type === 'displaymath') { nodes[i] = inlineMath([macro('displaystyle'), { type: 'whitespace' }, ...node.content]); continue; }
    if (node.type === 'parbreak') { nodes[i] = { type: 'whitespace' }; continue; }
    if (isString(node, '&')) { nodes[i] = macro('&'); continue; }
    if (isString(node, '#') && hash) { nodes[i] = macro('#'); continue; }
    if (isGroup(node)) repairTextNodes(node.content, context);
    if (isMacro(node) && T.TEXT_ARG_MACROS.has(node.content) && hasArgs(node)) for (const argument of node.args) repairTextNodes(argument.content, context);
  }
  // Wrap math-only runs. A run is a maximal sequence of non-whitespace nodes.
  for (let i = 0; i < nodes.length;) {
    if (isSpace(nodes[i])) { i++; continue; }
    let j = i;
    while (j < nodes.length && !isSpace(nodes[j])) j++;
    const run = nodes.slice(i, j);
    if (!run.every(node => node.type === 'inlinemath') && needsMath(run)) {
      nodes.splice(i, j - i, inlineMath(run.flatMap(node => (node.type === 'inlinemath' ? node.content : [node]))));
      i += 1;
    } else i = j;
  }
}

const TEXT_PATH_MACROS = new Set(['node', 'draw', 'fill', 'filldraw', 'path', 'shade', 'shadedraw', 'clip', 'pattern', 'graph', 'addplot']);

/** Repair the `{text}` of every node in a path token list. */
function repairPathTokens(tokens, startsWithNode, context) {
  let expecting = startsWithNode;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (isString(token, 'node')) { expecting = true; continue; }
    if (isString(token, 'pic') || isString(token, 'coordinate') || isMacro(token, 'matrix')) { expecting = false; continue; }
    if (!expecting) continue;
    if (isSpace(token)) continue;
    if (isString(token, '[')) { const close = matchingToken(tokens, i, '[', ']'); if (close < 0) return; i = close; continue; }
    if (isString(token, '(')) { const close = matchingToken(tokens, i, '(', ')'); if (close < 0) return; i = close; continue; }
    if (isString(token, 'at')) continue;
    if (isGroup(token)) { repairTextNodes(token.content, context); expecting = false; continue; }
    expecting = false;
  }
}

function markDefinition(node) {
  if (!node || typeof node !== 'object') return;
  node._inDefinition = true;
  if (Array.isArray(node.args)) for (const argument of node.args) for (const child of argument.content ?? []) markDefinition(child);
  if (Array.isArray(node.content)) for (const child of node.content) markDefinition(child);
}

/** Find node texts everywhere in the tree and repair them. */
function repairNodeTexts(root) {
  walkArrays(root, array => {
    for (let i = 0; i < array.length; i++) {
      const node = array[i];
      if (!isMacro(node)) continue;
      if (DEFINITION_MACROS.has(node.content)) {
        // The parameters of a definition (`#1`) are not text; mark the subtree.
        const end = hasArgs(node) ? i + 1 : takeArgs(array, i + 1);
        for (let j = i; j < end; j++) markDefinition(array[j]);
      }
    }
  });
  walkArrays(root, (array, info) => {
    const context = { inDefinition: Boolean(info.inDefinition) };
    for (let i = 0; i < array.length; i++) {
      const node = array[i];
      if (!isMacro(node) || !TEXT_PATH_MACROS.has(node.content)) continue;
      const pathArg = node.args?.find(argument => argument.closeMark === ';');
      if (pathArg) repairPathTokens(pathArg.content, node.content === 'node', { ...context, inDefinition: context.inDefinition || Boolean(node._inDefinition) });
      else {
        const end = pathEnd(array, i + 1);
        const tokens = array.slice(i + 1, end);
        repairPathTokens(tokens, node.content === 'node', { ...context, inDefinition: context.inDefinition || Boolean(node._inDefinition) });
        array.splice(i + 1, end - i - 1, ...tokens);
      }
    }
  });
}

// ------------------------------------------------------------- body passes

/** `fill=#ff0000` → `fill=hexFF0000`; `{HTML}{#abc}` → `{HTML}{AABBCC}`. */
function rewriteHexColors(root) {
  const expand = hex => (hex.length === 3 ? [...hex].map(c => c + c).join('') : hex).toUpperCase();
  const hexOf = node => (isString(node) && /^(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(node.content) ? node.content : null);
  walkArrays(root, array => {
    for (let i = 0; i < array.length - 1; i++) {
      if (!isString(array[i], '#')) continue;
      const value = hexOf(array[i + 1]);
      if (!value || (isString(array[i + 2]) && /^[0-9a-fA-F]/.test(array[i + 2].content))) continue;
      array.splice(i, 2, str(`hex${expand(value)}`));
    }
  });
  walkArrays(root, array => {
    for (let i = 0; i < array.length - 1; i++) {
      if (!isGroup(array[i]) || groupText(array[i]).toUpperCase() !== 'HTML') continue;
      const next = array.slice(i + 1).find(node => !isSpace(node));
      if (!isGroup(next)) continue;
      const content = printRaw(next.content).trim().replace(/^#/, '').replace(/^hex/i, '');
      if (/^(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(content)) next.content = [str(expand(content))];
    }
  });
}

/** `\providecolor` lines for every named or hex colour the source uses but does not define. */
function colorSupport(root, sourceText, defined, seen) {
  walkArrays(root, array => {
    for (const node of array) {
      if (isMacro(node) && /^(?:definecolor|colorlet|providecolor|definecolorset)$/.test(node.content) && hasArgs(node)) {
        const first = node.args.find(argument => argument.openMark === '{');
        if (first) defined.add(printRaw(first.content).trim());
      }
    }
  });
  const lines = [];
  const provide = (name, model, spec) => { if (!seen.has(name) && !defined.has(name)) { seen.add(name); lines.push(`\\providecolor{${name}}{${model}}{${spec}}`); } };
  visitStrings(root, node => {
    const token = node.content;
    if (!/^[A-Za-z]{3,}$/.test(token) || T.BASE_COLORS.has(token)) return;
    if (Object.hasOwn(T.DVIPS_COLORS, token)) provide(token, 'cmyk', T.DVIPS_COLORS[token]);
    else { const hex = T.CSS_COLORS[token.toLowerCase()]; if (hex) provide(token, 'HTML', hex); }
  });
  for (const match of sourceText.matchAll(/\bhex([0-9A-F]{6})\b/g)) provide(`hex${match[1]}`, 'HTML', match[1]);
  return lines;
}

/** Unicode declarations for the symbols used; unsupported glyphs are dropped from strings. */
function unicodeSupport(root, seen, declarations) {
  visitStrings(root, node => {
    if (!/[^\x00-\x7F]/.test(node.content)) return;
    let cleaned = '';
    for (const char of node.content) {
      const code = char.codePointAt(0);
      const replacement = T.UNICODE[char];
      if (replacement) {
        if (!seen.has(char)) { seen.add(char); declarations.push(`\\DeclareUnicodeCharacter{${code.toString(16).toUpperCase().padStart(4, '0')}}{${replacement}}`); }
        cleaned += char;
      } else if (code < 0x80 || T.isSupportedUnicode(char)) cleaned += char;
      else cleaned += code > 0x2000 ? '' : '?'; // emoji, CJK, Cyrillic: no bundled font
    }
    node.content = cleaned;
  });
}

/** `\ce{2H2 + O2 -> 2H2O}` → plain math, since mhchem is not bundled. */
function chemistryMath(formula) {
  return formula
    .replace(/<=>/g, '\\rightleftharpoons ').replace(/<->/g, '\\leftrightarrow ').replace(/->/g, '\\rightarrow ').replace(/<-/g, '\\leftarrow ')
    .replace(/([A-Za-z\])])(\d+)/g, '$1_{$2}').replace(/\^(\d*[+-])/g, '^{$1}').replace(/(?<![\\\w])(\d+)([+-])(?=\s|$|\))/g, '$1^{$2}')
    .replace(/\s*\+\s*/g, ' + ').replace(/\(\s*(s|l|g|aq)\s*\)/g, '(\\mathrm{$1})').replace(/\s{2,}/g, ' ').trim();
}

/** Replace macros that have no package here with something that typesets. */
function replaceUnavailableMacros(root, state) {
  walkArrays(root, array => {
    for (let i = 0; i < array.length; i++) {
      const node = array[i];
      if (!isMacro(node)) continue;
      if (node.content === 'ce') { addPackage(state, 'mhchem', []); continue; }
      if (/^fa[A-Z]/.test(node.content)) { state.unavailable.add('fontawesome'); array.splice(i, 1); i--; continue; }
      if (node.content === 'includegraphics') {
        const end = hasArgs(node) ? i + 1 : takeArgs(array, i + 1);
        const file = (hasArgs(node) ? argText(node, node.args.length - 1) : groupText(array[end - 1])) || 'image';
        array.splice(i, end - i, str(`\\fbox{\\strut\\texttt{${file.replace(/[\\{}#%&_^$~]/g, '')}}}`));
        continue;
      }
      if (node.content === 'insertframenumber' || node.content === 'inserttotalframenumber') array[i] = str('1');
    }
  });
}

/**
 * `ellipse (\a and \b)`: TeX drops the space after `\a`, so TikZ never sees
 * its ` and ` delimiter and pgfmath chokes on `1.5and 0.7`. `{\a} and \b`
 * keeps the delimiter visible.
 */
function protectAndDelimiter(root) {
  walkArrays(root, array => {
    for (let i = 0; i + 2 < array.length; i++) {
      const node = array[i];
      if (!isMacro(node) || hasArgs(node) || !/^[A-Za-z@]+$/.test(node.content) || T.MACRO_SIGNATURES[node.content]) continue;
      if (!isSpace(array[i + 1]) || !isString(array[i + 2]) || !/^and$/.test(array[i + 2].content)) continue;
      array[i] = { type: 'group', content: [node] };
    }
  });
}

/** Macro-name typos models make, with the intended TeX. */
function replaceTypos(root) {
  walkArrays(root, array => {
    for (let i = 0; i < array.length; i++) {
      const node = array[i];
      if (!isMacro(node)) continue;
      if ((node.content === '^' || node.content === '_') && hasArgs(node)) {
        // `25^\circC` parsed as `^{\circC}`: only the first replacement token stays in the script.
        const argument = node.args[node.args.length - 1];
        const inner = argument.content.filter(child => !isSpace(child));
        if (inner.length === 1 && isMacro(inner[0]) && T.MACRO_TYPOS[inner[0].content]) {
          const [head, ...rest] = parseLatex(T.MACRO_TYPOS[inner[0].content], new Set()).content;
          argument.content = [head];
          array.splice(i + 1, 0, ...rest);
        }
        continue;
      }
      if (!T.MACRO_TYPOS[node.content] || hasArgs(node)) continue;
      array.splice(i, 1, ...parseLatex(T.MACRO_TYPOS[node.content], new Set()).content);
    }
  });
}

/**
 * `\foreach \x/\lab in {0.25/{\tfrac{1}{4}}, …}`: a label item that only
 * works in math mode is wrapped in `\ensuremath`, which is right whether the
 * variable later lands in a node text or inside `$…$`.
 */
function repairForeachLists(root) {
  walkArrays(root, array => {
    for (let i = 0; i < array.length; i++) {
      if (!isMacro(array[i], 'foreach')) continue;
      let j = i + 1;
      while (j < array.length && !isString(array[j], 'in') && !isGroup(array[j]) && !isMacro(array[j], 'foreach')) j++;
      if (!isString(array[j], 'in')) continue;
      j = skipSpace(array, j + 1);
      if (!isGroup(array[j])) continue;
      const list = array[j].content;
      for (let k = 0; k < list.length; k++) {
        const node = list[k];
        if (isGroup(node)) { if (mathOnly(node.content)) node.content = [macro('ensuremath', [{ type: 'argument', openMark: '{', closeMark: '}', content: node.content }])]; continue; }
        if (isMacro(node) && T.MATH_MACROS.has(node.content) && !hasArgs(node) && (k === 0 || isString(list[k - 1]) && /[,/]\s*$/.test(list[k - 1].content) || isSpace(list[k - 1]))) list[k] = macro('ensuremath', [{ type: 'argument', openMark: '{', closeMark: '}', content: [node] }]);
      }
      i = j;
    }
  });
}
function mathOnly(nodes) {
  if (nodes.some(node => node.type === 'inlinemath' || node.type === 'displaymath')) return false;
  return needsMath(nodes.filter(node => !isSpace(node)));
}

/** `remember picture` / `overlay` only make sense inside a larger document. */
function stripOverlayKeys(root) {
  for (const node of root) {
    if (node.type !== 'environment' || node.env !== 'tikzpicture' || !Array.isArray(node.args)) continue;
    for (const argument of node.args) {
      if (argument.openMark !== '[') continue;
      let items;
      try { items = parsePgfkeys(argument.content); } catch { continue; }
      const kept = items.filter(item => !/^(?:remember picture|overlay)$/.test(printRaw(item.itemParts?.[0] ?? []).trim()));
      if (kept.length === items.length) continue;
      argument.content = joinKeyItems(kept.map(item => keyItemNodes(item.itemParts ?? [])));
    }
  }
}

/** `\num{3,5}` → `3{,}5`, `\num{1e3}` → `1\times 10^{3}` inside siunitx-style numbers. */
function formatNumbers(root) {
  walkArrays(root, array => {
    for (const node of array) {
      if (!isMacro(node) || !/^(?:SI|num|qty)$/.test(node.content) || !hasArgs(node)) continue;
      const argument = node.args.find(candidate => candidate.openMark === '{');
      if (!argument) continue;
      const content = argument.content;
      for (let i = 1; i < content.length - 1; i++) {
        if (isString(content[i], ',') && isString(content[i - 1]) && /\d$/.test(content[i - 1].content) && isString(content[i + 1]) && /^\d/.test(content[i + 1].content)) content[i] = { type: 'group', content: [str(',')] };
      }
      for (const token of content) if (isString(token)) token.content = token.content.replace(/^(\d+(?:[.,]\d+)?)[eE](-?\d+)$/, '$1\\times 10^{$2}');
    }
  });
}

// ------------------------------------------------------------ main entry

/**
 * Normalize any TikZ-ish input into one standalone LaTeX document.
 * @returns {{ source: string, unavailable: string[], notes: string[] }}
 */
export function prepareTikzDocument(code) {
  const cleaned = cleanInput(code);
  if (!cleaned) throw new TikzSourceError('TikZ source is empty.');
  const state = {
    packages: new Map(), libraries: new Set(DEFAULT_LIBRARIES), pgfplotsLibraries: new Set(), gdLibraries: new Set(),
    unavailable: new Set(), droppedLibraries: new Set(), shims: new Set(), statements: [], compat: false,
  };

  // 1. Structure: preamble statements and the body.
  const excluded = definedMacroNames(cleaned);
  const { preamble, body } = structure(cleaned, excluded);
  if (!printRaw(body).trim()) throw new TikzSourceError('No picture found: add a \\begin{tikzpicture}…\\end{tikzpicture} block.');
  for (const statement of preamble) absorbStatement(state, statement);

  // 2. Reuse the parsed AST: wrapping paths does not require reparsing LaTeX.
  const statementsRoot = parseLatex(state.statements.join('\n'), excluded).content;
  const unicode = [];
  const unicodeSeen = new Set();
  const colorsDefined = new Set();
  const colorsSeen = new Set();
  for (const root of [body, statementsRoot]) {
    rewriteHexColors(root);
    replaceUnavailableMacros(root, state);
    processKeyLists(root, {});
  }
  stripOverlayKeys(body);
  protectAndDelimiter(body);
  repairForeachLists(body);
  replaceTypos(body);
  repairNodeTexts(body);
  // siunitx parses quantities itself; preserve its input grammar.
  unicodeSupport(body, unicodeSeen, unicode);
  unicodeSupport(statementsRoot, unicodeSeen, unicode);
  tightScripts(body);
  tightScripts(statementsRoot);
  const bodyOut = printRaw(body).trim();
  const statementsOut = printRaw(statementsRoot).trim();
  const everything = `${statementsOut}\n${bodyOut}`;
  const colors = [...colorSupport(statementsRoot, statementsOut, colorsDefined, colorsSeen), ...colorSupport(body, bodyOut, colorsDefined, colorsSeen)];

  // 3. Usage-driven packages, libraries and shims.
  for (const [pattern, name] of T.AUTO_PACKAGES) if (pattern.test(everything)) addPackage(state, name, []);
  for (const [pattern, name] of T.AUTO_LIBRARIES) if (pattern.test(everything)) addLibrary(state, name);
  if (state.libraries.has('graphdrawing')) for (const [pattern, name] of T.AUTO_GD_LIBRARIES) if (pattern.test(everything)) state.gdLibraries.add(name);
  if (state.packages.has('pgfplots')) for (const [pattern, name] of T.AUTO_PGFPLOTS_LIBRARIES) if (pattern.test(everything)) state.pgfplotsLibraries.add(name);
  if (/\\(?:SI|si|num|qty|unit|ang|SIrange|qtyrange|numrange|SIlist|qtylist|numlist)\b/.test(everything)) addPackage(state, 'siunitx', []);
  if (/\\(?:dv|pdv|vb|va|vu|abs|norm|grad|curl|laplacian|order|eval|expval|ket|bra|braket|comm|dd)\b/.test(everything)) addPackage(state, 'physics', []);
  if (/\\up(?:alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega)\b/i.test(everything)) state.shims.add('upgreek');
  if (/\\(?:text|math)(?:alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega)\b/.test(everything)) state.shims.add('textgreek');
  const declarations = unicode.join('\n');
  const amsmath = T.NEEDS_AMSMATH.test(everything) || /\\tfrac/.test(declarations) || state.shims.size > 0;
  const amssymb = T.NEEDS_AMSSYMB.test(`${everything}\n${declarations}`);

  // 4. Assemble. Latin Modern in T1 always: OT1 Computer Modern sends `\$`,
  // `\textdegree` and friends to the TS1 companion font, which has no Type 1
  // outlines in the bundle (dvisvgm: "no font file for tcrm1000").
  const lines = ['\\documentclass[border=6pt,varwidth]{standalone}', '\\usepackage{tikz}', '\\usepackage[T1]{fontenc}', '\\usepackage{lmodern}'];
  if (amsmath || amssymb) lines.push(`\\usepackage{${[amsmath && 'amsmath', amssymb && 'amssymb'].filter(Boolean).join(',')}}`);
  for (const [name, options] of state.packages) lines.push(options.length ? `\\usepackage[${options.join(',')}]{${name}}` : `\\usepackage{${name}}`);
  lines.push(`\\usetikzlibrary{${[...state.libraries].join(',')}}`);
  if (state.pgfplotsLibraries.size) lines.push(`\\usepgfplotslibrary{${[...state.pgfplotsLibraries].join(',')}}`);
  if (state.gdLibraries.size) lines.push(`\\usegdlibrary{${[...state.gdLibraries].join(',')}}`);
  if (state.packages.has('pgfplots') && !state.compat) lines.push('\\pgfplotsset{compat=1.18}');
  lines.push(...unicode, ...colors, T.COMPAT_SHIM);
  if (state.shims.has('siunitx')) lines.push(T.siunitxShim());
  if (state.shims.has('physics')) lines.push(T.PHYSICS_SHIM);
  if (state.shims.has('upgreek')) lines.push(...T.GREEK_NAMES.map(name => `\\providecommand{\\up${name}}{\\ensuremath{\\${name}}}`));
  if (state.shims.has('textgreek')) lines.push(...T.GREEK_NAMES.map(name => `\\providecommand{\\text${name}}{\\ensuremath{\\${name}}}`));
  if (statementsOut) lines.push(statementsOut);
  lines.push('\\begin{document}', bodyOut, '\\end{document}');
  const notes = [];
  if (state.unavailable.size) notes.push(`Packages not available in this renderer were dropped: ${[...state.unavailable].join(', ')}.`);
  if (state.droppedLibraries.size) notes.push(`Unknown TikZ libraries were dropped: ${[...state.droppedLibraries].join(', ')}.`);
  return { source: lines.join('\n'), unavailable: [...state.unavailable], notes };
}

/** Record one preamble statement: packages, libraries, declarations to keep. */
function absorbStatement(state, nodes) {
  const first = nodes.find(node => !isSpace(node));
  if (!isMacro(first)) return;
  const name = first.content;
  const mandatory = first.args?.filter(argument => argument.openMark === '{') ?? [];
  const optional = first.args?.find(argument => argument.openMark === '[');
  const options = optional ? splitList(printRaw(optional.content)) : [];
  const lastGroup = nodes.filter(isGroup).at(-1);
  const list = index => splitList(mandatory.length > index ? printRaw(mandatory[index].content) : groupText(lastGroup));
  switch (name) {
    case 'usepackage':
    case 'RequirePackage':
      for (const pkg of list(mandatory.length - 1)) addPackage(state, pkg, options);
      return;
    case 'usetikzlibrary':
    case 'usepgflibrary':
      for (const library of list(0)) addLibrary(state, library);
      return;
    case 'usepgfplotslibrary':
      addPackage(state, 'pgfplots', []);
      for (const library of list(0)) { if (BUNDLED_PGFPLOTS_LIBRARIES.has(library)) state.pgfplotsLibraries.add(library); else state.droppedLibraries.add(`pgfplots/${library}`); }
      return;
    case 'usegdlibrary':
      addLibrary(state, 'graphdrawing');
      for (const library of list(0)) state.gdLibraries.add(library);
      return;
    case 'PassOptionsToPackage':
      if (mandatory.length === 2 && printRaw(mandatory[1].content).trim() === 'xcolor') addPackage(state, 'xcolor', splitList(printRaw(mandatory[0].content)));
      return;
    case 'pgfplotsset':
      addPackage(state, 'pgfplots', []);
      if (/compat\s*=/.test(printRaw(nodes))) state.compat = true;
      break;
    default:
      break;
  }
  if (T.DROP_PREAMBLE.has(name) || T.HOISTED_COMMANDS.has(name)) return;
  state.statements.push(printRaw(nodes));
}

function addLibrary(state, name) {
  if (name === 'external') return;
  if (BUNDLED_TIKZ_LIBRARIES.has(name)) state.libraries.add(name);
  else state.droppedLibraries.add(name);
}

function addPackage(state, name, options) {
  name = name.trim();
  if (!name) return;
  if (name === 'xcolor' || name === 'color') {
    const current = state.packages.get('xcolor') ?? [];
    state.packages.set('xcolor', [...new Set([...current, ...options.filter(option => option === 'dvipsnames')])]);
    return;
  }
  if (name === 'tkz-euklide') name = 'tkz-euclide';
  if (name === 'mathrsfs') { state.packages.set('eucal', ['mathscr']); return; }
  if (name === 'eucal') { state.packages.set('eucal', options.length ? options : ['mathscr']); return; }
  if (name === 'hyperref') { addPackage(state, 'url', []); return; }
  if (name === 'circuitikz') { if (!state.packages.has(name)) state.packages.set(name, options.filter(option => option !== 'siunitx')); return; }
  if (name === 'pgfplots') { if (!state.packages.has(name)) state.packages.set(name, options); return; }
  if (T.SHIM_PACKAGES.has(name)) { state.shims.add(name); return; }
  if (T.DROP_PACKAGES.has(name)) return;
  if (BUNDLED_PACKAGES.has(name)) { if (!state.packages.has(name)) state.packages.set(name, options); return; }
  state.unavailable.add(name);
}

/** Everything the TeX engine receives, as a string (see prepareTikzDocument). */
export function prepareTikzSource(code) {
  return prepareTikzDocument(code).source;
}

/** Backwards-compatible alias. */
export const wrapStandalone = prepareTikzSource;

/** Test hook: the font-colour and key-list rewrite applied to a fragment. */
export function hoistFontColors(fragment) {
  const root = parseLatex(fragment).content;
  processKeyLists(root, {});
  tightScripts(root);
  return printRaw(root);
}

/** Test hook: node-text repairs applied to a fragment. */
export function repairNodeText(fragment) {
  const root = parseLatex(fragment).content;
  repairTextNodes(root, {});
  tightScripts(root);
  return printRaw(root);
}

// --------------------------------------------------------- failure report

const UNDEFINED_HINTS = [
  [/^\\tkz/, 'check the tkz-euclide command name and arguments'],
  [/^\\(?:fa[A-Z]|faicon)/, 'fontawesome icons are not available'],
  [/^\\(?:tcb|begin\{tcolorbox)/, 'tcolorbox is not available'],
  [/^\\insert(?:frame|total)/, 'beamer commands do not work outside beamer'],
  [/^\\(?:addplot|axis|pgfplots)/, 'load pgfplots with \\usepackage{pgfplots}'],
  [/^\\(?:tdplot)/, 'load tikz-3dplot with \\usepackage{tikz-3dplot}'],
  [/^\\(?:chemfig|schemestart|lewis)/, 'load chemfig with \\usepackage{chemfig}'],
  [/^\\(?:Tree|forest)/, 'check the tikz-qtree/forest command name and arguments'],
  [/^\\(?:smartdiagram)/, 'check the smartdiagram command name and arguments'],
  [/^\\(?:pie)\b/, 'check the pgf-pie command name and arguments'],
  [/^\\(?:ce)\b/, 'check mhchem chemical formula syntax'],
  [/^\\(?:SI|si|num|qty)\b/, 'check siunitx quantity syntax'],
  [/^\\(?:text|math)(?:bb|cal|frak|scr|rm|bf|it)/, 'the command needs math mode'],
];

function describeUndefined(name, unavailable) {
  for (const [pattern, hint] of UNDEFINED_HINTS) if (pattern.test(name)) return `Undefined command ${name}: ${hint}`;
  if (unavailable.length) return `Undefined command ${name} (packages not available here: ${unavailable.join(', ')})`;
  return `Undefined command ${name}`;
}

/**
 * One short, actionable line for a failed compilation.
 * @param {{ diagnostics?: any[], pages?: string[], texLog?: string, log?: string }} result
 */
export function describeTikzFailure(result, { unavailable = [] } = {}) {
  const diagnostics = (result?.diagnostics ?? []).filter(item => item && item.severity === 'error');
  const pages = result?.pages?.length ?? 0;
  const log = String(result?.texLog ?? result?.log ?? '');
  const messages = [];
  const push = text => { if (text && !messages.includes(text)) messages.push(text); };

  // TeX log: "! message" followed (eventually) by "l.<n> <context>".
  const lines = log.split('\n');
  const seenNames = new Set();
  for (let i = 0; i < lines.length && messages.length < 4; i++) {
    const line = lines[i];
    if (!line.startsWith('! ')) continue;
    const message = line.slice(2).trim();
    let context = '';
    for (let j = i + 1; j < Math.min(lines.length, i + 12); j++) {
      const at = /^l\.(\d+) (.*)$/.exec(lines[j]);
      if (at) { context = at[2]; break; }
    }
    const near = context ? ` near "${context.replace(/^\.\.\./, '').trim().slice(-70)}"` : '';
    if (/^Undefined control sequence/.test(message)) {
      const name = /(\\[A-Za-z@]+)\s*$/.exec(context)?.[1] ?? '';
      if (name && seenNames.has(name)) continue;
      if (name) seenNames.add(name);
      push(describeUndefined(name || '(unknown)', unavailable) + (name ? '' : near));
    } else if (/File `(.+?)' not found/.test(message)) {
      const file = /File `(.+?)' not found/.exec(message)[1];
      push(/\.(?:sty|cls)$/.test(file) ? `Package ${file.replace(/\.(?:sty|cls)$/, '')} is not available in this renderer` : `External file ${file} is not available (no files can be read)`);
    } else if (/Environment (\S+) undefined/.test(message)) {
      const env = /Environment (\S+) undefined/.exec(message)[1];
      const hint = /axis|plot/.test(env) ? ' (load pgfplots)' : /tikzcd/.test(env) ? ' (load tikz-cd)' : /circuitikz/.test(env) ? ' (load circuitikz)' : '';
      push(`Environment ${env} is undefined${hint}`);
    } else if (/I do not know the key '([^']+)'/.test(message)) {
      const key = /I do not know the key '([^']+)'/.exec(message)[1].replace(/^\/tikz\//, '');
      push(/^[A-Za-z][A-Za-z0-9]*(?:![\w!]*)?$/.test(key) ? `Unknown key '${key}': if it is a colour, define it with \\definecolor` : `Unknown TikZ key '${key}'${near}`);
    } else if (/Undefined color `([^']+)'/.test(message)) {
      push(`Undefined colour '${/Undefined color `([^']+)'/.exec(message)[1]}': define it with \\definecolor or use a standard name`);
    } else if (/Missing \$ inserted|Display math should end|Bad math environment/.test(message)) {
      push(`Math syntax (_ ^ \\frac …) used outside $…$${near}`);
    } else if (/Missing \} inserted|Extra \}|Missing \\endgroup|Runaway argument|Paragraph ended before|Missing \{ inserted|File ended while scanning/.test(message)) {
      push(`Unbalanced braces or an unterminated argument${near}`);
    } else if (/Giving up on this path/.test(message)) {
      push(`A path is missing its closing semicolon${near}`);
    } else if (/Unicode character (.+?) \(U\+([0-9A-F]+)\)/.test(message)) {
      const [, char, code] = /Unicode character (.+?) \(U\+([0-9A-F]+)\)/.exec(message);
      push(`Character ${char} (U+${code}) has no glyph here; use the TeX command instead`);
    } else if (/I did not find the tikz library '([^']+)'/.test(message)) {
      push(`TikZ library '${/I did not find the tikz library '([^']+)'/.exec(message)[1]}' is not available`);
    } else if (/Can be used only in preamble/.test(message)) {
      push(`A preamble command appears in the body${near}`);
    } else if (/Emergency stop|==> Fatal error|Interruption|cannot \\read|Output written/.test(message)) {
      continue;
    } else {
      push(`${message.replace(/^(?:LaTeX|Package \w+) Error: /, '').replace(/\.$/, '')}${near}`);
    }
  }
  if (!messages.length) {
    for (const item of diagnostics) {
      const text = String(item.message ?? '').trim();
      if (!text || /Emergency stop|Fatal error/.test(text)) continue;
      if (/missing closing tag/.test(text)) push('SVG conversion failed: a colour or font switch was left open inside the picture');
      else if (item.source === 'host' || item.source === 'dvisvgm') push(`SVG conversion failed: ${text.replace(/\.$/, '')}`);
      else push(text.replace(/^(?:LaTeX|Package \w+) Error: /, '').replace(/\.$/, ''));
      if (messages.length >= 3) break;
    }
  }
  if (!messages.length) {
    if (pages === 0) push('The document produced no page: is there a picture inside it?');
    else if (pages > 1) push(`The document produced ${pages} pages; keep one picture`);
    else push('TeX reported an error');
  }
  return `TikZ error: ${messages.slice(0, 3).join('; ')}.`;
}
