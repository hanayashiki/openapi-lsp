import { LineCounter, Range as YamlRange } from "yaml";
import { Position, Range } from "vscode-languageserver-textdocument";

export function positionToOffset(
  lineCounter: LineCounter,
  position: Position
): number {
  const lineStart = lineCounter.lineStarts[position.line] ?? 0;
  return lineStart + position.character;
}

export function offsetToRange(
  lineCounter: LineCounter,
  range: YamlRange
): Range {
  const start = lineCounter.linePos(range[0]);
  const end = lineCounter.linePos(range[2]);
  return {
    start: { line: start.line - 1, character: start.col - 1 },
    end: { line: end.line - 1, character: end.col - 1 },
  };
}

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
