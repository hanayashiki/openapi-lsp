import { Position } from "vscode-languageserver-textdocument";
import { ParseResult, Definition } from "./Analysis.js";
import { isPositionInRange } from "./utils.js";

export function getDefinitionKeyByPosition(
  parseResult: ParseResult,
  position: Position
): Definition | null {
  for (const def of parseResult.definitions) {
    if (isPositionInRange(position, def.nameRange)) {
      return def;
    }
  }
  return null;
}
