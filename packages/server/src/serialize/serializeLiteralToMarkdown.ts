import { Printer } from "./Printer.js";

export interface LiteralSerializeOptions {
  maxDepth?: number; // Default: 2
  maxItems?: number; // Default: 5
}

interface LiteralSerializerContext {
  currentDepth: number;
  maxDepth: number;
  maxItems: number;
  printer: Printer;
}

function serializeLiteral(value: unknown, ctx: LiteralSerializerContext): void {
  const { printer } = ctx;

  // Depth limit reached
  if (ctx.currentDepth > ctx.maxDepth) {
    printer.write("/* ... */");
    return;
  }

  if (value === null) {
    printer.write("null");
    return;
  }

  if (typeof value === "string") {
    printer.write(JSON.stringify(value));
    return;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    printer.write(String(value));
    return;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      printer.write("[]");
      return;
    }

    const items = value.slice(0, ctx.maxItems);
    const hasMore = value.length > ctx.maxItems;

    printer.write("[");
    printer.pushIndentation(3);

    for (const item of items) {
      printer.newline();
      serializeLiteral(item, {
        ...ctx,
        currentDepth: ctx.currentDepth + 1,
      });
      printer.write(",");
    }
    if (hasMore) {
      printer
        .newline()
        .write(`/* ... (${value.length - ctx.maxItems} more) */`);
    }

    printer.popIndentation();
    printer.newline().write("]");
    return;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      printer.write("{}");
      return;
    }

    const items = entries.slice(0, ctx.maxItems);
    const hasMore = entries.length > ctx.maxItems;

    printer.write("{");
    printer.pushIndentation(3);

    for (const [key, val] of items) {
      printer.newline().write(`${JSON.stringify(key)}: `);
      serializeLiteral(val, {
        ...ctx,
        currentDepth: ctx.currentDepth + 1,
      });
      printer.write(",");
    }
    if (hasMore) {
      printer
        .newline()
        .write(`/* ... (${entries.length - ctx.maxItems} more) */`);
    }

    printer.popIndentation();
    printer.newline().write("}");
    return;
  }

  printer.write("unknown");
}

/**
 * Serialize a literal value to markdown for hover display.
 * Used when no nominal type is available.
 */
export function serializeLiteralToMarkdown(
  value: unknown,
  name: string,
  options: LiteralSerializeOptions = {}
): string {
  const { maxDepth = 2, maxItems = 5 } = options;

  const printer = new Printer(0);
  const ctx: LiteralSerializerContext = {
    currentDepth: 0,
    maxDepth,
    maxItems,
    printer,
  };

  serializeLiteral(value, ctx);
  const serialized = printer.toString();

  return `**${name}**\n\n\`\`\`json\n${serialized}\n\`\`\``;
}
