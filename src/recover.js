// Conservative repairs of generated TikZ syntax, using the LaTeX lexer before
// argument attachment. Never invent coordinates, lengths, or missing geometry.
import { parseMinimal } from '@unified-latex/unified-latex-util-parse';
import { printRaw } from '@unified-latex/unified-latex-util-print-raw';
import { parsePgfkeys } from '@unified-latex/unified-latex-util-pgfkeys';

const string = content => ({ type: 'string', content });
const group = content => ({ type: 'group', content });
const is = (node, text) => node?.type === 'string' && node.content === text;
const space = node => node?.type === 'whitespace' || node?.type === 'parbreak';
const skip = (nodes, i) => { while (space(nodes[i])) i++; return i; };
function walk(nodes, visit) {
  visit(nodes);
  for (const node of nodes) if (Array.isArray(node.content)) walk(node.content, visit);
}
function closeAt(nodes, start, open, close) {
  let depth = 0;
  for (let i = start; i < nodes.length; i++) {
    if (is(nodes[i], open)) depth++;
    else if (is(nodes[i], close) && --depth === 0) return i;
  }
  return -1;
}

const DEFINITIONS = new Set(['def', 'gdef', 'edef', 'xdef', 'let', 'newcommand', 'renewcommand', 'providecommand', 'pgfmathsetmacro', 'pgfmathtruncatemacro', 'pgfmathsetlengthmacro']);
function extendedIdentifiers(root, source) {
  const bindings = new Map();
  const names = new Set();
  walk(root, nodes => { for (const node of nodes) if (node.type === 'macro') names.add(node.content); });
  walk(root, nodes => {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].type !== 'macro' || !DEFINITIONS.has(nodes[i].content)) continue;
      const at = skip(nodes, i + 1);
      const target = nodes[at]?.type === 'group' ? nodes[at].content : nodes.slice(at, at + 3);
      const [macro, tail, end] = target;
      if (macro?.type !== 'macro' || tail?.type !== 'string' || !/^(?:_[A-Za-z0-9_]+|[0-9][A-Za-z0-9_]*)$/.test(tail.content)) continue;
      if (end && end.type !== 'group' && !(nodes[i].content === 'let' && end.type === 'macro')) continue; // keep real delimited/parameter macros
      if (macro.position?.end.offset !== tail.position?.start.offset) continue;
      const key = macro.content + tail.content;
      if (bindings.has(key)) continue;
      let name = 'tikzRecoveredVariable';
      let n = bindings.size;
      do { name += String.fromCharCode(65 + n % 26); n = Math.floor(n / 26); } while (n);
      while (names.has(name)) name += 'X';
      names.add(name);
      bindings.set(key, { base: macro.content, suffix: tail.content, name });
    }
  });
  if (!bindings.size) return;
  walk(root, nodes => {
    for (let i = 0; i + 1 < nodes.length; i++) {
      const node = nodes[i];
      if (node.type !== 'macro') continue;
      for (const binding of bindings.values()) {
        const offset = node.position?.end.offset;
        if (node.content !== binding.base || !source.startsWith(binding.suffix, offset)) continue;
        const end = offset + binding.suffix.length;
        if (/[A-Za-z0-9_]/.test(source[end] ?? '')) continue;
        let j = i + 1;
        while (j < nodes.length && nodes[j].position?.end.offset <= end) j++;
        if (nodes[j - 1]?.position?.end.offset !== end) continue;
        node.content = binding.name; nodes.splice(i + 1, j - i - 1);
        break;
      }
    }
  });
}

// >=Latex[length=3mm,width=2mm] needs braces around the complete arrow value;
// TeX's optional argument scanner otherwise stops at the inner closing bracket.
function nestedOptions(nodes) {
  for (let i = 0; i < nodes.length; i++) {
    if (!is(nodes[i], '[')) continue;
    let close = closeAt(nodes, i, '[', ']');
    if (close < 0) continue;
    for (let j = i + 1; j < close; j++) {
      if (!is(nodes[j], '[')) continue;
      const end = closeAt(nodes, j, '[', ']');
      let start = j - 1;
      while (start > i && !is(nodes[start], '=') && !is(nodes[start], ',')) start--;
      if (end < 0 || !is(nodes[start], '=')) continue;
      const value = nodes.slice(start + 1, end + 1);
      nodes.splice(start + 1, end - start, group(value));
      close -= end - start - 1;
      j = start + 1;
    }
    i = close;
  }
}

