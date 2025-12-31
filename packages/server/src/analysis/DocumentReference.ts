import { ModuleResolutionResult } from "./ModuleResolution.js";
import { Range } from "vscode-languageserver";

export type DocumentRef = {
  ref: string;
  keyRange: Range;
  pointerRange: Range;
  resolved: ModuleResolutionResult;
};

export type DocumentReferences = {
  uri: string;
  references: DocumentRef[];
};
