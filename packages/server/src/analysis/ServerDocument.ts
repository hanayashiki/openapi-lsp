import { YamlDocument } from "./YamlDocument.js";

export type SpecDocumentPath = (string | number)[];

export type SpecDocumentType = "openapi" | "component" | "tomb";

export type BaseSpecDocument<T extends SpecDocumentType> = {
  type: T;
  uri: string;
};

export type SpecDocument = BaseSpecDocument<"openapi"> & {
  yaml: YamlDocument;
};

/**
 * A component that is included in a `Root`,
 * directly or transitively referenced by the spec.
 * A component can be included in multiple roots.
 */
export type ComponentDocument = BaseSpecDocument<"component"> & {
  yaml: YamlDocument;
};

/**
 * A document that is unable to read
 */
export type TombDocument = BaseSpecDocument<"tomb">;

export type ServerDocument = SpecDocument | ComponentDocument | TombDocument;
