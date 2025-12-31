import { Result } from "@openapi-lsp/core/result";

export type ModuleResolutionType = "file" | "http";

export type ModuleResolution =
  | {
      type: "file";
      path: string;
    }
  | {
      type: "http";
      url: string;
      cachePath: string;
    };

export type ModuleResolutionInput = {
  ref: string;
};

export type ModuleResolutionError =
  | {
      type: "notFound";
    }
  | {
      type: "invalidUri";
    };

export type ModuleResolutionResult = Result<
  ModuleResolution,
  ModuleResolutionError
>;
