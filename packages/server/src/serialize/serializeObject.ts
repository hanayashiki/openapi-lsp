import { OpenAPI } from "@openapi-lsp/core/openapi";
import type { SerializerContext } from "./types.js";
// oxlint-disable-next-line no-cycle
import { serializeSchemaOrRef } from "./serializeSchema.js";
import { formatPropertyName } from "./utils.js";

// Serialize object schema (uses 4-space indent for TypeScript)
export function serializeObject(
  schema: OpenAPI.Schema,
  ctx: SerializerContext
): void {
  const { printer } = ctx;
  const properties = schema.properties;
  const required = new Set(schema.required ?? []);

  if (!properties || Object.keys(properties).length === 0) {
    // Handle additionalProperties only
    if (schema.additionalProperties) {
      if (schema.additionalProperties === true) {
        printer.write("Record<string, unknown>");
        return;
      }
      if (typeof schema.additionalProperties === "object") {
        printer.write("Record<string, ");
        serializeSchemaOrRef(schema.additionalProperties, {
          ...ctx,
          currentDepth: ctx.currentDepth + 1,
        });
        printer.write(">");
        return;
      }
    }
    printer.write("{}");
    return;
  }

  printer.write("{");
  printer.pushIndentation(4);

  const propEntries = Object.entries(properties);

  for (const [propName, propSchema] of propEntries) {
    const isRequired = required.has(propName);
    const optional = isRequired ? "" : "?";
    printer.newline().write(`${formatPropertyName(propName)}${optional}: `);
    serializeSchemaOrRef(propSchema, {
      ...ctx,
      currentDepth: ctx.currentDepth + 1,
    });
    printer.write(";");
  }

  // Handle additionalProperties
  if (schema.additionalProperties) {
    printer.newline().write("[key: string]: ");
    if (schema.additionalProperties === true) {
      printer.write("unknown");
    } else {
      serializeSchemaOrRef(schema.additionalProperties, {
        ...ctx,
        currentDepth: ctx.currentDepth + 1,
      });
    }
    printer.write(";");
  }

  printer.popIndentation();
  printer.newline().write("}");
}
