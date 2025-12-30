import { OpenAPI } from "@openapi-lsp/core/openapi";
import type { SerializerContext } from "./types.js";
import { indent } from "./utils.js";
import { serializeSchemaOrRef } from "./serializeSchema.js";

// Serialize object schema
export function serializeObject(
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
        const valueType = serializeSchemaOrRef(schema.additionalProperties, {
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
    const propType = serializeSchemaOrRef(propSchema, {
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
      valueType = serializeSchemaOrRef(schema.additionalProperties, {
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
