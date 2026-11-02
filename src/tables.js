// Lookup tables for source normalization: parser signatures, package policy,
// usage-driven libraries, Unicode fallbacks, colour names and TeX shims.

// ------------------------------------------------------------- parser setup

// Argument signatures (xparse syntax) for macros unified-latex does not know
// out of the box, so their arguments travel with them when statements move.
export const MACRO_SIGNATURES = {
  tikzset: { signature: 'm' }, ctikzset: { signature: 'm' }, setchemfig: { signature: 'm' }, pgfkeysdef: { signature: 'm m' },
  pgfmathsetmacro: { signature: 'm m' }, pgfmathsetlengthmacro: { signature: 'm m' }, pgfmathdeclarefunction: { signature: 'm m m' },
  pgfmathsetseed: { signature: 'm' }, pgfdeclarelayer: { signature: 'm' }, pgfsetlayers: { signature: 'm' },
  tdplotsetmaincoords: { signature: 'm m' }, tdplotsetrotatedcoords: { signature: 'm m m' },
  providecolor: { signature: 'm m m' }, definecolorset: { signature: 'm m m m' }, DeclareMathOperator: { signature: 's m m' },
  pgfplotstableread: { signature: 'o m m' }, pgfplotstableset: { signature: 'm' }, usepgfplotslibrary: { signature: 'm' }, usegdlibrary: { signature: 'm' },
  tikzexternalize: { signature: 'o' }, tikzsetexternalprefix: { signature: 'm' }, DeclareUnicodeCharacter: { signature: 'm m' },
  PassOptionsToPackage: { signature: 'm m' }, RequirePackage: { signature: 'o m' },
  usetheme: { signature: 'o m' }, usecolortheme: { signature: 'o m' }, usefonttheme: { signature: 'o m' }, useinnertheme: { signature: 'o m' }, useoutertheme: { signature: 'o m' },
  setbeamertemplate: { signature: 'm o m' }, setbeamercolor: { signature: 'm m' }, setbeamerfont: { signature: 'm m' }, setbeamersize: { signature: 'm' }, setbeamercovered: { signature: 'm' },
  frametitle: { signature: 'o m' }, framesubtitle: { signature: 'm' }, institute: { signature: 'o m' }, subtitle: { signature: 'o m' }, titlegraphic: { signature: 'm' }, logo: { signature: 'm' },
  hypersetup: { signature: 'm' }, geometry: { signature: 'm' }, sisetup: { signature: 'm' }, DeclareSIUnit: { signature: 'm m' }, captionsetup: { signature: 'o m' },
  tcbset: { signature: 'm' }, tcbuselibrary: { signature: 'm' }, lstset: { signature: 'm' }, graphicspath: { signature: 'm' }, pagestyle: { signature: 'm' }, thispagestyle: { signature: 'm' },
  selectlanguage: { signature: 'm' }, setmainfont: { signature: 'o m' }, setsansfont: { signature: 'o m' }, setmonofont: { signature: 'o m' }, setmathfont: { signature: 'o m' }, newfontfamily: { signature: 'm o m' },
  SI: { signature: 'o m m' }, si: { signature: 'o m' }, num: { signature: 'o m' }, qty: { signature: 'o m m' }, unit: { signature: 'o m' }, ang: { signature: 'o m' },
  SIrange: { signature: 'o m m m' }, qtyrange: { signature: 'o m m m' }, numrange: { signature: 'o m m' },
  ce: { signature: 'm' }, chemfig: { signature: 'o m' }, chemname: { signature: 'o m m' }, lewis: { signature: 'o m' }, uv: { signature: 'm' }, faicon: { signature: 'm' },
  smartdiagram: { signature: 'o m m' }, pie: { signature: 'o m' }, Tree: { signature: '' },
  tkzDefPoint: { signature: 'o d()' }, tkzDefPoints: { signature: 'o' }, tkzDrawSegment: { signature: 'o d()' }, tkzDrawSegments: { signature: 'o d()' },
  tkzDrawPolygon: { signature: 'o d()' }, tkzDrawPoints: { signature: 'o d()' }, tkzDrawPoint: { signature: 'o d()' }, tkzLabelPoints: { signature: 'o d()' }, tkzLabelPoint: { signature: 'o d()' },
  tkzDrawCircle: { signature: 'o d()' }, tkzDrawCircles: { signature: 'o d()' }, tkzMarkAngle: { signature: 'o d()' }, tkzLabelAngle: { signature: 'o d()' }, tkzMarkRightAngle: { signature: 'o d()' },
  tkzDrawLine: { signature: 'o d()' }, tkzDrawLines: { signature: 'o d()' }, tkzLabelSegment: { signature: 'o d()' }, tkzLabelSegments: { signature: 'o d()' },
  tkzDefMidPoint: { signature: 'd()' }, tkzDefLine: { signature: 'o d()' }, tkzDefCircle: { signature: 'o d()' },
  tkzInterLL: { signature: 'd() d()' }, tkzInterLC: { signature: 'd() d()' }, tkzInterCC: { signature: 'd() d()' }, tkzDefTriangle: { signature: 'o d()' }, tkzDefSquare: { signature: 'd()' },
  tkzDefPointBy: { signature: 'o' }, tkzDefPointWith: { signature: 'o' }, tkzDrawArc: { signature: 'o d() d()' }, tkzFillPolygon: { signature: 'o d()' }, tkzFillAngle: { signature: 'o d()' },
  tkzMarkSegment: { signature: 'o d()' }, tkzMarkSegments: { signature: 'o d()' }, tkzDrawSector: { signature: 'o d() d()' }, tkzInit: { signature: 'o' }, tkzGrid: { signature: 'o' }, tkzAxeXY: { signature: 'o' },
  tkzDefShiftPoint: { signature: 'o d()' }, tkzClipPolygon: { signature: 'd()' }, tkzClipCircle: { signature: 'd()' }, tkzDrawAltitude: { signature: 'o d()' }, tkzDrawMedian: { signature: 'o d()' },
  tkzDefCircumcenter: { signature: 'd()' }, tkzDefCentroid: { signature: 'd()' }, tkzDefIncenter: { signature: 'd()' }, tkzDefOrthocenter: { signature: 'd()' }, tkzDefBarycentricPoint: { signature: 'd()' },
  tkzDrawCircumcircle: { signature: 'o d()' }, tkzDrawIncircle: { signature: 'o d()' }, tkzDefMidArc: { signature: 'd()' }, tkzCompass: { signature: 'o d()' }, tkzShowLine: { signature: 'o d()' }, tkzShowBB: { signature: 'o' },
  tkzDefExtSimilitudeCenter: { signature: 'd()' }, tkzDefIntSimilitudeCenter: { signature: 'd()' }, tkzDefSpcTriangle: { signature: 'o d()' }, tkzDefLineBy: { signature: 'o' }, tkzDrawCoordinates: { signature: 'o' },
};

