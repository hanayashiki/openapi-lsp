import { indent } from "./utils.js";

export interface LiteralSerializeOptions {
  maxDepth?: number; // Default: 2
  maxItems?: number; // Default: 5
}

interface LiteralSerializerContext {
  currentDepth: number;
  maxDepth: number;
  maxItems: number;
  indent: number;
}

function serializeLiteral(value: unknown, ctx: LiteralSerializerContext): string {
  // Depth limit reached
  if (ctx.currentDepth > ctx.maxDepth) {
    return "...";
  }

  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }

    const nextCtx: LiteralSerializerContext = {
      ...ctx,
      currentDepth: ctx.currentDepth + 1,
      indent: ctx.indent + 1,
    };

    const items = value.slice(0, ctx.maxItems);
    const hasMore = value.length > ctx.maxItems;

    const lines: string[] = ["["];
    for (const item of items) {
      const serialized = serializeLiteral(item, nextCtx);
      lines.push(`${indent(ctx.indent + 1)}${serialized},`);
    }
    if (hasMore) {
      lines.push(`${indent(ctx.indent + 1)}... (${value.length - ctx.maxItems} more)`);
    }
    lines.push(`${indent(ctx.indent)}]`);
    return lines.join("\n");
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return "{}";
    }

    const nextCtx: LiteralSerializerContext = {
      ...ctx,
      currentDepth: ctx.currentDepth + 1,
      indent: ctx.indent + 1,
    };

    const items = entries.slice(0, ctx.maxItems);
    const hasMore = entries.length > ctx.maxItems;

    const lines: string[] = ["{"];
    for (const [key, val] of items) {
      const serialized = serializeLiteral(val, nextCtx);
      lines.push(`${indent(ctx.indent + 1)}${JSON.stringify(key)}: ${serialized},`);
    }
    if (hasMore) {
      lines.push(`${indent(ctx.indent + 1)}... (${entries.length - ctx.maxItems} more)`);
    }
    lines.push(`${indent(ctx.indent)}}`)
    return lines.join("\n");
  }

  return "unknown";
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

  const ctx: LiteralSerializerContext = {
    currentDepth: 0,
    maxDepth,
    maxItems,
    indent: 0,
  };

  const serialized = serializeLiteral(value, ctx);

  return `**${name}**\n\n\`\`\`json\n${serialized}\n\`\`\``;
}
