/**
 * Shared types and utilities for OpenAPI LSP
 * Based on OpenAPI Specification v3.0.3
 * https://spec.openapis.org/oas/v3.0.3.html
 *
 * Zod v4 implementation
 */

import { z } from "zod";
import { setOpenAPITag, TaggedObject } from "./tag.js";

// ------------------------------------------------------------------------------
// OpenAPI Namespace
//
// Strict types matching OpenAPI 3.0.3 specification
// Uses z.lazy() only for Schema (the only truly recursive type)
// All other types use direct references
// ------------------------------------------------------------------------------
export namespace OpenAPI {
  // ===========================================================================
  // Layer 1: Leaf types (no dependencies)
  // ===========================================================================

  // Reference Object - used at use sites for referenceable types
  export const Reference = TaggedObject(
    {
      $ref: z.string(),
    },
    "Reference"
  );

  // XML Object
  export const XML = TaggedObject(
    {
      name: z.string().optional(),
      namespace: z.string().optional(),
      prefix: z.string().optional(),
      attribute: z.boolean().optional(),
      wrapped: z.boolean().optional(),
    },
    "XML"
  );

  // Discriminator Object
  export const Discriminator = TaggedObject(
    {
      propertyName: z.string(),
      mapping: z.record(z.string(), z.string()).optional(),
    },
    "Discriminator"
  );

  // Contact Object
  export const Contact = TaggedObject(
    {
      name: z.string().optional(),
      url: z.string().optional(),
      email: z.string().optional(),
    },
    "Contact"
  );

  // License Object
  export const License = TaggedObject(
    {
      name: z.string(),
      url: z.string().optional(),
    },
    "License"
  );

  // Server Variable Object
  export const ServerVariable = TaggedObject(
    {
      enum: z.array(z.string()).optional(),
      default: z.string(),
      description: z.string().optional(),
    },
    "ServerVariable"
  );

  // OAuth Flow Object
  export const OAuthFlow = TaggedObject(
    {
      authorizationUrl: z.string().optional(),
      tokenUrl: z.string().optional(),
      refreshUrl: z.string().optional(),
      scopes: z.record(z.string(), z.string()),
    },
    "OAuthFlow"
  );

  // Example Object
  export const Example = TaggedObject(
    {
      summary: z.string().optional(),
      description: z.string().optional(),
      value: z.unknown().optional(),
      externalValue: z.string().optional(),
    },
    "Example"
  );

  // Security Requirement Object
  export const SecurityRequirement = z.record(z.string(), z.array(z.string()));

  // ===========================================================================
  // Layer 2: Simple composed types
  // ===========================================================================

  // External Documentation Object
  export const ExternalDocumentation = TaggedObject(
    {
      description: z.string().optional(),
      url: z.string(),
    },
    "ExternalDocumentation"
  );

  // OAuth Flows Object
  export const OAuthFlows = TaggedObject(
    {
      implicit: OAuthFlow.optional(),
      password: OAuthFlow.optional(),
      clientCredentials: OAuthFlow.optional(),
      authorizationCode: OAuthFlow.optional(),
    },
    "OAuthFlows"
  );

  // Server Object
  export const Server = TaggedObject(
    {
      url: z.string(),
      description: z.string().optional(),
      variables: z.record(z.string(), ServerVariable).optional(),
    },
    "Server"
  );

  // ===========================================================================
  // Layer 3: Schema (recursive - uses z.lazy)
  // ===========================================================================

