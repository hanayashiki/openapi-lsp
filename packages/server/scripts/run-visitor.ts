import { getOpenAPITag, OpenAPI } from "@openapi-lsp/core/openapi";
import Type from "typebox";
import { Compile } from "typebox/compile";
import { Value } from "typebox/value";

const testData = {
  MyRequestBody: { description: "test", content: {}, required: true },
};

const RecordSchema = Type.Record(
  Type.String(),
  Type.Union([OpenAPI.RequestBody, OpenAPI.Reference])
);

// Test 1: Compiled decoder
const CompiledRecord = Compile(RecordSchema);
const compiledDecoded = CompiledRecord.Decode(testData);
console.log("compiled record decode tag:", getOpenAPITag(compiledDecoded.MyRequestBody));

// Test 2: Value.Decode (non-compiled)
const valueDecoded = Value.Decode(RecordSchema, testData);
console.log("value record decode tag:", getOpenAPITag(valueDecoded.MyRequestBody));
