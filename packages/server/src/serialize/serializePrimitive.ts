import { OpenAPI } from "@openapi-lsp/core/openapi";
import type { SerializerContext } from "./types.js";

// Serialize primitive types (string, number, integer, boolean, null)
export function serializePrimitive(
  schema: OpenAPI.Schema,
  ctx: SerializerContext
): void {
  const { type, format, nullable } = schema;
  const { printer } = ctx;

  // Handle enum as string literal union
  if (schema.enum) {
    const enumType = schema.enum
      .map((v) => (typeof v === "string" ? `"${v}"` : String(v)))
      .join(" | ");
    printer.write(nullable ? `(${enumType}) | null` : enumType);
    return;
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
      printer.write("null");
      return;
    default:
      baseType = "unknown";
  }

  printer.write(nullable ? `${baseType} | null` : baseType);
}