  // Define the Schema type for self-reference
  type SchemaType = {
    // JSON Schema properties
    title?: string;
    multipleOf?: number;
    maximum?: number;
    exclusiveMaximum?: boolean;
    minimum?: number;
    exclusiveMinimum?: boolean;
    maxLength?: number;
    minLength?: number;
    pattern?: string;
    maxItems?: number;
    minItems?: number;
    uniqueItems?: boolean;
    maxProperties?: number;
    minProperties?: number;
    required?: string[];
    enum?: unknown[];

    // Modified JSON Schema properties
    type?: string;
    allOf?: (SchemaType | Reference)[];
    oneOf?: (SchemaType | Reference)[];
    anyOf?: (SchemaType | Reference)[];
    not?: SchemaType | Reference;
    items?: SchemaType | Reference;
    properties?: Record<string, SchemaType | Reference>;
    additionalProperties?: boolean | SchemaType | Reference;
    description?: string;
    format?: string;
    default?: unknown;

    // OpenAPI-specific properties
    nullable?: boolean;
    discriminator?: Discriminator;
    readOnly?: boolean;
    writeOnly?: boolean;
    xml?: XML;
    externalDocs?: ExternalDocumentation;
    example?: unknown;
    deprecated?: boolean;
  };

  // Helper to create "Schema | Reference" union for use inside Schema
  const SchemaOrRef: z.ZodType<SchemaType | Reference> = z.lazy(() =>
    z.union([Reference, Schema])
  );

  export const Schema: z.ZodType<SchemaType> = z.lazy(() =>
    z
      .object({
        // JSON Schema properties
        title: z.string().optional(),
        multipleOf: z.number().optional(),
        maximum: z.number().optional(),
        exclusiveMaximum: z.boolean().optional(),
        minimum: z.number().optional(),
        exclusiveMinimum: z.boolean().optional(),
        maxLength: z.number().int().optional(),
        minLength: z.number().int().optional(),
        pattern: z.string().optional(),
        maxItems: z.number().int().optional(),
        minItems: z.number().int().optional(),
        uniqueItems: z.boolean().optional(),
        maxProperties: z.number().int().optional(),
        minProperties: z.number().int().optional(),
        required: z.array(z.string()).optional(),
        enum: z.array(z.unknown()).optional(),

        // Modified JSON Schema properties - use SchemaOrRef for schema references
        type: z.string().optional(),
        allOf: z.array(SchemaOrRef).optional(),
        oneOf: z.array(SchemaOrRef).optional(),
        anyOf: z.array(SchemaOrRef).optional(),
        not: SchemaOrRef.optional(),
        items: SchemaOrRef.optional(),
        properties: z.record(z.string(), SchemaOrRef).optional(),
        additionalProperties: z.union([z.boolean(), SchemaOrRef]).optional(),
        description: z.string().optional(),
        format: z.string().optional(),
        default: z.unknown().optional(),

        // OpenAPI-specific properties
        nullable: z.boolean().optional(),
        discriminator: Discriminator.optional(),
        readOnly: z.boolean().optional(),
        writeOnly: z.boolean().optional(),
        xml: XML.optional(),
        externalDocs: ExternalDocumentation.optional(),
        example: z.unknown().optional(),
        deprecated: z.boolean().optional(),
      })
      .transform((value) => {
        setOpenAPITag(value, "Schema");
        return value;
      })
  );

  // ===========================================================================
  // Layer 4: Schema-dependent types
  // ===========================================================================

  // Helper to create "Schema | Reference" union for use outside Schema
  const SchemaOrReference = z.union([Reference, Schema]);
  const ExampleOrReference = z.union([Reference, Example]);

  // Encoding Object
  export const Encoding = TaggedObject(
    {
      contentType: z.string().optional(),
      // Note: headers will be defined with HeaderOrR/eference after Header is defined
      headers: z
        .record(z.string(), z.union([Reference, z.unknown()]))
        .optional(),
      style: z.string().optional(),
      explode: z.boolean().optional(),
      allowReserved: z.boolean().optional(),
    },
    "Encoding"
  );

  // MediaType Object
  export const MediaType = TaggedObject(
    {
      schema: SchemaOrReference.optional(),
      example: z.unknown().optional(),
      examples: z.record(z.string(), ExampleOrReference).optional(),
      encoding: z.record(z.string(), Encoding).optional(),
    },
    "MediaType"
  );

