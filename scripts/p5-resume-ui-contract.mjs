import ts from "typescript";

export const P5_CURRENT_RESUME_BUTTON_TEXT = "戦闘を再開";
const supported = new Set([P5_CURRENT_RESUME_BUTTON_TEXT, "作戦を再開"]);

export function assertP5ResumeButtonText(text) {
  if (!supported.has(text)) throw new Error(`Unsupported P5 resume button text: ${text}`);
  return text;
}

// The exact-base route serves a separately built checkout. Read its real JSX
// control rather than imposing the candidate's renamed label on that version.
export function p5ResumeButtonTextForSource(source) {
  const parsed = ts.createSourceFile("AshfallGame.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (parsed.parseDiagnostics.length) throw new Error("Cannot parse exact-base resume UI source");
  const matches = [];
  function visit(node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(parsed) === "button") {
      const handler = node.openingElement.attributes.properties.find(attribute => (
        ts.isJsxAttribute(attribute) && attribute.name.getText(parsed) === "onClick"
      ))?.initializer;
      const isRealResume = handler && ts.isJsxExpression(handler)
        && handler.expression && ts.isIdentifier(handler.expression)
        && handler.expression.text === "togglePause";
      if (isRealResume && node.children.every(ts.isJsxText)) {
        const text = node.children.map(child => child.text).join("").trim();
        if (supported.has(text)) matches.push(text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  if (matches.length !== 1) throw new Error(`Expected one exact-base resume control, found ${matches.length}`);
  return matches[0];
}
