import type { Printer } from "./Printer.js";

// Public options for serialization
export interface SerializeOptions {
  name?: string | null;
  maxDepth?: number; // Default: 2
}

// Internal context for recursive serialization
export interface SerializerContext {
  currentDepth: number;
  maxDepth: number;
  printer: Printer;
}
