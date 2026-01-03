import { OpenAPI } from "@openapi-lsp/core/openapi";
import type { SerializeOptions } from "./types.js";
import { Printer } from "./Printer.js";

const HTTP_METHODS = [
  "get",
  "post",
  "put",
  "delete",
  "patch",
  "options",
  "head",
  "trace",
] as const;

/**
 * Serialize an OpenAPI PathItem to markdown for hover display.
 * Shows the path description and each operation with its summary/description.
 */
export function serializePathItemToMarkdown(
  pathItem: OpenAPI.PathItem,
  options: SerializeOptions = {}
): string {
  const { name } = options;
  const printer = new Printer(0);

  // Header
  printer.writeParts("##", `\`${name}\``, "(path)");
  printer.newline();

  // PathItem summary/description
  if (pathItem.summary) {
    printer.write(pathItem.summary);
    printer.newline();
  }

  if (pathItem.description) {
    printer.write(pathItem.description);
    printer.newline();
  }

  if (!pathItem.summary && !pathItem.description) {
    printer.write("(no description)");
    printer.newline();
  }

  // Operations
  for (const method of HTTP_METHODS) {
    const operation = pathItem[method];
    if (!operation) continue;

    printer.newline();
    printer.write(`### ${method.toUpperCase()}`);
    printer.newline();

    if (operation.summary) {
      printer.write(operation.summary);
      printer.newline();
    }

    if (operation.description) {
      printer.write(operation.description);
      printer.newline();
    }

    if (!operation.summary && !operation.description) {
      printer.write("(no operation description)");
      printer.newline();
    }

    if (operation.tags && operation.tags.length > 0) {
      printer.write("**Tags:** ");
      printer.write(operation.tags.map((tag) => `\`${tag}\``).join(", "));
      printer.newline();
    }
  }

  return printer.toString();
}