// Environments beyond unified-latex's defaults, with their option list.
export const ENVIRONMENT_SIGNATURES = {
  circuitikz: { signature: 'o', renderInfo: { pgfkeysArgs: true } }, tikzcd: { signature: 'o', renderInfo: { pgfkeysArgs: true } }, pgfpicture: { signature: '' },
  semilogxaxis: { signature: 'o', renderInfo: { pgfkeysArgs: true } }, semilogyaxis: { signature: 'o', renderInfo: { pgfkeysArgs: true } }, loglogaxis: { signature: 'o', renderInfo: { pgfkeysArgs: true } },
  polaraxis: { signature: 'o', renderInfo: { pgfkeysArgs: true } }, groupplot: { signature: 'o', renderInfo: { pgfkeysArgs: true } }, smithchart: { signature: 'o', renderInfo: { pgfkeysArgs: true } }, ternaryaxis: { signature: 'o', renderInfo: { pgfkeysArgs: true } },
  tikzfadingfrompicture: { signature: 'o' }, frame: { signature: 'd<> o d{} d{}' }, columns: { signature: 'd<> o' }, column: { signature: 'd<> o m' }, block: { signature: 'd<> m' }, alertblock: { signature: 'd<> m' }, exampleblock: { signature: 'd<> m' },
  tcolorbox: { signature: 'o' }, forest: { signature: '' }, scope: { signature: 'o', renderInfo: { pgfkeysArgs: true, tikzEnvironment: true } }, pgfonlayer: { signature: 'm' },
};

// Environments that are pictures in their own right.
export const PICTURE_ENVS = new Set(['tikzpicture', 'pgfpicture', 'circuitikz', 'tikzcd', 'tikzfadingfrompicture', 'forest']);
// Environments that only make sense inside a tikzpicture; wrap them when found at the top level.
export const INNER_ENVS = new Set(['axis', 'semilogxaxis', 'semilogyaxis', 'loglogaxis', 'polaraxis', 'smithchart', 'ternaryaxis', 'groupplot', 'scope', 'pgfonlayer']);
// Wrappers that never belong in a standalone picture: keep what is inside.
export const UNWRAP_ALWAYS = new Set(['frame', 'columns', 'column', 'block', 'alertblock', 'exampleblock', 'document', 'tcolorbox', 'mdframed', 'framed', 'shaded', 'adjustbox', 'tcbraster']);
export const UNWRAP_BARE = new Set(['figure', 'figure*', 'table', 'table*', 'center', 'flushleft', 'flushright', 'minipage', 'itemize', 'enumerate', 'description', 'abstract', 'tcolorbox', 'wrapfigure', 'subfigure']);
// Macros that produce a picture by themselves.
export const PICTURE_MACROS = new Set(['tikz', 'chemfig', 'chemname', 'lewis', 'schemestart', 'smartdiagram', 'Tree', 'pie']);
// Path-level commands that need a surrounding tikzpicture (terminated by `;`).
export const PATH_COMMANDS = new Set(['draw', 'fill', 'filldraw', 'path', 'node', 'coordinate', 'clip', 'shade', 'shadedraw', 'foreach', 'pic', 'matrix', 'graph', 'scoped', 'useasboundingbox', 'pattern', 'addplot', 'pgftext']);
// Typesetting commands that are meaningless around a bare picture: drop them with their arguments.
export const DROP_AROUND_PICTURE = new Set(['centering', 'raggedright', 'raggedleft', 'caption', 'captionof', 'label', 'ref', 'eqref', 'cite', 'vspace', 'hspace', 'vfill', 'hfill', 'noindent', 'par', 'newline', 'linebreak', 'pagebreak', 'newpage', 'clearpage', 'smallskip', 'medskip', 'bigskip', 'item', 'maketitle', 'title', 'author', 'date', 'tableofcontents', 'section', 'subsection', 'subsubsection', 'paragraph', 'chapter', 'frametitle', 'framesubtitle', 'pause', 'textbf', 'textit', 'emph', 'underline', 'texttt', 'textsc', 'textsf', 'textrm', 'textnormal', 'small', 'footnotesize', 'scriptsize', 'tiny', 'large', 'Large', 'LARGE', 'huge', 'Huge', 'normalsize', 'includegraphics', 'footnote', 'url', 'href', 'fbox', 'framebox', 'parbox', 'makebox', 'rule', 'hline', 'hrule', 'vrule', 'strut', 'quad', 'qquad', 'indent', 'mbox', 'text', 'textcolor', 'color', 'columnbreak', 'titlepage', '\\', 'end', 'begin', 'hfil', 'vfil', 'bfseries', 'itshape', 'sffamily', 'ttfamily', 'rmfamily', 'mdseries', 'upshape', 'normalfont']);
// Body commands that only exist in slides/articles (full documents).
export const DROP_IN_BODY = new Set(['usetkzobj', 'frametitle', 'framesubtitle', 'pause', 'titlepage', 'maketitle', 'tableofcontents', 'newpage', 'clearpage', 'columnbreak']);
// Preamble commands that must not survive in the body; they are moved up front.
export const HOISTED_COMMANDS = new Set(['usepackage', 'RequirePackage', 'PassOptionsToPackage', 'usetikzlibrary', 'usepgflibrary', 'usepgfplotslibrary', 'usegdlibrary', 'DeclareUnicodeCharacter', 'tikzexternalize', 'tikzsetexternalprefix', 'tikzexternaldisable', 'tikzexternalenable', 'documentclass', 'usetheme', 'usecolortheme', 'usefonttheme', 'useinnertheme', 'useoutertheme']);
// Preamble declarations with no meaning (or no package) in this renderer.
export const DROP_PREAMBLE = new Set(['usetkzobj', 'documentclass', 'geometry', 'pagestyle', 'thispagestyle', 'hypersetup', 'setmainfont', 'setsansfont', 'setmonofont', 'setmathfont', 'newfontfamily', 'babelprovide', 'selectlanguage', 'captionsetup', 'tcbuselibrary', 'tcbset', 'graphicspath', 'usetheme', 'usecolortheme', 'usefonttheme', 'useinnertheme', 'useoutertheme', 'setbeamertemplate', 'setbeamercolor', 'setbeamerfont', 'setbeamersize', 'setbeamercovered', 'beamertemplatenavigationsymbolsempty', 'institute', 'subtitle', 'titlegraphic', 'logo', 'tikzexternalize', 'tikzsetexternalprefix', 'tikzexternaldisable', 'tikzexternalenable', 'title', 'author', 'date', 'linespread', 'setstretch', 'onehalfspacing', 'doublespacing', 'pagenumbering', 'setcounter', 'addtocounter', 'bibliographystyle', 'microtypesetup', 'DeclareGraphicsExtensions', 'listfiles', 'batchmode', 'nonstopmode', 'scrollmode', 'errorstopmode', 'begin', 'end', 'maketitle', 'tableofcontents', 'newgeometry', 'restoregeometry', 'lhead', 'rhead', 'chead', 'lfoot', 'rfoot', 'cfoot', 'fancyhf', 'fancyhead', 'fancyfoot']);

// --------------------------------------------------------- package policy

