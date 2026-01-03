import { describe, it, expect } from "vitest";
import { parseDocument, LineCounter } from "yaml";
import dedent from "dedent";
import { YamlDocument } from "../src/analysis/YamlDocument.js";

describe("YamlDocument", () => {
  describe("getKeyAtPosition", () => {
    it("should detect array item at dash position", () => {
      const yaml = dedent`
        parameters:
          - name: userId
            in: path
          - name: postId
            in: path
      `;

      const lineCounter = new LineCounter();
      const ast = parseDocument(yaml, { lineCounter });
      const doc = new YamlDocument(ast, lineCounter);

      // Position at the first `-` (line 1, col 2)
      // Line 0: "parameters:"
      // Line 1: "  - name: userId"
      const result1 = doc.getKeyAtPosition({ line: 1, character: 2 });
      expect(result1).not.toBeNull();
      expect(result1?.path).toEqual(["parameters", 0]);

      // Position at the second `-` (line 3, col 2)
      const result2 = doc.getKeyAtPosition({ line: 3, character: 2 });
      expect(result2).not.toBeNull();
      expect(result2?.path).toEqual(["parameters", 1]);
    });

    it("should detect key at key position", () => {
      const yaml = dedent`
        parameters:
          - name: userId
            in: path
      `;

      const lineCounter = new LineCounter();
      const ast = parseDocument(yaml, { lineCounter });
      const doc = new YamlDocument(ast, lineCounter);

      // Position at "name" key (line 1)
      const result = doc.getKeyAtPosition({ line: 1, character: 4 });
      expect(result).not.toBeNull();
      expect(result?.key).toBe("name");
      expect(result?.path).toEqual(["parameters", 0, "name"]);
    });

    it("should detect parameters key", () => {
      const yaml = dedent`
        parameters:
          - name: userId
      `;

      const lineCounter = new LineCounter();
      const ast = parseDocument(yaml, { lineCounter });
      const doc = new YamlDocument(ast, lineCounter);

      // Position at "parameters" key (line 0)
      const result = doc.getKeyAtPosition({ line: 0, character: 0 });
      expect(result).not.toBeNull();
      expect(result?.key).toBe("parameters");
      expect(result?.path).toEqual(["parameters"]);
    });
  });
});
