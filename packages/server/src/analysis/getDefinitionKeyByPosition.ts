import { Position } from "vscode-languageserver-textdocument";
import { Analysis, Definition } from "./Analysis.js";
import { isPositionInRange } from "./utils.js";

export function getDefinitionKeyByPosition(
  analysis: Analysis,
  position: Position
): Definition | null {
  for (const def of analysis.definitions) {
    if (isPositionInRange(position, def.nameRange)) {
      return def;
    }
  }
  return null;
}