export const SHIM_PACKAGES = new Set(['gensymb', 'upgreek', 'textgreek', 'eurosym', 'fontawesome', 'fontawesome5', 'bbm', 'dsfont', 'esint', 'wasysym', 'marvosym']);
// Provided by the wrapper, language/layout only, or harmless no-ops here.
export const DROP_PACKAGES = new Set(['tikz', 'pgf', 'amsmath', 'amssymb', 'amsfonts', 'lmodern', 'inputenc', 'fontenc', 'standalone', 'babel', 'polyglossia', 'hyperref', 'geometry', 'microtype', 'fontspec', 'unicode-math', 'enumitem', 'float', 'caption', 'subcaption', 'subfig', 'parskip', 'setspace', 'fancyhdr', 'lastpage', 'titlesec', 'titling', 'multirow', 'colortbl', 'wrapfig', 'pdfpages', 'lipsum', 'blindtext', 'csquotes', 'indentfirst', 'xurl', 'natbib', 'biblatex', 'cite', 'comment', 'soul', 'ulem', 'relsize', 'xstring', 'tikzmark', 'libertine', 'libertinus', 'newtxtext', 'newtxmath', 'tgpagella', 'tgheros', 'tgtermes', 'kpfonts', 'fourier', 'import', 'subfiles', 'docmute', 'pdflscape', 'lscape', 'rotating', 'showframe', 'layout', 'background', 'draftwatermark', 'eso-pic', 'everypage', 'xltxtra', 'xunicode', 'tcolorbox', 'mdframed', 'framed', 'minted', 'algorithm', 'algorithmic', 'algpseudocode', 'makecell', 'adjustbox', 'environ', 'needspace', 'nameref', 'cleveref', 'varioref', 'bookmark', 'datetime', 'datetime2', 'fancyvrb', 'moreverb', 'placeins', 'textpos', 'thmtools', 'nicefrac', 'xfrac', 'units', 'tikzpagenodes', 'tikzscale']);
export const AUTO_PACKAGES = [
  [/\\(?:cancel|bcancel|xcancel|cancelto)\b/, 'cancel'],
  [/\\(?:ce|ch)\b/, 'mhchem'],
  [/\\begin\s*\{(?:axis|semilogxaxis|semilogyaxis|loglogaxis|polaraxis|smithchart|ternaryaxis|groupplot)\}|\\addplot\b|\\pgfplotsset\b|\\pgfplotstable/, 'pgfplots'],
  [/\\pgfplotstableread\b|\\pgfplotstabletypeset\b/, 'pgfplotstable'],
  [/\\begin\s*\{tikzcd\}|\\arrow\s*\[/, 'tikz-cd'],
  [/\\begin\s*\{circuitikz\}|\bto\s*\[\s*(?:R|C|L|V|I|D|Z|battery|battery1|battery2|lamp|short|open|ammeter|voltmeter|ohmmeter|sV|sI|cV|cI|led|switch|cspst|nos|ncs|vsource|isource|generic|Tnpn|Tpnp|npn|pnp|nmos|pmos|american|european|cute inductor|photodiode|zD|sD|diode|thermistor|fuse|resistor|capacitor|inductor|bulb|ground|pR|vR|vC|vL|rmeter|qiprobe|iec|bipolar|pD|varistor|L=|C=|R=|V=|I=)\b/, 'circuitikz'],
  [/\\chemfig\b|\\schemestart\b|\\chemname\b|\\lewis\b|\\setchemfig\b|\\chemleft\b|\\chemabove\b|\\chembelow\b/, 'chemfig'],
  [/\\tdplot|\btdplot_/, 'tikz-3dplot'],
  [/\\mathscr\b/, 'eucal'],
  [/\\tkz[A-Z]/, 'tkz-euclide'],
  [/\\begin\s*\{forest\}/, 'forest'],
  [/\\Tree\b/, 'tikz-qtree'],
  [/\\smartdiagram/, 'smartdiagram'],
  [/\\pie\s*[\[{]/, 'pgf-pie'],
];
export const AUTO_LIBRARIES = [
  [/\bmatrix of (?:math )?nodes\b|\\matrix\b/, 'matrix'],
  [/\b(?:regular polygon|trapezium|semicircle|isosceles triangle|kite|dart|circular sector|cylinder|diamond|star|ellipse)\s*[,\]=]/, 'shapes.geometric'],
  [/\b(?:cross out|strike out|rounded rectangle|chamfered rectangle)\b/, 'shapes.misc'],
  [/\b(?:cloud|forbidden sign|magnifying glass|starburst|signal|tape|magnetic tape|correct forbidden sign)\s*[,\]=]/, 'shapes.symbols'],
  [/\b(?:rectangle split|circle split|ellipse split)\b/, 'shapes.multipart'],
  [/\b(?:single arrow|double arrow|arrow box)\b/, 'shapes.arrows'],
  [/\b(?:rectangle callout|ellipse callout|cloud callout)\b/, 'shapes.callouts'],
  [/\b(?:and|or|nand|nor|xor|xnor|not|buffer) gate\b/, 'shapes.gates.logic.US'],
  [/\bpattern\s*=|\bpattern color\b/, 'patterns'],
  [/\bdecoration\s*=|\bdecorate\b|\bpostaction\s*=\s*\{?\s*decorate/, 'decorations.pathreplacing'],
  [/\b(?:snake|zigzag|random steps|saw|bent|bumps|coil|waves|straight zigzag)\b/, 'decorations.pathmorphing'],
  [/\bmarkings\b|\bmark\s*=\s*at position/, 'decorations.markings'],
  [/\b(?:triangles|crosses|shape backgrounds|footprints)\b/, 'decorations.shapes'],
  [/\btext along path\b|\btext effects along path\b/, 'decorations.text'],
  [/\bKoch\b|\bCantor set\b|\bSierpinski\b/, 'decorations.fractals'],
  [/\bdrop shadow\b|\bcircular drop shadow\b|\bcircular glow\b|\bglow\b/, 'shadows'],
  [/\bpath fading\b|\bfading\b|\\tikzfading\b/, 'fadings'],
  [/\bcanvas is\b/, '3d'],
  [/\bfit\s*=/, 'fit'],
  [/\bon background layer\b|\bbackground rectangle\b|\bshow background\b|\bframed\b|\bgridded\b/, 'backgrounds'],
  [/\bcircle through\b/, 'through'],
  [/\bmindmap\b|\bconcept\b/, 'mindmap'],
  [/\[[^\]]*\bstate\b|\binitial\b|\baccepting\b/, 'automata'],
  [/\bstart chain\b|\bon chain\b|\bchain default direction\b|\bcontinue chain\b/, 'chains'],
  [/\bspy\b/, 'spy'],
  [/\\graph\b|\bgraphs\b/, 'graphs'],
  [/\b(?:tree layout|layered layout|spring layout|spring electrical layout|circular layout|simple necklace layout|binary tree layout)\b/, 'graphdrawing'],
  [/\bturtle\b/, 'turtle'],
  [/\\tikzmath\b/, 'math'],
  [/\blindenmayer system\b|\bl-system\b/, 'lindenmayersystems'],
  [/\bmark\s*=\s*(?!none\b)[a-z*+|ox]/, 'plotmarks'],
  [/\bknot\b/, 'knots'],
  [/\bperspective\b|\b3d view\b/, 'perspective'],
  [/\bsvg\s*\{|\bsvg\s*\[/, 'svg.path'],
  [/\\calendar\b/, 'calendar'],
  [/\bentity\b|\battribute\b|\brelationship\b/, 'er'],
  [/\bplace\b|\btransition\b|\btoken\b/, 'petri'],
  [/\bfpu\b/, 'fpu'],
  [/\bfixed point arithmetic\b/, 'fixedpointarithmetic'],
  [/\bbilinear interpolation\b|\bcolor wheel\b|\bshading\s*=\s*(?:bilinear|color wheel|Mandelbrot|radial)/, 'shadings'],
  [/\bdatavisualization\b/, 'datavisualization'],
  [/\bdatavisualization\b/, 'datavisualization.formats.functions'],
  [/\bcalligraphy\b|\bcopperplate\b/, 'calligraphy'],
  [/\bfolding\b/, 'folding'],
  [/\b(?:latex|stealth|triangle|diamond|open|round|to|hooks|angle)\s*(?:reversed)?'/, 'arrows'],
  [/-(?:latex|stealth|triangle \d+|open triangle \d+|diamond|open diamond|hooks|to|o|\*|\|)\b|\b(?:latex|stealth|to|hooks|o|\*)-/, 'arrows'],
];
export const AUTO_GD_LIBRARIES = [[/\btree layout\b|\bbinary tree layout\b/, 'trees'], [/\blayered layout\b/, 'layered'], [/\bspring\b/, 'force'], [/\bcircular layout\b|\bnecklace\b/, 'circular'], [/\bphylogenetic/, 'phylogenetics']];
export const AUTO_PGFPLOTS_LIBRARIES = [
  [/\\begin\s*\{polaraxis\}/, 'polar'], [/\\begin\s*\{groupplot\}|\bgroup style\b/, 'groupplots'], [/\\begin\s*\{smithchart\}/, 'smithchart'], [/\\begin\s*\{ternaryaxis\}/, 'ternary'],
  [/\bfill between\b|\bsoft clip\b/, 'fillbetween'], [/\bboxplot\b|\bhist\s*=|\\addplot\+?\s*\[[^\]]*\bhist\b/, 'statistics'], [/\bdate coordinates\b/, 'dateplot'],
  [/\bcolormap name\s*=|\bcolormap\s*\/\s*(?:viridis|jet|hot|cool|bluered|greenyellow|redyellow|blackwhite|violet)/, 'colormaps'], [/\bpatch type\s*=/, 'patchplots'], [/\bchange x base\b|\bchange y base\b|\bx SI prefix\b/, 'units'],
];
// Commands that only work with amsmath / amssymb loaded.
export const NEEDS_AMSMATH = /\\(?:text|dfrac|tfrac|cfrac|binom|dbinom|tbinom|boldsymbol|overset|underset|operatorname|substack|xrightarrow|xleftarrow|implies|iff|impliedby|intertext|tag|notag|eqref|smash|mathclap|genfrac|iint|iiint|idotsint|lvert|rvert|lVert|rVert|pmb|dots[bcim]|varinjlim|varprojlim|boxed|DeclareMathOperator|mathring|underbrace|overbrace|sideset|mod|pmod|bmod)\b|\\begin\s*\{(?:aligned|cases|pmatrix|bmatrix|vmatrix|Vmatrix|Bmatrix|matrix|smallmatrix|gathered|split|align\*?|gather\*?|multline\*?|equation\*?|subequations|alignat\*?|flalign\*?)\}/;
export const NEEDS_AMSSYMB = /\\(?:mathbb|mathfrak|square|blacksquare|checkmark|therefore|because|varnothing|nexists|leqslant|geqslant|lesssim|gtrsim|triangleq|measuredangle|sphericalangle|nparallel|bigstar|blacktriangle|blacktriangledown|blacktriangleleft|blacktriangleright|lozenge|blacklozenge|ltimes|rtimes|smallsetminus|complement|subsetneq|supsetneq|nsubseteq|nsupseteq|varkappa|digamma|hslash|twoheadrightarrow|twoheadleftarrow|rightrightarrows|leftleftarrows|rightleftarrows|leftrightarrows|looparrowright|looparrowleft|curvearrowright|curvearrowleft|circlearrowleft|circlearrowright|Vdash|vDash|nvdash|nmid|ncong|approxeq|thicksim|thickapprox|succeq|preceq|doteqdot|eqsim|backsim|dotplus|intercal|veebar|barwedge|boxplus|boxtimes|boxminus|boxdot|circledast|circledcirc|circleddash|Cup|Cap|curlyvee|curlywedge|diagup|diagdown|vartriangle|triangledown|Box|Diamond|lhd|rhd|unlhd|unrhd|leadsto|Join|mho|nleq|ngeq|nless|ngtr|nsim|ntriangleleft|ntriangleright|varsubsetneq|varsupsetneq|eqslantless|eqslantgtr|lessgtr|gtrless|lesseqgtr|gtreqless|backepsilon|pitchfork|between|bumpeq|Bumpeq|shortmid|shortparallel|vartriangleleft|vartriangleright|trianglelefteq|trianglerighteq|multimap|upuparrows|downdownarrows|Lleftarrow|Rrightarrow|lll|ggg|Subset|Supset|sqsubset|sqsupset|dashrightarrow|dashleftarrow|nrightarrow|nleftarrow|nRightarrow|nLeftarrow|nleftrightarrow|nLeftrightarrow|Finv|Game|beth|gimel|daleth|backprime|varpropto|centerdot|circledS|eth|yen|maltese|lozenge|ulcorner|urcorner|llcorner|lrcorner|precsim|succsim|precapprox|succapprox|risingdotseq|fallingdotseq|smallfrown|smallsmile|lvertneqq|gvertneqq|nleqq|ngeqq|lneq|gneq|lneqq|gneqq|nprec|nsucc|npreceq|nsucceq)\b/;

// ------------------------------------------------------------------ unicode

// Characters LaTeX's utf8 input encoding does not know, or knows only in text mode.
export const UNICODE = {
  '−': '\\ensuremath{-}', '×': '\\ensuremath{\\times}', '÷': '\\ensuremath{\\div}', '·': '\\ensuremath{\\cdot}', '⋅': '\\ensuremath{\\cdot}',
  '∘': '\\ensuremath{\\circ}', '°': '\\ensuremath{^\\circ}', '±': '\\ensuremath{\\pm}', '∓': '\\ensuremath{\\mp}',
  '²': '\\ensuremath{^2}', '³': '\\ensuremath{^3}', '¹': '\\ensuremath{^1}', '⁰': '\\ensuremath{^0}', '⁴': '\\ensuremath{^4}', '⁵': '\\ensuremath{^5}', '⁶': '\\ensuremath{^6}', '⁷': '\\ensuremath{^7}', '⁸': '\\ensuremath{^8}', '⁹': '\\ensuremath{^9}', '⁺': '\\ensuremath{^+}', '⁻': '\\ensuremath{^-}', 'ⁿ': '\\ensuremath{^n}',
  '₀': '\\ensuremath{_0}', '₁': '\\ensuremath{_1}', '₂': '\\ensuremath{_2}', '₃': '\\ensuremath{_3}', '₄': '\\ensuremath{_4}', '₅': '\\ensuremath{_5}', '₆': '\\ensuremath{_6}', '₇': '\\ensuremath{_7}', '₈': '\\ensuremath{_8}', '₉': '\\ensuremath{_9}', '₊': '\\ensuremath{_+}', '₋': '\\ensuremath{_-}',
  '½': '\\ensuremath{\\tfrac12}', '¼': '\\ensuremath{\\tfrac14}', '¾': '\\ensuremath{\\tfrac34}', '⅓': '\\ensuremath{\\tfrac13}', '⅔': '\\ensuremath{\\tfrac23}', '⅛': '\\ensuremath{\\tfrac18}', '⅕': '\\ensuremath{\\tfrac15}',
  '≤': '\\ensuremath{\\leq}', '≥': '\\ensuremath{\\geq}', '≠': '\\ensuremath{\\neq}', '≈': '\\ensuremath{\\approx}', '≡': '\\ensuremath{\\equiv}', '∼': '\\ensuremath{\\sim}', '≃': '\\ensuremath{\\simeq}', '≅': '\\ensuremath{\\cong}', '∝': '\\ensuremath{\\propto}', '≪': '\\ensuremath{\\ll}', '≫': '\\ensuremath{\\gg}', '≐': '\\ensuremath{\\doteq}', '≜': '\\ensuremath{\\triangleq}',
  '∞': '\\ensuremath{\\infty}', '√': '\\ensuremath{\\surd}', '∑': '\\ensuremath{\\sum}', '∏': '\\ensuremath{\\prod}', '∫': '\\ensuremath{\\int}', '∬': '\\ensuremath{\\iint}', '∮': '\\ensuremath{\\oint}', '∂': '\\ensuremath{\\partial}', '∇': '\\ensuremath{\\nabla}', '∆': '\\ensuremath{\\Delta}', 'Ω': '\\ensuremath{\\Omega}', 'µ': '\\ensuremath{\\mu}',
  '∈': '\\ensuremath{\\in}', '∉': '\\ensuremath{\\notin}', '∋': '\\ensuremath{\\ni}', '⊂': '\\ensuremath{\\subset}', '⊃': '\\ensuremath{\\supset}', '⊆': '\\ensuremath{\\subseteq}', '⊇': '\\ensuremath{\\supseteq}', '∪': '\\ensuremath{\\cup}', '∩': '\\ensuremath{\\cap}', '∅': '\\ensuremath{\\emptyset}', '∖': '\\ensuremath{\\setminus}',
  '∠': '\\ensuremath{\\angle}', '∡': '\\ensuremath{\\measuredangle}', '⊥': '\\ensuremath{\\perp}', '∥': '\\ensuremath{\\parallel}', '∦': '\\ensuremath{\\nparallel}', '△': '\\ensuremath{\\triangle}', '⌀': '\\ensuremath{\\varnothing}', '′': '\\ensuremath{^\\prime}', '″': '\\ensuremath{^{\\prime\\prime}}',
  '←': '\\ensuremath{\\leftarrow}', '→': '\\ensuremath{\\rightarrow}', '↔': '\\ensuremath{\\leftrightarrow}', '↑': '\\ensuremath{\\uparrow}', '↓': '\\ensuremath{\\downarrow}', '⇒': '\\ensuremath{\\Rightarrow}', '⇐': '\\ensuremath{\\Leftarrow}', '⇔': '\\ensuremath{\\Leftrightarrow}', '↦': '\\ensuremath{\\mapsto}', '⟶': '\\ensuremath{\\longrightarrow}', '⟹': '\\ensuremath{\\Longrightarrow}', '⇌': '\\ensuremath{\\rightleftharpoons}',
  '∀': '\\ensuremath{\\forall}', '∃': '\\ensuremath{\\exists}', '∄': '\\ensuremath{\\nexists}', '¬': '\\ensuremath{\\neg}', '∧': '\\ensuremath{\\wedge}', '∨': '\\ensuremath{\\vee}', '⊕': '\\ensuremath{\\oplus}', '⊗': '\\ensuremath{\\otimes}', '∴': '\\ensuremath{\\therefore}', '∵': '\\ensuremath{\\because}',
  'ℂ': '\\ensuremath{\\mathbb{C}}', 'ℕ': '\\ensuremath{\\mathbb{N}}', 'ℚ': '\\ensuremath{\\mathbb{Q}}', 'ℝ': '\\ensuremath{\\mathbb{R}}', 'ℤ': '\\ensuremath{\\mathbb{Z}}', 'ℓ': '\\ensuremath{\\ell}', 'ℏ': '\\ensuremath{\\hbar}', 'ℵ': '\\ensuremath{\\aleph}',
  '⋯': '\\ensuremath{\\cdots}', '⋮': '\\ensuremath{\\vdots}', '⋱': '\\ensuremath{\\ddots}', '⟨': '\\ensuremath{\\langle}', '⟩': '\\ensuremath{\\rangle}', '〈': '\\ensuremath{\\langle}', '〉': '\\ensuremath{\\rangle}', '‖': '\\ensuremath{\\|}',
  '✓': '\\ensuremath{\\checkmark}', '✔': '\\ensuremath{\\checkmark}', '✗': '\\ensuremath{\\times}', '✘': '\\ensuremath{\\times}', '★': '\\ensuremath{\\bigstar}', '☆': '\\ensuremath{\\star}', '○': '\\ensuremath{\\circ}', '●': '\\ensuremath{\\bullet}', '□': '\\ensuremath{\\square}', '■': '\\ensuremath{\\blacksquare}', '▲': '\\ensuremath{\\blacktriangle}', '▼': '\\ensuremath{\\blacktriangledown}', '◆': '\\ensuremath{\\blacklozenge}', '◇': '\\ensuremath{\\lozenge}', '♠': '\\ensuremath{\\spadesuit}', '♣': '\\ensuremath{\\clubsuit}', '♥': '\\ensuremath{\\heartsuit}', '♦': '\\ensuremath{\\diamondsuit}',
  '―': '---', '‐': '-', '‒': '--', '⁃': '-', '∗': '\\ensuremath{\\ast}', '∙': '\\ensuremath{\\bullet}', '∶': '\\ensuremath{:}', '∷': '\\ensuremath{::}',
};
const GREEK = { 'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 'ε': 'varepsilon', 'ϵ': 'epsilon', 'ζ': 'zeta', 'η': 'eta', 'θ': 'theta', 'ϑ': 'vartheta', 'ι': 'iota', 'κ': 'kappa', 'λ': 'lambda', 'μ': 'mu', 'ν': 'nu', 'ξ': 'xi', 'π': 'pi', 'ϖ': 'varpi', 'ρ': 'rho', 'ϱ': 'varrho', 'σ': 'sigma', 'ς': 'varsigma', 'τ': 'tau', 'υ': 'upsilon', 'φ': 'varphi', 'ϕ': 'phi', 'χ': 'chi', 'ψ': 'psi', 'ω': 'omega', 'Γ': 'Gamma', 'Δ': 'Delta', 'Θ': 'Theta', 'Λ': 'Lambda', 'Ξ': 'Xi', 'Π': 'Pi', 'Σ': 'Sigma', 'Υ': 'Upsilon', 'Φ': 'Phi', 'Ψ': 'Psi', 'Ω': 'Omega' };
for (const [char, name] of Object.entries(GREEK)) UNICODE[char] = `\\ensuremath{\\${name}}`;
UNICODE['ο'] = 'o';
for (const [char, latin] of Object.entries({ 'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'H', 'Ι': 'I', 'Κ': 'K', 'Μ': 'M', 'Ν': 'N', 'Ο': 'O', 'Ρ': 'P', 'Τ': 'T', 'Χ': 'X' })) UNICODE[char] = latin;

// Characters utf8 LaTeX already handles with T1/TS1 fonts: Latin letters and common punctuation.
export function isSupportedUnicode(char) {
  const code = char.codePointAt(0);
  if (code < 0x80) return true;
  if (code >= 0xA0 && code <= 0x24F) return true; // Latin-1 and Latin Extended A/B
  if (code >= 0x2018 && code <= 0x201F) return true; // quotes
  return '–—†‡•…‰‹›€™¡¿«»§¶©®ªº¸¢£¥­¨´ˇ˘˝˛˙˚'.includes(char);
}

// ------------------------------------------------------------------ colours

// The 68 dvips names, verbatim from the bundled dvipsnam.def (cmyk).
export const DVIPS_COLORS = { GreenYellow: '0.15,0,0.69,0', Yellow: '0,0,1,0', Goldenrod: '0,0.10,0.84,0', Dandelion: '0,0.29,0.84,0', Apricot: '0,0.32,0.52,0', Peach: '0,0.50,0.70,0', Melon: '0,0.46,0.50,0', YellowOrange: '0,0.42,1,0', Orange: '0,0.61,0.87,0', BurntOrange: '0,0.51,1,0', Bittersweet: '0,0.75,1,0.24', RedOrange: '0,0.77,0.87,0', Mahogany: '0,0.85,0.87,0.35', Maroon: '0,0.87,0.68,0.32', BrickRed: '0,0.89,0.94,0.28', Red: '0,1,1,0', OrangeRed: '0,1,0.50,0', RubineRed: '0,1,0.13,0', WildStrawberry: '0,0.96,0.39,0', Salmon: '0,0.53,0.38,0', CarnationPink: '0,0.63,0,0', Magenta: '0,1,0,0', VioletRed: '0,0.81,0,0', Rhodamine: '0,0.82,0,0', Mulberry: '0.34,0.90,0,0.02', RedViolet: '0.07,0.90,0,0.34', Fuchsia: '0.47,0.91,0,0.08', Lavender: '0,0.48,0,0', Thistle: '0.12,0.59,0,0', Orchid: '0.32,0.64,0,0', DarkOrchid: '0.40,0.80,0.20,0', Purple: '0.45,0.86,0,0', Plum: '0.50,1,0,0', Violet: '0.79,0.88,0,0', RoyalPurple: '0.75,0.90,0,0', BlueViolet: '0.86,0.91,0,0.04', Periwinkle: '0.57,0.55,0,0', CadetBlue: '0.62,0.57,0.23,0', CornflowerBlue: '0.65,0.13,0,0', MidnightBlue: '0.98,0.13,0,0.43', NavyBlue: '0.94,0.54,0,0', RoyalBlue: '1,0.50,0,0', Blue: '1,1,0,0', Cerulean: '0.94,0.11,0,0', Cyan: '1,0,0,0', ProcessBlue: '0.96,0,0,0', SkyBlue: '0.62,0,0.12,0', Turquoise: '0.85,0,0.20,0', TealBlue: '0.86,0,0.34,0.02', Aquamarine: '0.82,0,0.30,0', BlueGreen: '0.85,0,0.33,0', Emerald: '1,0,0.50,0', JungleGreen: '0.99,0,0.52,0', SeaGreen: '0.69,0,0.50,0', Green: '1,0,1,0', ForestGreen: '0.91,0,0.88,0.12', PineGreen: '0.92,0,0.59,0.25', LimeGreen: '0.50,0,1,0', YellowGreen: '0.44,0,0.74,0', SpringGreen: '0.26,0,0.76,0', OliveGreen: '0.64,0,0.95,0.40', RawSienna: '0,0.72,1,0.45', Sepia: '0,0.83,1,0.70', Brown: '0,0.81,1,0.60', Tan: '0.14,0.42,0.56,0', Gray: '0,0,0,0.50', Black: '0,0,0,1', White: '0,0,0,0' };
// CSS / xcolor svgnames (hex) plus the Tailwind-style names models trained on CSS reach for.
export const CSS_COLORS = { aliceblue: 'F0F8FF', antiquewhite: 'FAEBD7', aqua: '00FFFF', aquamarine: '7FFFD4', azure: 'F0FFFF', beige: 'F5F5DC', bisque: 'FFE4C4', blanchedalmond: 'FFEBCD', blueviolet: '8A2BE2', burlywood: 'DEB887', cadetblue: '5F9EA0', chartreuse: '7FFF00', chocolate: 'D2691E', coral: 'FF7F50', cornflowerblue: '6495ED', cornsilk: 'FFF8DC', crimson: 'DC143C', darkblue: '00008B', darkcyan: '008B8B', darkgoldenrod: 'B8860B', darkgreen: '006400', darkgrey: 'A9A9A9', darkkhaki: 'BDB76B', darkmagenta: '8B008B', darkolivegreen: '556B2F', darkorange: 'FF8C00', darkorchid: '9932CC', darkred: '8B0000', darksalmon: 'E9967A', darkseagreen: '8FBC8F', darkslateblue: '483D8B', darkslategray: '2F4F4F', darkslategrey: '2F4F4F', darkturquoise: '00CED1', darkviolet: '9400D3', deeppink: 'FF1493', deepskyblue: '00BFFF', dimgray: '696969', dimgrey: '696969', dodgerblue: '1E90FF', firebrick: 'B22222', floralwhite: 'FFFAF0', forestgreen: '228B22', fuchsia: 'FF00FF', gainsboro: 'DCDCDC', ghostwhite: 'F8F8FF', gold: 'FFD700', goldenrod: 'DAA520', greenyellow: 'ADFF2F', grey: '808080', honeydew: 'F0FFF0', hotpink: 'FF69B4', indianred: 'CD5C5C', indigo: '4B0082', ivory: 'FFFFF0', khaki: 'F0E68C', lavender: 'E6E6FA', lavenderblush: 'FFF0F5', lawngreen: '7CFC00', lemonchiffon: 'FFFACD', lightblue: 'ADD8E6', lightcoral: 'F08080', lightcyan: 'E0FFFF', lightgoldenrodyellow: 'FAFAD2', lightgoldenrod: 'FAFAD2', lightgreen: '90EE90', lightgrey: 'D3D3D3', lightpink: 'FFB6C1', lightsalmon: 'FFA07A', lightseagreen: '20B2AA', lightskyblue: '87CEFA', lightslategray: '778899', lightslategrey: '778899', lightsteelblue: 'B0C4DE', lightyellow: 'FFFFE0', limegreen: '32CD32', linen: 'FAF0E6', maroon: '800000', mediumaquamarine: '66CDAA', mediumblue: '0000CD', mediumorchid: 'BA55D3', mediumpurple: '9370DB', mediumseagreen: '3CB371', mediumslateblue: '7B68EE', mediumspringgreen: '00FA9A', mediumturquoise: '48D1CC', mediumvioletred: 'C71585', midnightblue: '191970', mintcream: 'F5FFFA', mistyrose: 'FFE4E1', moccasin: 'FFE4B5', navajowhite: 'FFDEAD', navy: '000080', navyblue: '000080', oldlace: 'FDF5E6', olivedrab: '6B8E23', orangered: 'FF4500', orchid: 'DA70D6', palegoldenrod: 'EEE8AA', palegreen: '98FB98', paleturquoise: 'AFEEEE', palevioletred: 'DB7093', papayawhip: 'FFEFD5', peachpuff: 'FFDAB9', peru: 'CD853F', plum: 'DDA0DD', powderblue: 'B0E0E6', rebeccapurple: '663399', rosybrown: 'BC8F8F', royalblue: '4169E1', saddlebrown: '8B4513', salmon: 'FA8072', sandybrown: 'F4A460', seagreen: '2E8B57', seashell: 'FFF5EE', sienna: 'A0522D', silver: 'C0C0C0', skyblue: '87CEEB', slateblue: '6A5ACD', slategray: '708090', slategrey: '708090', snow: 'FFFAFA', springgreen: '00FF7F', steelblue: '4682B4', tan: 'D2B48C', thistle: 'D8BFD8', tomato: 'FF6347', turquoise: '40E0D0', violetred: 'D02090', wheat: 'F5DEB3', whitesmoke: 'F5F5F5', yellowgreen: '9ACD32',
  slate: '64748B', zinc: '71717A', neutral: '737373', stone: '78716C', amber: 'F59E0B', emerald: '10B981', sky: '0EA5E9', rose: 'F43F5E', lightorange: 'FFB74D', darkyellow: 'CCCC00', lightpurple: 'B39DDB', darkpurple: '4A148C', lightred: 'EF9A9A', darkpink: 'AD1457', lightbrown: 'BCAAA4', darkbrown: '4E342E', lightviolet: 'D1C4E9', darkteal: '00695C', lightteal: '80CBC4', darkgold: 'B8860B', darklime: '9ACD32', lightlime: 'D4FF80' };
export const BASE_COLORS = new Set(['red', 'green', 'blue', 'cyan', 'magenta', 'yellow', 'black', 'gray', 'white', 'darkgray', 'lightgray', 'brown', 'lime', 'olive', 'orange', 'pink', 'purple', 'teal', 'violet']);

// -------------------------------------------------------------------- shims

export const COMPAT_SHIM = String.raw`\providecommand{\degree}{\ensuremath{^\circ}}
\providecommand{\celsius}{\ensuremath{^\circ\mathrm{C}}}
\providecommand{\degreeCelsius}{\celsius}
\providecommand{\perthousand}{\textperthousand}
\providecommand{\ohm}{\ensuremath{\Omega}}
\providecommand{\micro}{\ensuremath{\mu}}
\providecommand{\uv}[1]{\quotedblbase #1\textquotedblleft}
\providecommand{\euro}{\texteuro}
\providecommand{\textdegree}{\ensuremath{^\circ}}
\providecommand{\mathds}[1]{\mathbb{#1}}
\providecommand{\mathbbm}[1]{\mathbb{#1}}
\providecommand{\mathscr}[1]{\mathcal{#1}}
\providecommand{\cancel}[1]{#1}
\providecommand{\bcancel}[1]{#1}
\providecommand{\xcancel}[1]{#1}
\providecommand{\cancelto}[2]{#2}
\providecommand{\smiley}{\ensuremath{\ddot\smile}}
\providecommand{\frownie}{\ensuremath{\ddot\frown}}
\providecommand{\EUR}{\texteuro}
\providecommand{\coloneqq}{\mathrel{\mathop:}=}
\providecommand{\nicefrac}[2]{{}^{#1}\!/_{#2}}
\providecommand{\sfrac}[2]{{}^{#1}\!/_{#2}}
\providecommand{\faicon}[1]{}`;

export const SI_UNITS = { metre: 'm', meter: 'm', gram: 'g', second: 's', ampere: 'A', kelvin: 'K', mole: 'mol', candela: 'cd', minute: 'min', hour: 'h', litre: 'l', liter: 'l', newton: 'N', joule: 'J', watt: 'W', volt: 'V', pascal: 'Pa', hertz: 'Hz', tonne: 't', coulomb: 'C', farad: 'F', henry: 'H', tesla: 'T', weber: 'Wb', lumen: 'lm', lux: 'lx', becquerel: 'Bq', sievert: 'Sv', radian: 'rad', steradian: 'sr', electronvolt: 'eV', atmosphere: 'atm', astronomicalunit: 'au', dalton: 'Da', hectare: 'ha', arcminute: "'", arcsecond: "''", elementarycharge: 'e', kilowatthour: 'kWh', byte: 'B', bit: 'bit', decibel: 'dB', neper: 'Np', knot: 'kn', nauticalmile: 'M', percent: '\\%', degree: '^\\circ', degreeCelsius: '^\\circ C', ohm: '\\Omega', angstrom: '\\text{\\AA}', kilogram: 'kg', kilometre: 'km', kilometer: 'km', centimetre: 'cm', centimeter: 'cm', millimetre: 'mm', millimeter: 'mm', decimetre: 'dm', micrometre: '\\mu m', nanometre: 'nm', millilitre: 'ml', milliliter: 'ml', kilopascal: 'kPa', hectopascal: 'hPa', kilojoule: 'kJ', kilowatt: 'kW', megawatt: 'MW', milliampere: 'mA', kilovolt: 'kV', millivolt: 'mV', kilohertz: 'kHz', megahertz: 'MHz', gigahertz: 'GHz', kilonewton: 'kN', millisecond: 'ms', microsecond: '\\mu s', nanosecond: 'ns', milligram: 'mg', microgram: '\\mu g', celsius: '^\\circ C', permille: '\\text{\\textperthousand}', squaremetre: 'm^{2}', cubicmetre: 'm^{3}', squarecentimetre: 'cm^{2}', cubiccentimetre: 'cm^{3}', metrepersecond: 'm/s', kilometreperhour: 'km/h' };
export const SI_PREFIXES = { yocto: 'y', zepto: 'z', atto: 'a', femto: 'f', pico: 'p', nano: 'n', micro: '\\mu ', milli: 'm', centi: 'c', deci: 'd', deca: 'da', deka: 'da', hecto: 'h', kilo: 'k', mega: 'M', giga: 'G', tera: 'T', peta: 'P', exa: 'E' };

export function siunitxShim() {
  const lines = [String.raw`\providecommand{\num}[2][]{\ensuremath{#2}}`,
    String.raw`\providecommand{\si}[2][]{\ensuremath{\mathrm{#2}}}`,
    String.raw`\providecommand{\unit}[2][]{\si{#2}}`,
    String.raw`\providecommand{\SI}[3][]{\ensuremath{#2\,\mathrm{#3}}}`,
    String.raw`\providecommand{\qty}[3][]{\SI{#2}{#3}}`,
    String.raw`\providecommand{\ang}[2][]{\ensuremath{#2^\circ}}`,
    String.raw`\providecommand{\SIrange}[4][]{\SI{#2}{#4}--\SI{#3}{#4}}`,
    String.raw`\providecommand{\qtyrange}[4][]{\SIrange{#2}{#3}{#4}}`,
    String.raw`\providecommand{\numrange}[3][]{\num{#2}--\num{#3}}`,
    String.raw`\providecommand{\SIlist}[3][]{#2\,\si{#3}}`,
    String.raw`\providecommand{\qtylist}[3][]{#2\,\si{#3}}`,
    String.raw`\providecommand{\numlist}[2][]{#2}`,
    String.raw`\providecommand{\per}{/}`,
    String.raw`\providecommand{\squared}{^{2}}`,
    String.raw`\providecommand{\cubed}{^{3}}`,
    String.raw`\providecommand{\tothe}[1]{^{#1}}`,
    String.raw`\providecommand{\raiseto}[2]{#2^{#1}}`,
    String.raw`\def\square#1{#1^{2}}`,
    String.raw`\def\cubic#1{#1^{3}}`];
  for (const [name, text] of Object.entries(SI_UNITS)) lines.push(`\\providecommand{\\${name}}{${text}}`);
  for (const [name, text] of Object.entries(SI_PREFIXES)) lines.push(`\\providecommand{\\${name}}{${text}}`);
  return lines.join('\n');
}

export const PHYSICS_SHIM = String.raw`\providecommand{\dd}[1]{\mathrm{d}#1}
\ProvideDocumentCommand{\dv}{o m m}{\IfNoValueTF{#1}{\frac{\mathrm{d}#2}{\mathrm{d}#3}}{\frac{\mathrm{d}^{#1}#2}{\mathrm{d}#3^{#1}}}}
\ProvideDocumentCommand{\pdv}{o m m}{\IfNoValueTF{#1}{\frac{\partial #2}{\partial #3}}{\frac{\partial^{#1}#2}{\partial #3^{#1}}}}
\providecommand{\vb}[1]{\mathbf{#1}}
\providecommand{\va}[1]{\vec{#1}}
\providecommand{\vu}[1]{\hat{\mathbf{#1}}}
\providecommand{\abs}[1]{\left|#1\right|}
\providecommand{\norm}[1]{\left\|#1\right\|}
\providecommand{\grad}{\nabla}
\providecommand{\curl}{\nabla\times}
\providecommand{\divergence}{\nabla\cdot}
\providecommand{\laplacian}{\nabla^2}
\providecommand{\order}[1]{\mathcal{O}(#1)}
\providecommand{\eval}[1]{\left.#1\right|}
\providecommand{\expval}[1]{\langle #1\rangle}
\providecommand{\ket}[1]{\left|#1\right\rangle}
\providecommand{\bra}[1]{\left\langle #1\right|}
\providecommand{\braket}[2]{\left\langle #1\middle|#2\right\rangle}
\providecommand{\comm}[2]{\left[#1,#2\right]}
\providecommand{\tr}{\operatorname{tr}}
\providecommand{\Tr}{\operatorname{Tr}}
\providecommand{\rank}{\operatorname{rank}}
\providecommand{\erf}{\operatorname{erf}}
\providecommand{\Res}{\operatorname{Res}}`;

export const GREEK_NAMES = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta', 'theta', 'vartheta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi', 'varpi', 'rho', 'varrho', 'sigma', 'varsigma', 'tau', 'upsilon', 'phi', 'varphi', 'chi', 'psi', 'omega', 'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon', 'Phi', 'Psi', 'Omega'];

// Macros that only work in math mode; bare in node text they must be wrapped.
export const MATH_MACROS = new Set(['frac', 'dfrac', 'tfrac', 'sqrt', 'vec', 'overline', 'overrightarrow', 'widehat', 'hat', 'bar', 'dot', 'ddot', 'tilde', 'cdot', 'times', 'div', 'pm', 'mp', 'le', 'ge', 'leq', 'geq', 'neq', 'ne', 'approx', 'equiv', 'sim', 'infty', 'rightarrow', 'leftarrow', 'Rightarrow', 'Leftarrow', 'leftrightarrow', 'Leftrightarrow', 'to', 'mapsto', 'sum', 'prod', 'int', 'ldots', 'cdots', 'angle', 'triangle', 'perp', 'parallel', 'sin', 'cos', 'tan', 'cot', 'log', 'ln', 'exp', 'lim', 'min', 'max', 'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta', 'theta', 'vartheta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi', 'rho', 'sigma', 'tau', 'upsilon', 'phi', 'varphi', 'chi', 'psi', 'omega', 'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Phi', 'Psi', 'Omega', 'mathbb', 'mathcal', 'mathrm', 'mathbf', 'mathit', 'boldsymbol', 'partial', 'nabla', 'in', 'notin', 'subset', 'subseteq', 'cup', 'cap', 'emptyset', 'forall', 'exists', 'neg', 'wedge', 'vee', 'binom', 'prime', 'circ', 'bullet', 'star', 'ast', 'oplus', 'otimes', 'langle', 'rangle', 'lfloor', 'rfloor', 'lceil', 'rceil', 'left', 'right', 'big', 'Big', 'measuredangle', 'varnothing', 'therefore', 'because', 'implies', 'iff', 'mathscr', 'mathfrak', 'hbar', 'ell', 'surd', 'propto', 'simeq', 'cong', 'll', 'gg', 'doteq', 'setminus', 'supset', 'supseteq', 'ni', 'nexists', 'uparrow', 'downarrow', 'Longrightarrow', 'longrightarrow', 'rightleftharpoons', 'cdots', 'vdots', 'ddots', 'checkmark', 'bigstar', 'square', 'blacksquare', 'spadesuit', 'clubsuit', 'heartsuit', 'diamondsuit', 'text', 'operatorname', 'underbrace', 'overbrace', 'not']);
// Text-level macros whose arguments are still text (recurse into them when repairing node text).
export const TEXT_ARG_MACROS = new Set(['textbf', 'textit', 'emph', 'underline', 'texttt', 'textsc', 'textsf', 'textrm', 'textnormal', 'textup', 'textsl', 'mbox', 'fbox', 'uv', 'parbox', 'makebox', 'framebox', 'textcolor', 'colorbox', 'footnote']);


/** Node shape names (pgf core + shapes.* libraries) — a style of the same name refers to the shape inside its own body. */
export const SHAPE_NAMES = new Set(['rectangle', 'circle', 'coordinate', 'ellipse', 'diamond', 'trapezium', 'semicircle', 'regular polygon', 'star', 'isosceles triangle', 'kite', 'dart', 'circular sector', 'cylinder', 'cloud', 'starburst', 'signal', 'tape', 'magnifying glass', 'forbidden sign', 'magnetic tape', 'cross out', 'strike out', 'rounded rectangle', 'chamfered rectangle', 'rectangle split', 'circle split', 'circle solidus', 'ellipse split', 'rectangle callout', 'ellipse callout', 'cloud callout', 'arrow box', 'single arrow', 'double arrow', 'circle ee', 'circle wee', 'cross', 'ground', 'generic circle IEC', 'generic diode IEC', 'and gate', 'or gate', 'nand gate', 'nor gate', 'xor gate', 'xnor gate', 'not gate', 'buffer gate']);

/** Macro-name typos models make → the intended TeX. */
export const MACRO_TYPOS = { circC: '\\circ\\mathrm{C}', degreeC: '^\\circ\\mathrm{C}', textcelsius: '\\celsius', textdegreeC: '\\textdegree C' };
