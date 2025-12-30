import { OpenAPI } from "@openapi-lsp/core/openapi";

// Serialize primitive types (string, number, integer, boolean, null)
export function serializePrimitive(schema: OpenAPI.Schema): string {
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