function coordinateComponent(nodes, alreadyGrouped = false) {
  const significant = nodes.filter(node => !space(node));
  if (significant.length === 1 && significant[0].type === 'group') {
    significant[0].content = coordinateComponent(significant[0].content, true);
    return nodes;
  }
  let unitStart = significant.length - 1;
  let unit = significant[unitStart]?.type === 'string' ? significant[unitStart].content : '';
  if (unit.length === 1 && significant[unitStart - 1]?.type === 'string') { unitStart--; unit = significant[unitStart].content + unit; }
  if (!/^(?:cm|mm|pt|bp|in|em|ex)$/.test(unit)) unit = null;
  if (unit && significant.length > 1 && (significant[0].type === 'group' || significant.some(node => is(node, '(')))) {
    const expr = significant.slice(0, unitStart).flatMap(node => node.type === 'group' ? [string('('), ...node.content, string(')')] : [node]);
    const repaired = [string('('), ...expr, string(')*1' + unit)];
    return alreadyGrouped ? repaired : [group(repaired)];
  }
  if (!alreadyGrouped && nodes.some(node => is(node, '('))) return [group(nodes)];
  return nodes;
}

function coordinates(nodes) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].type === 'inlinemath') { coordinates(nodes[i].content); continue; }
    if (!is(nodes[i], '(')) continue;
    const end = closeAt(nodes, i, '(', ')');
    if (end < 0) continue;
    const inside = nodes.slice(i + 1, end);
    // Calc expressions have their own coordinate parentheses inside $...$.
    if (inside.some(node => node.type === 'inlinemath')) { for (const node of inside) if (node.type === 'inlinemath') coordinates(node.content); i = end; continue; }
    let depth = 0, start = 0;
    const segments = [], delimiters = [];
    for (let j = 0; j < inside.length; j++) {
      if (is(inside[j], '(')) depth++;
      else if (is(inside[j], ')')) depth--;
      else if (!depth && (is(inside[j], ',') || is(inside[j], ':') || is(inside[j], 'and'))) {
        segments.push(inside.slice(start, j)); delimiters.push(is(inside[j], 'and') ? string(' and ') : inside[j]); start = j + 1;
      }
    }
    segments.push(inside.slice(start));
    // Do not reinterpret named nodes, explicit coordinate systems or projections.
    if (inside.some(node => is(node, '=') || is(node, '|') || is(node, 'cs'))) { i = end; continue; }
    const rebuilt = segments.flatMap((part, j) => [...coordinateComponent(part), ...(delimiters[j] ? [delimiters[j]] : [])]);
    nodes.splice(i + 1, end - i - 1, ...rebuilt);
    i += rebuilt.length + 1;
  }
}

const PATHS = new Set(['draw', 'fill', 'filldraw', 'shade', 'shadedraw', 'path', 'coordinate', 'node', 'clip', 'pic']);

function delimited(nodes, at, open, close) {
  at = skip(nodes, at);
  if (!is(nodes[at], open)) return null;
  const end = closeAt(nodes, at, open, close);
  return end < 0 ? null : { start: at, end: end + 1, content: nodes.slice(at + 1, end) };
}

/** Adapt old/shorthand tkz calls to the bundled package's explicit results. */
function tkzCommands(nodes) {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type !== 'macro' || !node.content.startsWith('tkz')) continue;
    const options = delimited(nodes, i + 1, '[', ']');
    const point = delimited(nodes, options?.end ?? i + 1, '(', ')');
    if (!point) continue;
    if (node.content === 'tkzDefLine' && options) {
      const first = skip(options.content, 0);
      const through = skip(options.content, first + 1);
      if (['orthogonal', 'perpendicular', 'parallel'].some(key => is(options.content[first], key)) && is(options.content[through], 'through')) {
        nodes.splice(options.start + 1 + first + 1, 0, string('='));
      }
    }
    if (node.content === 'tkzMidPoint') node.content = 'tkzDefMidPoint';
    if (['tkzDefMidPoint', 'tkzDefPointBy', 'tkzDefPointWith'].includes(node.content)) {
      const out = skip(nodes, point.end);
      if (nodes[out]?.type === 'group') nodes.splice(out, 0, { type: 'macro', content: 'tkzGetPoint' });
      if (node.content === 'tkzDefPointBy' && options) {
        const onto = options.content.findIndex(token => is(token, 'onto'));
        const line = skip(options.content, onto + 1);
        if (onto >= 0 && is(options.content[line], 'line')) {
          options.content.splice(line, 1);
          nodes.splice(options.start + 1, options.end - options.start - 2, ...options.content);
        }
      }
    }
    if (node.content === 'tkzInter' && options && printRaw(options.content).trim() === 'R' && delimited(nodes, point.end, '(', ')')) node.content = 'tkzInterCC';
    if (node.content === 'tkzDrawCircle' && options) {
      const keys = parsePgfkeys(options.content).map(item => (item.itemParts ?? []).map(part => printRaw(part).trim()).join('='));
      const mode = keys.find(key => ['circum', 'in', 'diameter', 'R'].includes(key));
      const count = point.content.filter(token => is(token, ',')).length + 1;
      if (!mode || count !== (['circum', 'in'].includes(mode) ? 3 : 2)) continue;
      const rest = keys.filter(key => key !== mode).join(',');
      if (mode === 'R') {
        const comma = point.content.findIndex(token => is(token, ','));
        nodes.splice(i, point.end - i, string(String.raw`\draw[circle style,${rest}] (${printRaw(point.content.slice(0, comma))}) circle (${printRaw(point.content.slice(comma + 1))});`));
        continue;
      }
      // tkzDefCircle supplies both center and a point on the circle. Drawing
      // from those results preserves the construction rather than guessing a radius.
      const replacement = String.raw`{\tkzDefCircle[${mode}](${printRaw(point.content)})\tkzGetPoints{tikzRecoveredCircleCenter}{tikzRecoveredCirclePoint}\tkzDrawCircle[${rest}](tikzRecoveredCircleCenter,tikzRecoveredCirclePoint)}`;
      nodes.splice(i, point.end - i, string(replacement));
    }
  }
}

