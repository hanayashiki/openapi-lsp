import { OpenAPI } from "@openapi-lsp/core/openapi";
import type { SerializeOptions } from "./types.js";
import { Printer } from "./Printer.js";

/**
 * Serialize an OpenAPI Operation to markdown for hover display.
 * Shows only description and tags as requested.
 */
export function serializeOperationToMarkdown(
  operation: OpenAPI.Operation,
  options: SerializeOptions = {}
): string {
  const { name } = options;
  const printer = new Printer(0);

  // Header
  printer.writeParts("##", name, "(operation)");
  printer.newline();

  // Summary
  if (operation.summary) {
    printer.write("### Summary");
    printer.newline();

    printer.write(operation.summary);
    printer.newline();
  }

  // Description
  if (operation.description) {
    printer.write("### Description");
    printer.newline();

    printer.write(operation.description);
    printer.newline();
  }

  if (!operation.summary && !operation.description) {
    printer.write("(no description)");
    printer.newline();
  }

  // Tags
  if (operation.tags && operation.tags.length > 0) {
    printer.newline();
    printer.write("**Tags:** ");
    printer.write(operation.tags.map((tag) => `\`${tag}\``).join(", "));
    printer.newline();
  }

  return printer.toString();
}
