import { ExtensionConfiguration } from "@openapi-lsp/core/configuration";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { z } from "zod";

// Hard-coded mapping of Zod v4 type names to VS Code configuration types
type VSCodeConfigType = "string" | "number" | "boolean" | "array" | "object";

const zodTypeNameToVSCodeType: Record<string, VSCodeConfigType> = {
  string: "string",
  number: "number",
  boolean: "boolean",
  array: "array",
  object: "object",
};

// Zod v4 internal def structure (not exported by zod)
// Access via schema._zod.def
interface ZodInternalDef {
  type: string;
  innerType?: z.ZodTypeAny;
  defaultValue?: unknown;
}

function getDef(zodType: z.ZodTypeAny): ZodInternalDef {
  return (zodType as any)._zod.def;
}

function unwrapZodType(zodType: z.ZodTypeAny): z.ZodTypeAny {
  const def = getDef(zodType);
  if (def.type === "default" || def.type === "optional") {
    return unwrapZodType(def.innerType!);
  }
  return zodType;
}

function zodTypeToVSCodeType(zodType: z.ZodTypeAny): VSCodeConfigType {
  const unwrapped = unwrapZodType(zodType);
  const typeName = getDef(unwrapped).type;
  const vsCodeType = zodTypeNameToVSCodeType[typeName];
  if (!vsCodeType) {
    throw new Error(`Unsupported Zod type: ${typeName}`);
  }
  return vsCodeType;
}

function getDefaultValue(zodType: z.ZodTypeAny): unknown {
  const def = getDef(zodType);
  if (def.type === "default") {
    return def.defaultValue;
  }
  if (def.type === "optional") {
    return getDefaultValue(def.innerType!);
  }
  return undefined;
}

function getDescription(zodType: z.ZodTypeAny): string | undefined {
  // In Zod v4, description is accessed via schema.description (from globalRegistry)
  if (zodType.description) {
    return zodType.description;
  }
  const def = getDef(zodType);
  if (def.type === "default" || def.type === "optional") {
    return getDescription(def.innerType!);
  }
  return undefined;
}

interface VSCodeConfigProperty {
  type: VSCodeConfigType;
  default?: unknown;
  description?: string;
}

function generateVSCodeConfiguration(
  schema: z.ZodObject<z.ZodRawShape>
): Record<string, VSCodeConfigProperty> {
  const properties: Record<string, VSCodeConfigProperty> = {};
  const shape = schema.shape;

  for (const [key, zodType] of Object.entries(shape)) {
    const property: VSCodeConfigProperty = {
      type: zodTypeToVSCodeType(zodType as z.ZodTypeAny),
    };

    const defaultValue = getDefaultValue(zodType as z.ZodTypeAny);
    if (defaultValue !== undefined) {
      property.default = defaultValue;
    }

    const description = getDescription(zodType as z.ZodTypeAny);
    if (description) {
      property.description = description;
    }

    properties[key] = property;
  }

  return properties;
}

function main() {
  const packageJsonPath = join(__dirname, "..", "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

  const configProperties = generateVSCodeConfiguration(ExtensionConfiguration);

  packageJson.contributes.configuration = {
    title: "OpenAPI LSP",
    properties: configProperties,
  };

  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");

  console.log("Updated package.json with configuration:");
  console.log(JSON.stringify(configProperties, null, 2));
}

main();