  // Header Object
  export const Header = TaggedObject(
    {
      description: z.string().optional(),
      required: z.boolean().optional(),
      deprecated: z.boolean().optional(),
      allowEmptyValue: z.boolean().optional(),
      style: z.string().optional(),
      explode: z.boolean().optional(),
      allowReserved: z.boolean().optional(),
      schema: SchemaOrReference.optional(),
      example: z.unknown().optional(),
      examples: z.record(z.string(), ExampleOrReference).optional(),
      content: z.record(z.string(), MediaType).optional(),
    },
    "Header"
  );

  const HeaderOrReference = z.union([Reference, Header]);

  // Link Object
  export const Link = TaggedObject(
    {
      operationRef: z.string().optional(),
      operationId: z.string().optional(),
      parameters: z.record(z.string(), z.unknown()).optional(),
      requestBody: z.unknown().optional(),
      description: z.string().optional(),
      server: Server.optional(),
    },
    "Link"
  );

  const LinkOrReference = z.union([Reference, Link]);

  // Response Object
  export const Response = TaggedObject(
    {
      description: z.string(),
      headers: z.record(z.string(), HeaderOrReference).optional(),
      content: z.record(z.string(), MediaType).optional(),
      links: z.record(z.string(), LinkOrReference).optional(),
    },
    "Response"
  );

  const ResponseOrReference = z.union([Reference, Response]);

  // Parameter Object
  export const Parameter = TaggedObject(
    {
      name: z.string(),
      in: z.union([
        z.literal("query"),
        z.literal("header"),
        z.literal("path"),
        z.literal("cookie"),
      ]),
      description: z.string().optional(),
      required: z.boolean().optional(),
      deprecated: z.boolean().optional(),
      allowEmptyValue: z.boolean().optional(),
      style: z.string().optional(),
      explode: z.boolean().optional(),
      allowReserved: z.boolean().optional(),
      schema: SchemaOrReference.optional(),
      example: z.unknown().optional(),
      examples: z.record(z.string(), ExampleOrReference).optional(),
      content: z.record(z.string(), MediaType).optional(),
    },
    "Parameter"
  );

  const ParameterOrReference = z.union([Reference, Parameter]);

  // Request Body Object
  export const RequestBody = TaggedObject(
    {
      description: z.string().optional(),
      content: z.record(z.string(), MediaType),
      required: z.boolean().optional(),
    },
    "RequestBody"
  );

  const RequestBodyOrReference = z.union([Reference, RequestBody]);

  // Security Scheme Object
  export const SecurityScheme = TaggedObject(
    {
      type: z.union([
        z.literal("apiKey"),
        z.literal("http"),
        z.literal("oauth2"),
        z.literal("openIdConnect"),
      ]),
      description: z.string().optional(),
      name: z.string().optional(),
      in: z
        .union([z.literal("query"), z.literal("header"), z.literal("cookie")])
        .optional(),
      scheme: z.string().optional(),
      bearerFormat: z.string().optional(),
      flows: OAuthFlows.optional(),
      openIdConnectUrl: z.string().optional(),
    },
    "SecurityScheme"
  );

  const SecuritySchemeOrReference = z.union([Reference, SecurityScheme]);

  // ===========================================================================
  // Layer 5: Operation-level types
  // ===========================================================================

  // Operation Object
  export const Operation = TaggedObject(
    {
      tags: z.array(z.string()).optional(),
      summary: z.string().optional(),
      description: z.string().optional(),
      externalDocs: ExternalDocumentation.optional(),
      operationId: z.string().optional(),
      parameters: z.array(ParameterOrReference).optional(),
      requestBody: RequestBodyOrReference.optional(),
      responses: z.record(z.string(), ResponseOrReference),
      // callbacks defined below after PathItem
      callbacks: z.record(z.string(), z.unknown()).optional(),
      deprecated: z.boolean().optional(),
      security: z.array(SecurityRequirement).optional(),
      servers: z.array(Server).optional(),
    },
    "Operation"
  );

  // Path Item Object
  export const PathItem = TaggedObject(
    {
      summary: z.string().optional(),
      description: z.string().optional(),
      get: Operation.optional(),
      put: Operation.optional(),
      post: Operation.optional(),
      delete: Operation.optional(),
      options: Operation.optional(),
      head: Operation.optional(),
      patch: Operation.optional(),
      trace: Operation.optional(),
      servers: z.array(Server).optional(),
      parameters: z.array(ParameterOrReference).optional(),
    },
    "PathItem"
  );

