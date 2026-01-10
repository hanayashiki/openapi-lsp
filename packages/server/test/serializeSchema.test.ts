import { describe, it, expect } from "vitest";
import dedent from "dedent";
import { serializeSchemaToMarkdown } from "../src/serialize/serializeSchemaToMarkdown.js";
import type { OpenAPI } from "@openapi-lsp/core/openapi";

describe("serializeSchema", () => {
  it("should properly indent array with inline object items", () => {
    const schema: OpenAPI.Schema = {
      type: "array",
      items: {
        type: "object",
        properties: {
          a: { type: "number" },
          b: { type: "number" },
        },
      },
    };

    const result = serializeSchemaToMarkdown(schema);

    expect(result).toContain(
      dedent`
      Array<{
          a?: number;
          b?: number;
      }>`
    );
  });

  it("should properly indent object with array field containing inline object items", () => {
    const schema: OpenAPI.Schema = {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              a: { type: "number" },
              b: { type: "number" },
            },
          },
        },
      },
    };

    const result = serializeSchemaToMarkdown(schema, { maxDepth: 3 });

    // The array item properties should be indented under Array<{
    // and the closing }> should align with Array<
    expect(result).toContain(
      dedent`
      {
          items?: Array<{
              a?: number;
              b?: number;
          }>;
      }`
    );
  });

  it("should limit oneOf to at most 3 items", () => {
    const schema: OpenAPI.Schema = {
      oneOf: [
        { type: "string" },
        { type: "number" },
        { type: "boolean" },
        { type: "integer" },
        { type: "null" },
      ],
    };

    const result = serializeSchemaToMarkdown(schema);

    expect(result).toContain("string | number | boolean | /* ... (2 more) */");
  });

  it("should limit anyOf to at most 3 items", () => {
    const schema: OpenAPI.Schema = {
      anyOf: [
        { type: "string" },
        { type: "number" },
        { type: "boolean" },
        { type: "integer" },
      ],
    };

    const result = serializeSchemaToMarkdown(schema);

    expect(result).toContain("string | number | boolean | /* ... (1 more) */");
  });

  it("should limit allOf to at most 3 items", () => {
    const schema: OpenAPI.Schema = {
      allOf: [
        { type: "object", properties: { a: { type: "string" } } },
        { type: "object", properties: { b: { type: "string" } } },
        { type: "object", properties: { c: { type: "string" } } },
        { type: "object", properties: { d: { type: "string" } } },
      ],
    };

    const result = serializeSchemaToMarkdown(schema, { maxDepth: 3 });

    expect(result).toContain("& /* ... (1 more) */");
  });

  it("should show all items when 3 or fewer", () => {
    const schema: OpenAPI.Schema = {
      oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
    };

    const result = serializeSchemaToMarkdown(schema);

    expect(result).toContain("string | number | boolean");
    expect(result).not.toContain("/* ... ");
  });
});
