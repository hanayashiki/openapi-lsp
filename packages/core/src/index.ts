/**
 * Shared types and utilities for OpenAPI LSP
 */

export interface OpenAPIDocument {
  openapi: string;
  info: OpenAPIInfo;
  paths?: Record<string, PathItem>;
  components?: Components;
}

export interface OpenAPIInfo {
  title: string;
  version: string;
  description?: string;
  license?: {
    name: string;
    url?: string;
  };
}

export interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  delete?: Operation;
  patch?: Operation;
  options?: Operation;
  head?: Operation;
  trace?: Operation;
}

export interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses?: Record<string, Response>;
}

export interface Parameter {
  name: string;
  in: "query" | "header" | "path" | "cookie";
  required?: boolean;
  schema?: Schema;
  description?: string;
}

export interface RequestBody {
  description?: string;
  required?: boolean;
  content?: Record<string, MediaType>;
}

export interface Response {
  description: string;
  content?: Record<string, MediaType>;
}

export interface MediaType {
  schema?: Schema;
}

export interface Schema {
  type?: string;
  format?: string;
  $ref?: string;
  items?: Schema;
  properties?: Record<string, Schema>;
  required?: string[];
}

export interface Components {
  schemas?: Record<string, Schema>;
  responses?: Record<string, Response>;
  parameters?: Record<string, Parameter>;
  requestBodies?: Record<string, RequestBody>;
}