  const PathItemOrReference = z.union([Reference, PathItem]);

  // Callback Object
  export const Callback = z.record(z.string(), PathItemOrReference);

  const CallbackOrReference = z.union([Reference, Callback]);

  // ===========================================================================
  // Layer 6: Components
  // ===========================================================================

  // Components Object
  export const Components = TaggedObject(
    {
      schemas: z.record(z.string(), SchemaOrReference).optional(),
      responses: z.record(z.string(), ResponseOrReference).optional(),
      parameters: z.record(z.string(), ParameterOrReference).optional(),
      examples: z.record(z.string(), ExampleOrReference).optional(),
      requestBodies: z.record(z.string(), RequestBodyOrReference).optional(),
      headers: z.record(z.string(), HeaderOrReference).optional(),
      securitySchemes: z
        .record(z.string(), SecuritySchemeOrReference)
        .optional(),
      links: z.record(z.string(), LinkOrReference).optional(),
      callbacks: z.record(z.string(), CallbackOrReference).optional(),
    },
    "Components"
  );

  // ===========================================================================
  // Layer 7: Top-level types
  // ===========================================================================

  // Tag Object
  export const Tag = TaggedObject(
    {
      name: z.string(),
      description: z.string().optional(),
      externalDocs: ExternalDocumentation.optional(),
    },
    "Tag"
  );

  // Info Object
  export const Info = TaggedObject(
    {
      title: z.string(),
      description: z.string().optional(),
      termsOfService: z.string().optional(),
      contact: Contact.optional(),
      license: License.optional(),
      version: z.string(),
    },
    "Info"
  );

  // OpenAPI Document Object
  export const Document = TaggedObject(
    {
      openapi: z.string(),
      info: Info,
      servers: z.array(Server).optional(),
      paths: z.record(z.string(), PathItemOrReference).optional(),
      components: Components.optional(),
      security: z.array(SecurityRequirement).optional(),
      tags: z.array(Tag).optional(),
      externalDocs: ExternalDocumentation.optional(),
    },
    "Document"
  );

  // ===========================================================================
  // Type exports
  // ===========================================================================
  export type Reference = z.infer<typeof Reference>;
  export type ExternalDocumentation = z.infer<typeof ExternalDocumentation>;
  export type XML = z.infer<typeof XML>;
  export type Discriminator = z.infer<typeof Discriminator>;
  export type Schema = z.infer<typeof Schema>;
  export type MediaType = z.infer<typeof MediaType>;
  export type Example = z.infer<typeof Example>;
  export type Encoding = z.infer<typeof Encoding>;
  export type Header = z.infer<typeof Header>;
  export type Link = z.infer<typeof Link>;
  export type Server = z.infer<typeof Server>;
  export type ServerVariable = z.infer<typeof ServerVariable>;
  export type Response = z.infer<typeof Response>;
  export type Parameter = z.infer<typeof Parameter>;
  export type RequestBody = z.infer<typeof RequestBody>;
  export type Callback = z.infer<typeof Callback>;
  export type SecurityRequirement = z.infer<typeof SecurityRequirement>;
  export type Operation = z.infer<typeof Operation>;
  export type PathItem = z.infer<typeof PathItem>;
  export type SecurityScheme = z.infer<typeof SecurityScheme>;
  export type OAuthFlows = z.infer<typeof OAuthFlows>;
  export type OAuthFlow = z.infer<typeof OAuthFlow>;
  export type Components = z.infer<typeof Components>;
  export type Tag = z.infer<typeof Tag>;
  export type Contact = z.infer<typeof Contact>;
  export type License = z.infer<typeof License>;
  export type Info = z.infer<typeof Info>;
  export type Document = z.infer<typeof Document>;
}

export type JSONPointerZod = string & { __jsonPointer?: true };
