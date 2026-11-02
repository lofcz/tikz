// Source normalization shared by the Node worker and the browser worker.
//
// A bare picture is wrapped in a standalone document with the common
// libraries. `\color{…}` inside a `font=` key is rewritten into the node's
// `text=` key: in this DVI→SVG pipeline the colour special opened by a font
// switch is never popped inside the picture, and dvisvgm then rejects the page
// ("missing closing tag(s): </g>"). `text=` paints the same colour the TikZ way.

const PREAMBLE = String.raw`\documentclass[tikz,border=6pt]{standalone}
\usetikzlibrary{calc,intersections,angles,quotes,arrows.meta,positioning}
\begin{document}
`;

/** Wrap a bare picture into a complete standalone document. */
export function wrapStandalone(code) {
  return /^\s*\\documentclass\b/m.test(code) ? code : `${PREAMBLE}${code}\n\\end{document}`;
}

/** Index just past the balanced group that opens at `start` (`{`/`[`), or -1. */
function groupEnd(text, start) {
  const open = text[start], close = open === '{' ? '}' : ']';
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (char === '\\') { i++; continue; }
    if (char === open) depth++;
    else if (char === close && --depth === 0) return i + 1;
  }
  return -1;
}

/** End of a pgfkeys value starting at `start`: the next top-level `,`, `]` or `}`. */
function valueEnd(text, start) {
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (char === '\\') { i++; continue; }
    if (char === '{' || char === '[') { const end = groupEnd(text, i); if (end < 0) return -1; i = end - 1; continue; }
    if (char === ',' || char === ']' || char === '}') return i;
  }
  return text.length;
}

/** Position of the `]`/`}` that closes the option list containing `from`, or -1. */
function listEnd(text, from) {
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    const char = text[i];
    if (char === '\\') { i++; continue; }
    if (char === '{' || char === '[') depth++;
    else if (char === '}' || char === ']') { if (depth === 0) return i; depth--; }
  }
  return -1;
}

const COLOR = /\\color\s*\{([^{}]*)\}/g;

/** Move every `\color{name}` out of `font=` values into a trailing `text=name` key. */
export function hoistFontColors(source) {
  let text = source;
  const keyPattern = /(^|[\[{,])(\s*font\s*=\s*)/g;
  for (let match = keyPattern.exec(text); match; match = keyPattern.exec(text)) {
    const keyStart = match.index + match[1].length;
    const valueStart = match.index + match[0].length;
    const end = valueEnd(text, valueStart);
    if (end < 0) break;
    const value = text.slice(valueStart, end);
    const colors = [...value.matchAll(COLOR)].map(m => m[1].trim()).filter(Boolean);
    if (colors.length === 0) continue;
    const braced = /^\{[\s\S]*\}$/.test(value.trim());
    let cleaned = value.replace(COLOR, '').replace(/[ \t]+$/, '');
    if (braced && !cleaned.replace(/^\{|\}$/g, '').trim()) cleaned = '';
    else if (!braced && !cleaned.trim()) cleaned = '';
    const close = listEnd(text, end);
    if (close < 0) break;
    const closer = text.slice(close);
    let replaced;
    if (cleaned) {
      replaced = text.slice(0, valueStart) + cleaned + text.slice(end, close);
    } else {
      // Drop the whole `font=` key with the comma that separated it.
      let keyRemoveStart = keyStart, keyRemoveEnd = end;
      if (text[end] === ',') keyRemoveEnd = end + 1;
      else if (match[1] === ',') keyRemoveStart = match.index;
      replaced = text.slice(0, keyRemoveStart) + text.slice(keyRemoveEnd, close);
    }
    const replacedHead = replaced.replace(/[\s,]+$/, '');
    const separator = /[[{]$/.test(replacedHead) ? '' : ', ';
    text = `${replacedHead}${separator}text=${colors[colors.length - 1]}${closer}`;
    keyPattern.lastIndex = Math.max(0, replacedHead.length - value.length);
  }
  return text;
}

/** Everything the TeX engine receives: colour-safe keys inside a complete document. */
export function prepareTikzSource(code) {
  return wrapStandalone(hoistFontColors(code));
}
