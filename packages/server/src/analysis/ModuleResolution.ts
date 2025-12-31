import { Result } from "@openapi-lsp/core/result";
import { ServerDocument } from "./ServerDocument.js";

export type ModuleResolutionType = "file" | "http";

export type ModuleResolution =
  | {
      type: "file";
      uri: string;
    }
  | {
      type: "http";
      uri: string;
      cachePath: string;
    };

export type ModuleResolutionInput = {
  /**
   * The $ref to resolve, fragment ignored.
   */
  ref: string;
  /**
   * The containing file's URI
   */
  baseUri: string;
};

export type ModuleResolutionError =
  | {
      type: "invalidUri";
    }
  | {
      type: "unsupportedUriScheme";
      scheme: string;
    };

export type ModuleResolutionResult = Result<
  ServerDocument,
  ModuleResolutionError
>;
