import { OpenAPI } from "@openapi-lsp/core/openapi";
import { parseLocalRef } from "./parseLocalRef.js";

// Public options
export interface SerializeOptions {
  maxDepth?: number; // Default: 2
}

// Internal context
interface SerializerContext {
  document: OpenAPI.Document;
  currentDepth: number;
  maxDepth: number;
  indent: number;
  visitedRefs: Set<string>;
}

// Type guard for $ref
function isReference(value: unknown): value is OpenAPI.Reference {
  return (
    typeof value === "object" &&
    value !== null &&
    "$ref" in value &&
    typeof (value as OpenAPI.Reference).$ref === "string"
  );
}

// Extract type name from $ref path
function getRefTypeName(ref: OpenAPI.Reference): string {
  const parts = ref.$ref.split("/");
  return parts[parts.length - 1];
}

// Resolve $ref to its target schema
function resolveRef(
  ref: OpenAPI.Reference,
  document: OpenAPI.Document
): OpenAPI.Schema | null {
  const path = parseLocalRef(ref.$ref);
  if (!path) return null;

  let current: unknown = document;
  for (const segment of path) {
    if (current && typeof current === "object" && segment in current) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return null;
    }
  }

  return current as OpenAPI.Schema;
}

// Serialize primitive types
function serializePrimitiveType(schema: OpenAPI.Schema): string {
  const { type, format, nullable } = schema;

  // Handle enum as string literal union
  if (schema.enum) {
    const enumType = schema.enum
      .map((v) => (typeof v === "string" ? `"${v}"` : String(v)))
      .join(" | ");
    return nullable ? `(${enumType}) | null` : enumType;
  }

  let baseType: string;

  switch (type) {
    case "string":
      baseType = format ? `string /* ${format} */` : "string";
      break;
    case "integer":
      baseType = format ? `number /* ${format} */` : "number /* integer */";
      break;
    case "number":
      baseType = format ? `number /* ${format} */` : "number";
      break;
    case "boolean":
      baseType = "boolean";
      break;
    case "null":
      return "null";
    default:
      baseType = "unknown";
  }

  return nullable ? `${baseType} | null` : baseType;
}

// Create indentation string
function indent(level: number): string {
  return "  ".repeat(level);
}

// Serialize object schema
function serializeObjectSchema(
  schema: OpenAPI.Schema,
  ctx: SerializerContext
): string {
  const properties = schema.properties;
  const required = new Set(schema.required ?? []);

  if (!properties || Object.keys(properties).length === 0) {
    // Handle additionalProperties only
    if (schema.additionalProperties) {
      if (schema.additionalProperties === true) {
        return "Record<string, unknown>";
      }
      if (typeof schema.additionalProperties === "object") {
        const valueType = serializeSchema(schema.additionalProperties, {
          ...ctx,
          currentDepth: ctx.currentDepth + 1,
        });
        return `Record<string, ${valueType}>`;
      }
    }
    return "{}";
  }

  const lines: string[] = ["{"];
  const propEntries = Object.entries(properties);

  for (const [propName, propSchema] of propEntries) {
    const isRequired = required.has(propName);
    const optional = isRequired ? "" : "?";
    const propType = serializeSchema(propSchema, {
      ...ctx,
      indent: ctx.indent + 1,
      currentDepth: ctx.currentDepth + 1,
    });
    lines.push(`${indent(ctx.indent + 1)}${propName}${optional}: ${propType};`);
  }

  // Handle additionalProperties
  if (schema.additionalProperties) {
    let valueType = "unknown";
    if (schema.additionalProperties !== true) {
      valueType = serializeSchema(schema.additionalProperties, {
        ...ctx,
        indent: ctx.indent + 1,
        currentDepth: ctx.currentDepth + 1,
      });
    }
    lines.push(`${indent(ctx.indent + 1)}[key: string]: ${valueType};`);
  }

  lines.push(`${indent(ctx.indent)}}`);
  return lines.join("\n");
}

