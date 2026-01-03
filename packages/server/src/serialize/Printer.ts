/**
 * Printer class for serializing objects with proper indentation management.
 * Maintains an internal stack of indentation levels for nested structures.
 */
export class Printer {
  private buffer: string = "";
  private indentStack: number[] = [];

  constructor(private baseIndent: number) {
    this.buffer = " ".repeat(baseIndent);
  }

  /**
   * Write text on the current line (no automatic newline).
   */
  write(text: string): this {
    this.buffer += text;
    return this;
  }

  /**
   * Utility writer to write only non-emptyish text and join with " "
   */
  writeParts(...text: unknown[]): this {
    this.write(text.filter((text) => Boolean(text)).join(" "));
    return this;
  }

  /**
   * Create a newline with current indentation
   */
  newline(): this {
    this.buffer +=
      "\n" +
      " ".repeat(this.baseIndent + this.indentStack.reduce((a, b) => a + b, 0));
    return this;
  }

  /**
   * Push current indentation onto the stack and increase indentation.
   */
  pushIndentation(count: number): this {
    this.indentStack.push(count);
    return this;
  }

  /**
   * Restore to the previous indentation level from the stack.
   */
  popIndentation(): this {
    this.indentStack.pop();
    return this;
  }

  /**
   * Get the accumulated output string, removing the trailing spaces after last newline
   */
  toString(): string {
    return this.buffer.replace(/\n\s+$/, "\n");
  }
}
