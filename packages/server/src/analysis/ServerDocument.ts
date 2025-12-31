import { Document as YamlDocument, LineCounter } from "yaml";

export type SpecDocumentPath = (string | number)[];

export type SpecDocumentType = "openapi" | "tomb";

export type BaseSpecDocument<T extends SpecDocumentType> = {
  type: T;
  uri: string;
};

export type SpecDocument = BaseSpecDocument<"openapi"> & {
  yamlAst: YamlDocument;
  lineCounter: LineCounter;
};

/**
 * A document that is deleted
 */
export type TombDocument = BaseSpecDocument<'tomb'>;

export type ServerDocument = SpecDocument | TombDocument;