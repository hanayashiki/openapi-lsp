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

const INLINE_THRESHOLD = 60;

/**
 * Check if a string looks like JSON (starts/ends with {} or [])
 */
function isLikelyJson(value: string): boolean {
  const trimmed = value.trim();
  return (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  );
}

/**
 * Check if a string looks like code rather than natural language.
 * Uses heuristics based on code-like patterns.
 */
function isLikelyCode(value: string): boolean {
  // Code indicators (weighted)
  const codePatterns = [
    /[{}();=]/, // Common code punctuation
    /^\s+\S/m, // Indented lines
    /\b(function|const|let|var|import|export|class|def|if|else|for|while|return)\b/, // Keywords
    /[a-z][A-Z]/, // camelCase
    /\w+_\w+/, // snake_case
    /https?:\/\//, // URLs
    /curl\s/, // curl commands
    /\$\w+/, // Shell variables
    /\.\w+\(/, // Method calls
  ];

  let codeScore = 0;
  for (const pattern of codePatterns) {
    if (pattern.test(value)) codeScore++;
  }

  // If multiple code patterns match, likely code
  return codeScore >= 2;
}

/**
 * Compute the flat (single-line) length of a serialized value
 */
function computeFlatLength(value: unknown): number {
  if (value === null) return 4; // "null"
  if (typeof value === "string") return JSON.stringify(value).length;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value).length;
  if (Array.isArray(value)) {
    if (value.length === 0) return 2; // "[]"
    // [item, item, item]
    return (
      2 +
      value.reduce(
        (sum: number, item) => sum + computeFlatLength(item) + 2,
        -2
      )
    ); // -2 to remove last ", "
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return 2; // "{}"
    // {"key": value, "key": value}
    return (
      2 +
      entries.reduce(
        (sum, [k, v]) => sum + JSON.stringify(k).length + 2 + computeFlatLength(v) + 2,
        -2
      )
    ); // -2 to remove last ", "
  }
  return 7; // "unknown"
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

    // Check if should use inline format
    const flatLength = computeFlatLength(value);
    if (flatLength <= INLINE_THRESHOLD) {
      printer.write(JSON.stringify(value));
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

    // Check if should use inline format
    const flatLength = computeFlatLength(value);
    if (flatLength <= INLINE_THRESHOLD) {
      printer.write(JSON.stringify(value));
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

  // For top-level strings: try to parse as JSON, otherwise return as-is
  if (typeof value === "string") {
    if (isLikelyJson(value)) {
      try {
        const parsed = JSON.parse(value);
        // Successfully parsed JSON - serialize it
        const printer = new Printer(0);
        const ctx: LiteralSerializerContext = {
          currentDepth: 0,
          maxDepth,
          maxItems,
          printer,
        };
        serializeLiteral(parsed, ctx);
        return `**${name}**\n\n\`\`\`json\n${printer.toString()}\n\`\`\``;
      } catch {
        // Not valid JSON, fall through to return as-is
      }
    }
    // Plain string or invalid JSON
    if (isLikelyCode(value)) {
      // Code - wrap in code block to preserve formatting
      return `**${name}**\n\n\`\`\`\n${value}\n\`\`\``;
    }
    // Natural language text - display as-is
    return `**${name}**\n\n${value}`;
  }

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
