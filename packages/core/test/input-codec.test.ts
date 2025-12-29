import { describe, expect, it } from "vitest";
import Type from "typebox";
import Value from "typebox/value";
import {
  FallbackString,
  FallbackOptionalString,
  FallbackOptionalNumber,
  FallbackOptionalBoolean,
  FallbackLiteralUnion,
  FallbackOptionalLiteralUnion,
  FallbackArray,
  FallbackOptionalArray,
  FallbackRecord,
  FallbackOptionalRecord,
  FallbackObject,
  FallbackOptionalObject,
} from "../src/openapi/input-codec.js";

describe("Fallback Codecs", () => {
  describe("FallbackString", () => {
    const Schema = Type.Object({
      name: FallbackString("default"),
    });

    it("should pass through valid string", () => {
      const result = Value.Encode(Schema, { name: "hello" });
      expect(result.name).toBe("hello");
    });

    it("should fallback to default for non-string value", () => {
      const result = Value.Encode(Schema, { name: 123 } as any);
      expect(result.name).toBe("default");
    });
  });

  describe("FallbackOptionalString", () => {
    const Schema = Type.Object({
      description: FallbackOptionalString(),
    });

    it("should pass through valid string", () => {
      const result = Value.Encode(Schema, { description: "hello" });
      expect(result.description).toBe("hello");
    });

    it("should return undefined for non-string value", () => {
      const result = Value.Encode(Schema, { description: 123 } as any);
      expect(result.description).toBeUndefined();
    });
  });

  describe("FallbackOptionalNumber", () => {
    const Schema = Type.Object({
      count: FallbackOptionalNumber(),
    });

    it("should pass through valid number", () => {
      const result = Value.Encode(Schema, { count: 42 });
      expect(result.count).toBe(42);
    });

    it("should return undefined for non-number value", () => {
      const result = Value.Encode(Schema, { count: "not a number" } as any);
      expect(result.count).toBeUndefined();
    });
  });

  describe("FallbackOptionalBoolean", () => {
    const Schema = Type.Object({
      enabled: FallbackOptionalBoolean(),
    });

    it("should pass through valid boolean", () => {
      const result = Value.Encode(Schema, { enabled: true });
      expect(result.enabled).toBe(true);
    });

    it("should return undefined for non-boolean value", () => {
      const result = Value.Encode(Schema, { enabled: "yes" } as any);
      expect(result.enabled).toBeUndefined();
    });
  });

  describe("FallbackLiteralUnion", () => {
    const Schema = Type.Object({
      status: FallbackLiteralUnion(["active", "inactive", "pending"] as const),
    });

    it("should pass through valid literal", () => {
      const result = Value.Encode(Schema, { status: "inactive" });
      expect(result.status).toBe("inactive");
    });

    it("should fallback to first literal for invalid value", () => {
      const result = Value.Encode(Schema, { status: "unknown" } as any);
      expect(result.status).toBe("active");
    });
  });

  describe("FallbackOptionalLiteralUnion", () => {
    const Schema = Type.Object({
      priority: FallbackOptionalLiteralUnion(["low", "medium", "high"] as const),
    });

    it("should pass through valid literal", () => {
      const result = Value.Encode(Schema, { priority: "high" });
      expect(result.priority).toBe("high");
    });

    it("should return undefined for invalid value", () => {
      const result = Value.Encode(Schema, { priority: "critical" } as any);
      expect(result.priority).toBeUndefined();
    });
  });

  describe("FallbackArray", () => {
    const Schema = Type.Object({
      tags: FallbackArray(FallbackString("")),
    });

    it("should pass through valid array", () => {
      const result = Value.Encode(Schema, { tags: ["a", "b", "c"] });
      expect(result.tags).toEqual(["a", "b", "c"]);
    });

    it("should fallback to empty array for non-array value", () => {
      const result = Value.Encode(Schema, { tags: "not an array" } as any);
      expect(result.tags).toEqual([]);
    });
  });

  describe("FallbackOptionalArray", () => {
    const Schema = Type.Object({
      items: FallbackOptionalArray(FallbackString("")),
    });

    it("should pass through valid array", () => {
      const result = Value.Encode(Schema, { items: ["x", "y"] });
      expect(result.items).toEqual(["x", "y"]);
    });

    it("should return undefined for non-array value", () => {
      const result = Value.Encode(Schema, { items: { not: "array" } } as any);
      expect(result.items).toBeUndefined();
    });
  });

  describe("FallbackRecord", () => {
    const Schema = Type.Object({
      metadata: FallbackRecord(Type.String(), FallbackString("")),
    });

    it("should pass through valid object", () => {
      const result = Value.Encode(Schema, { metadata: { key: "value" } });
      expect(result.metadata).toEqual({ key: "value" });
    });

    it("should fallback to empty object for non-object value", () => {
      const result = Value.Encode(Schema, { metadata: "not an object" } as any);
      expect(result.metadata).toEqual({});
    });
  });

  describe("FallbackOptionalRecord", () => {
    const Schema = Type.Object({
      headers: FallbackOptionalRecord(Type.String(), FallbackString("")),
    });

    it("should pass through valid object", () => {
      const result = Value.Encode(Schema, { headers: { "Content-Type": "application/json" } });
      expect(result.headers).toEqual({ "Content-Type": "application/json" });
    });

    it("should return undefined for non-object value", () => {
      const result = Value.Encode(Schema, { headers: ["not", "an", "object"] } as any);
      expect(result.headers).toBeUndefined();
    });
  });

  describe("FallbackObject", () => {
    const ComponentsSchema = FallbackObject(Type.Object({
      schemas: FallbackOptionalRecord(Type.String(), Type.Unknown()),
      responses: FallbackOptionalRecord(Type.String(), Type.Unknown()),
    }));

    it("should pass through valid object", () => {
      const result = Value.Encode(ComponentsSchema, {
        schemas: { Pet: { type: "object" } },
        responses: { NotFound: { description: "Not found" } },
      });
      expect(result.schemas).toEqual({ Pet: { type: "object" } });
      expect(result.responses).toEqual({ NotFound: { description: "Not found" } });
    });

    it("should fallback to empty object for non-object value", () => {
      const result = Value.Encode(ComponentsSchema, "not an object" as any);
      expect(result).toEqual({});
    });

    it("should fallback to empty object for null", () => {
      const result = Value.Encode(ComponentsSchema, null as any);
      expect(result).toEqual({});
    });

    it("should fallback to empty object for array", () => {
      const result = Value.Encode(ComponentsSchema, ["not", "an", "object"] as any);
      expect(result).toEqual({});
    });

    it("should handle nested fallbacks when object passed", () => {
      const result = Value.Encode(ComponentsSchema, {
        schemas: "invalid",
        responses: 123,
      } as any);
      expect(result.schemas).toBeUndefined();
      expect(result.responses).toBeUndefined();
    });

    it("should accept an existing TObject and reuse it", () => {
      // Define a schema once
      const ContactSchema = FallbackObject(Type.Object({
        name: FallbackOptionalString(),
        email: FallbackOptionalString(),
      }));

      // Reuse it as optional in another schema
      const DocumentSchema = FallbackObject(Type.Object({
        contact: FallbackOptionalObject(ContactSchema),
      }));

      // Test with valid data
      const result = Value.Encode(DocumentSchema, {
        contact: { name: "John", email: "john@example.com" },
      });
      expect(result.contact).toEqual({ name: "John", email: "john@example.com" });

      // Test with invalid contact - should fallback to undefined
      const result2 = Value.Encode(DocumentSchema, {
        contact: "invalid",
      } as any);
      expect(result2.contact).toBeUndefined();
    });
  });

  describe("FallbackOptionalObject", () => {
    const ContactSchema = Type.Object({
      name: FallbackOptionalString(),
      email: FallbackOptionalString(),
    });

    const Schema = Type.Object({
      contact: FallbackOptionalObject(ContactSchema),
    });

    it("should pass through valid object", () => {
      const result = Value.Encode(Schema, {
        contact: { name: "John", email: "john@example.com" },
      });
      expect(result.contact).toEqual({ name: "John", email: "john@example.com" });
    });

    it("should return undefined for non-object value", () => {
      const result = Value.Encode(Schema, { contact: "not an object" } as any);
      expect(result.contact).toBeUndefined();
    });

    it("should return undefined for array value", () => {
      const result = Value.Encode(Schema, { contact: ["John", "john@example.com"] } as any);
      expect(result.contact).toBeUndefined();
    });
  });
});