/** PGF prints numbers, not expressions; evaluate explicit arithmetic first. */
function numberExpressions(nodes) {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type !== 'macro') continue;
    if (['pgfmathparse', 'pgfmathsetmacro', 'pgfmathtruncatemacro'].includes(node.content)) {
      let at = skip(nodes, i + 1);
      if (node.content !== 'pgfmathparse') at = skip(nodes, at + 1);
      const expr = nodes[at];
      if (expr?.type !== 'group') continue;
      const mod = expr.content.findIndex(token => is(token, 'mod'));
      const atom = tokens => { const value = tokens.filter(token => !space(token)); return value.length === 1 && (value[0].type === 'macro' || value[0].type === 'group' || (value[0].type === 'string' && /^-?\d+(?:\.\d+)?$/.test(value[0].content))); };
      if (mod > 0 && atom(expr.content.slice(0, mod)) && atom(expr.content.slice(mod + 1))) expr.content = [string('mod('), ...expr.content.slice(0, mod), string(','), ...expr.content.slice(mod + 1), string(')')];
    }
    if (node.content !== 'pgfmathprintnumber') continue;
    const options = delimited(nodes, i + 1, '[', ']');
    const at = skip(nodes, options?.end ?? i + 1);
    const expr = nodes[at];
    if (expr?.type !== 'group' || !expr.content.some(token => token.type === 'string' && ['*', '/', '+', '('].includes(token.content))) continue;
    nodes.splice(i, at - i + 1, string(String.raw`{\pgfmathparse{${printRaw(expr.content)}}\pgfmathprintnumber${options ? `[${printRaw(options.content)}]` : ''}{\pgfmathresult}}`));
  }
}

/** A node position is one coordinate, not a path with a trailing ++ step. */
function relativeNodePosition(nodes) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].type !== 'macro' || nodes[i].content !== 'node') continue;
    let at = i + 1;
    while (at < nodes.length && !is(nodes[at], 'at') && !is(nodes[at], ';')) at++;
    if (!is(nodes[at], 'at')) continue;
    const base = delimited(nodes, at + 1, '(', ')');
    if (!base) continue;
    let plus = skip(nodes, base.end);
    if (!is(nodes[plus], '+')) continue;
    plus++;
    if (is(nodes[plus], '+')) plus++;
    const offset = delimited(nodes, plus, '(', ')');
    if (!offset) continue;
    nodes.splice(base.start, offset.end - base.start, string(`($(${printRaw(base.content)})+(${printRaw(offset.content)})$)`));
  }
}

export function recoverGeneratedSyntax(source) {
  const root = parseMinimal(source).content;
  extendedIdentifiers(root, source);
  walk(root, nestedOptions);
  walk(root, tkzCommands);
  walk(root, numberExpressions);
  walk(root, relativeNodePosition);
  walk(root, nodes => {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].type !== 'macro' || !PATHS.has(nodes[i].content)) continue;
      let end = i + 1;
      while (end < nodes.length && !is(nodes[end], ';')) end++;
      const tokens = nodes.slice(i + 1, end);
      coordinates(tokens);
      nodes.splice(i + 1, end - i - 1, ...tokens);
      i += tokens.length;
    }
  });
  return printRaw(root);
}
