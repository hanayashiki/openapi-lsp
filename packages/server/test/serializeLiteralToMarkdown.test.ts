import { describe, it, expect } from "vitest";
import { serializeLiteralToMarkdown } from "../src/serialize/serializeLiteralToMarkdown.js";

describe("serializeLiteralToMarkdown", () => {
  describe("JSON string detection", () => {
    it("should format a small JSON object string inline", () => {
      const jsonString = '{"object": "list", "data": [1, 2, 3]}';
      const result = serializeLiteralToMarkdown(jsonString, "response");
      expect(result).toMatchInlineSnapshot(`
        "**response**

        \`\`\`json
        {"object":"list","data":[1,2,3]}
        \`\`\`"
      `);
    });

    it("should format a large JSON object string with indentation", () => {
      const jsonString =
        '{"object": "list", "data": [1, 2, 3], "hasMore": false, "total": 100}';
      const result = serializeLiteralToMarkdown(jsonString, "response");
      expect(result).toMatchInlineSnapshot(`
        "**response**

        \`\`\`json
        {
           "object": "list",
           "data": [1,2,3],
           "hasMore": false,
           "total": 100,
        }
        \`\`\`"
      `);
    });

    it("should return plain text strings without code block", () => {
      const plainString = "Hello world";
      const result = serializeLiteralToMarkdown(plainString, "message");
      expect(result).toMatchInlineSnapshot(`
        "**message**

        Hello world"
      `);
    });

    it("should wrap code-like strings in a code block", () => {
      const codeString = `curl https://api.example.com/v1/chat
  -H "Authorization: Bearer $API_KEY"`;
      const result = serializeLiteralToMarkdown(codeString, "curl");
      expect(result).toMatchInlineSnapshot(`
        "**curl**

        \`\`\`
        curl https://api.example.com/v1/chat
          -H "Authorization: Bearer $API_KEY"
        \`\`\`"
      `);
    });

    it("should return invalid JSON strings without code block", () => {
      const invalidJson = '{"broken": }';
      const result = serializeLiteralToMarkdown(invalidJson, "data");
      expect(result).toMatchInlineSnapshot(`
        "**data**

        {"broken": }"
      `);
    });

    it("should NOT expand nested JSON strings inside objects", () => {
      const obj = { response: '{"nested": true}' };
      const result = serializeLiteralToMarkdown(obj, "data");
      expect(result).toMatchInlineSnapshot(`
        "**data**

        \`\`\`json
        {"response":"{\\"nested\\": true}"}
        \`\`\`"
      `);
    });
  });
});