// Serialize array schema
function serializeArraySchema(
  schema: OpenAPI.Schema,
  ctx: SerializerContext
): string {
  if (!schema.items) {
    return "unknown[]";
  }

  const itemType = serializeSchema(schema.items, {
    ...ctx,
    currentDepth: ctx.currentDepth + 1,
  });

  // Use Array<T> for complex types, T[] for simple
  if (itemType.includes(" | ") || itemType.includes(" & ") || itemType.includes("{")) {
    return `Array<${itemType}>`;
  }
  return `${itemType}[]`;
}

// Serialize composition (allOf, oneOf, anyOf)
function serializeComposition(
  schemas: (OpenAPI.Schema | OpenAPI.Reference)[],
  operator: "&" | "|",
  ctx: SerializerContext
): string {
  const serialized = schemas.map((s) =>
    serializeSchema(s, { ...ctx, currentDepth: ctx.currentDepth + 1 })
  );

  // Wrap complex types in parentheses if needed
  const parts = serialized.map((s) => {
    if ((operator === "&" && s.includes(" | ")) ||
        (operator === "|" && s.includes(" & "))) {
      return `(${s})`;
    }
    return s;
  });

  return parts.join(` ${operator} `);
}

// Main schema serializer
function serializeSchema(
  schema: OpenAPI.Schema | OpenAPI.Reference,
  ctx: SerializerContext
): string {
  // Handle $ref
  if (isReference(schema)) {
    const typeName = getRefTypeName(schema);

    // At depth limit or circular ref, just return type name
    if (ctx.currentDepth >= ctx.maxDepth || ctx.visitedRefs.has(schema.$ref)) {
      return typeName;
    }

    // Resolve and serialize
    const resolved = resolveRef(schema, ctx.document);
    if (!resolved) {
      return typeName;
    }

    // Track visited ref
    const newVisited = new Set(ctx.visitedRefs);
    newVisited.add(schema.$ref);

    return serializeSchema(resolved, {
      ...ctx,
      visitedRefs: newVisited,
    });
  }

  // Depth limit reached
  if (ctx.currentDepth > ctx.maxDepth) {
    return "...";
  }

  // Handle compositions first (they may not have type)
  if (schema.allOf && schema.allOf.length > 0) {
    return serializeComposition(schema.allOf, "&", ctx);
  }
  if (schema.oneOf && schema.oneOf.length > 0) {
    return serializeComposition(schema.oneOf, "|", ctx);
  }
  if (schema.anyOf && schema.anyOf.length > 0) {
    return serializeComposition(schema.anyOf, "|", ctx);
  }

  // Infer type from structure if not explicit
  const type = schema.type ?? (schema.properties ? "object" : schema.items ? "array" : undefined);

  switch (type) {
    case "object":
      return serializeObjectSchema(schema, ctx);
    case "array":
      return serializeArraySchema(schema, ctx);
    case "string":
    case "integer":
    case "number":
    case "boolean":
    case "null":
      return serializePrimitiveType(schema);
    default:
      // Handle enum without explicit type
      if (schema.enum) {
        return serializePrimitiveType(schema);
      }
      return "unknown";
  }
}

/**
 * Serialize an OpenAPI Schema to TypeScript-like markdown for hover display
 */
export function serializeSchemaToMarkdown(
  schema: OpenAPI.Schema | OpenAPI.Reference,
  name: string,
  document: OpenAPI.Document,
  options: SerializeOptions = {}
): string {
  const { maxDepth = 2 } = options;

  const ctx: SerializerContext = {
    document,
    currentDepth: 0,
    maxDepth,
    indent: 0,
    visitedRefs: new Set(),
  };

  const serialized = serializeSchema(schema, ctx);

  return `\`\`\`typescript\ntype ${name} = ${serialized}\n\`\`\``;
}
