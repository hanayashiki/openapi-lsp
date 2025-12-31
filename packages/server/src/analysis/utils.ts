import { Position, Range } from "vscode-languageserver-textdocument";

export function isPositionInRange(position: Position, range: Range): boolean {
  // Check if position is before range start
  if (position.line < range.start.line) return false;
  if (
    position.line === range.start.line &&
    position.character < range.start.character
  )
    return false;

  // Check if position is after range end
  if (position.line > range.end.line) return false;
  if (
    position.line === range.end.line &&
    position.character > range.end.character
  )
    return false;

  return true;
}
