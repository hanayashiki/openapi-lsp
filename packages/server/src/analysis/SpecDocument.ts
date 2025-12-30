import { Document as YamlDocument, LineCounter } from "yaml";

export type SpecDocumentType = "openapi";

export type BaseSpecDocument<T extends SpecDocumentType> = {
  type: T;
  uri: string;
};

export type SpecDocument = BaseSpecDocument<"openapi"> & {
  yamlAst: YamlDocument;
  lineCounter: LineCounter;
};

export type SpecDocumentPath = (string | number)[];
