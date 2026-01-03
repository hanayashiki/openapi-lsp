/**
 * Lenient input types matching OpenAPI 3.0.3 specification
 * Uses Zod .catch() for fallback defaults on invalid input
 */

import { z } from "zod";
import {
  TaggedArray,
  TaggedRecord,
  TaggedObjectCatch,
  TaggedObject,
  TaggedReference,
} from "./tag.js";

// ------------------------------------------------------------------------------
// OpenAPI Namespace
//
// Lenient types matching OpenAPI 3.0.3 specification
// Uses z.lazy() only for Schema (the only truly recursive type)
// All other types use direct references
// Uses .catch() for lenient parsing with fallback defaults
// ------------------------------------------------------------------------------
export namespace OpenAPIInput {
  // ===========================================================================
  // Layer 1: Leaf types (no dependencies)
  // ===========================================================================

  // Reference Object - base reference without nominal tagging
  export const Reference = z
    .object({
      $ref: z.string().catch(""),
    })
    .catch({ $ref: "" });

  // XML Object
  export const XML = TaggedObjectCatch(
    {
      name: z.string().optional().catch(undefined),
      namespace: z.string().optional().catch(undefined),
      prefix: z.string().optional().catch(undefined),
      attribute: z.boolean().optional().catch(undefined),
      wrapped: z.boolean().optional().catch(undefined),
    },
    "XML",
    {}
  );

  // Discriminator Object
  export const Discriminator = TaggedObjectCatch(
    {
      propertyName: z.string().catch(""),
      mapping: z
        .record(z.string(), z.string().catch(""))
        .optional()
        .catch(undefined),
    },
    "Discriminator",
    { propertyName: "" }
  );

  // Contact Object
  export const Contact = TaggedObjectCatch(
    {
      name: z.string().optional().catch(undefined),
      url: z.string().optional().catch(undefined),
      email: z.string().optional().catch(undefined),
    },
    "Contact",
    {}
  );

  // License Object
  export const License = TaggedObjectCatch(
    {
      name: z.string().catch(""),
      url: z.string().optional().catch(undefined),
    },
    "License",
    { name: "" }
  );

  // Server Variable Object
  export const ServerVariable = TaggedObjectCatch(
    {
      enum: z.array(z.string().catch("")).optional().catch(undefined),
      default: z.string().catch(""),
      description: z.string().optional().catch(undefined),
    },
    "ServerVariable",
    { default: "" }
  );

  // OAuth Flow Object
  export const OAuthFlow = TaggedObjectCatch(
    {
      authorizationUrl: z.string().optional().catch(undefined),
      tokenUrl: z.string().optional().catch(undefined),
      refreshUrl: z.string().optional().catch(undefined),
      scopes: z.record(z.string(), z.string().catch("")).catch({}),
    },
    "OAuthFlow",
    { scopes: {} }
  );

  // Example Object
  export const Example = TaggedObjectCatch(
    {
      summary: z.string().optional().catch(undefined),
      description: z.string().optional().catch(undefined),
      value: z.unknown().optional(),
      externalValue: z.string().optional().catch(undefined),
    },
    "Example",
    {}
  );

  // Security Requirement Object
  export const SecurityRequirement = z
    .record(z.string(), z.array(z.string().catch("")).catch([]))
    .catch({});

  // ===========================================================================
  // Layer 2: Simple composed types
  // ===========================================================================

  // External Documentation Object
  export const ExternalDocumentation = TaggedObjectCatch(
    {
      description: z.string().optional().catch(undefined),
      url: z.string().catch(""),
    },
    "ExternalDocumentation",
    { url: "" }
  );

  // OAuth Flows Object
  export const OAuthFlows = TaggedObjectCatch(
    {
      implicit: OAuthFlow.optional().catch(undefined),
      password: OAuthFlow.optional().catch(undefined),
      clientCredentials: OAuthFlow.optional().catch(undefined),
      authorizationCode: OAuthFlow.optional().catch(undefined),
    },
    "OAuthFlows",
    {}
  );

  // Server Object
  export const Server = TaggedObjectCatch(
    {
      url: z.string().catch(""),
      description: z.string().optional().catch(undefined),
      variables: z
        .record(z.string(), ServerVariable)
        .optional()
        .catch(undefined),
    },
    "Server",
    { url: "" }
  );

  // ===========================================================================
  // Layer 3: Schema (recursive - uses z.lazy)
  // ===========================================================================

  // Define the Schema type for self-reference
  type SchemaType = {
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
    nullable?: boolean;
    discriminator?: z.infer<typeof Discriminator>;
    readOnly?: boolean;
    writeOnly?: boolean;
    xml?: z.infer<typeof XML>;
    externalDocs?: z.infer<typeof ExternalDocumentation>;
    example?: unknown;
    deprecated?: boolean;
  };

  // Helper to create "Reference | Schema" union for use inside Schema
  // Uses TaggedReference to propagate the "Schema" nominal to ref targets
  const SchemaOrRef: z.ZodType<SchemaType | Reference> = z.lazy(() =>
    z.union([TaggedReference("Schema"), Schema])
  );

  export const Schema: z.ZodType<SchemaType> = z.lazy(() =>
    TaggedObject(
      {
        // JSON Schema properties
        title: z.string().optional().catch(undefined),
        multipleOf: z.number().optional().catch(undefined),
        maximum: z.number().optional().catch(undefined),
        exclusiveMaximum: z.boolean().optional().catch(undefined),
        minimum: z.number().optional().catch(undefined),
        exclusiveMinimum: z.boolean().optional().catch(undefined),
        maxLength: z.number().int().optional().catch(undefined),
        minLength: z.number().int().optional().catch(undefined),
        pattern: z.string().optional().catch(undefined),
        maxItems: z.number().int().optional().catch(undefined),
        minItems: z.number().int().optional().catch(undefined),
        uniqueItems: z.boolean().optional().catch(undefined),
        maxProperties: z.number().int().optional().catch(undefined),
        minProperties: z.number().int().optional().catch(undefined),
        required: z.array(z.string().catch("")).optional().catch(undefined),
        enum: z.array(z.unknown()).optional(),

        // Modified JSON Schema properties
        type: z.string().optional().catch(undefined),
        allOf: z.array(SchemaOrRef).optional().catch(undefined),
        oneOf: z.array(SchemaOrRef).optional().catch(undefined),
        anyOf: z.array(SchemaOrRef).optional().catch(undefined),
        not: SchemaOrRef.optional().catch(undefined),
        items: SchemaOrRef.optional().catch(undefined),
        properties: z
          .record(z.string(), SchemaOrRef)
          .optional()
          .catch(undefined),
        additionalProperties: z
          .union([z.boolean(), SchemaOrRef])
          .optional()
          .catch(undefined),
        description: z.string().optional().catch(undefined),
        format: z.string().optional().catch(undefined),
        default: z.unknown().optional(),

        // OpenAPI-specific properties
        nullable: z.boolean().optional().catch(undefined),
        discriminator: Discriminator.optional().catch(undefined),
        readOnly: z.boolean().optional().catch(undefined),
        writeOnly: z.boolean().optional().catch(undefined),
        xml: XML.optional().catch(undefined),
        externalDocs: ExternalDocumentation.optional().catch(undefined),
        example: z.unknown().optional(),
        deprecated: z.boolean().optional().catch(undefined),
      },
      "Schema"
    )
  );

  // ===========================================================================
  // Layer 4: Schema-dependent types
  // ===========================================================================

  // Helper to create "Reference | Schema" union for use outside Schema
  // Uses TaggedReference to propagate appropriate nominals to ref targets
  const SchemaOrReference = z.union([TaggedReference("Schema"), Schema]);
  const ExampleOrReference = z.union([TaggedReference("Example"), Example]);

  // Encoding Object
  export const Encoding = TaggedObjectCatch(
    {
      contentType: z.string().optional().catch(undefined),
      headers: z
        .record(z.string(), z.union([Reference, z.unknown()]))
        .optional()
        .catch(undefined),
      style: z.string().optional().catch(undefined),
      explode: z.boolean().optional().catch(undefined),
      allowReserved: z.boolean().optional().catch(undefined),
    },
    "Encoding",
    {}
  );

  // MediaType Object
  export const MediaType = TaggedObjectCatch(
    {
      schema: SchemaOrReference.optional().catch(undefined),
      example: z.unknown().optional(),
      examples: z
        .record(z.string(), ExampleOrReference)
        .optional()
        .catch(undefined),
      encoding: z.record(z.string(), Encoding).optional().catch(undefined),
    },
    "MediaType",
    {}
  );

  export const Content = TaggedRecord(MediaType, "Content");

  // Header Object
  export const Header = TaggedObjectCatch(
    {
      description: z.string().optional().catch(undefined),
      required: z.boolean().optional().catch(undefined),
      deprecated: z.boolean().optional().catch(undefined),
      allowEmptyValue: z.boolean().optional().catch(undefined),
      style: z.string().optional().catch(undefined),
      explode: z.boolean().optional().catch(undefined),
      allowReserved: z.boolean().optional().catch(undefined),
      schema: SchemaOrReference.optional().catch(undefined),
      example: z.unknown().optional(),
      examples: z
        .record(z.string(), ExampleOrReference)
        .optional()
        .catch(undefined),
      content: Content.optional().catch(undefined),
    },
    "Header",
    {}
  );

  const HeaderOrReference = z.union([TaggedReference("Header"), Header]);

  // Link Object
  export const Link = TaggedObjectCatch(
    {
      operationRef: z.string().optional().catch(undefined),
      operationId: z.string().optional().catch(undefined),
      parameters: z.record(z.string(), z.unknown()).optional().catch(undefined),
      requestBody: z.unknown().optional(),
      description: z.string().optional().catch(undefined),
      server: Server.optional().catch(undefined),
    },
    "Link",
    {}
  );

  const LinkOrReference = z.union([TaggedReference("Link"), Link]);

  // Response Object
  export const Response = TaggedObjectCatch(
    {
      description: z.string().catch(""),
      headers: z
        .record(z.string(), HeaderOrReference)
        .optional()
        .catch(undefined),
      content: Content.optional().catch(undefined),
      links: z.record(z.string(), LinkOrReference).optional().catch(undefined),
    },
    "Response",
    { description: "" }
  );

  const ResponseOrReference = z.union([TaggedReference("Response"), Response]);

  // Parameter Object
  export const Parameter = TaggedObjectCatch(
    {
      name: z.string().catch(""),
      in: z.enum(["query", "header", "path", "cookie"]).catch("query"),
      description: z.string().optional().catch(undefined),
      required: z.boolean().optional().catch(undefined),
      deprecated: z.boolean().optional().catch(undefined),
      allowEmptyValue: z.boolean().optional().catch(undefined),
      style: z.string().optional().catch(undefined),
      explode: z.boolean().optional().catch(undefined),
      allowReserved: z.boolean().optional().catch(undefined),
      schema: SchemaOrReference.optional().catch(undefined),
      example: z.unknown().optional(),
      examples: z
        .record(z.string(), ExampleOrReference)
        .optional()
        .catch(undefined),
      content: Content.optional().catch(undefined),
    },
    "Parameter",
    { name: "", in: "query" }
  );

  const ParameterOrReference = z.union([
    TaggedReference("Parameter"),
    Parameter,
  ]);

  export const Parameters = TaggedArray(ParameterOrReference, "Parameters");

  // Request Body Object
  export const RequestBody = TaggedObjectCatch(
    {
      description: z.string().optional().catch(undefined),
      content: Content.catch({}),
      required: z.boolean().optional().catch(undefined),
    },
    "RequestBody",
    { content: {} }
  );

  const RequestBodyOrReference = z.union([
    TaggedReference("RequestBody"),
    RequestBody,
  ]);

  // Security Scheme Object
  export const SecurityScheme = TaggedObjectCatch(
    {
      type: z
        .enum(["apiKey", "http", "oauth2", "openIdConnect"])
        .catch("apiKey"),
      description: z.string().optional().catch(undefined),
      name: z.string().optional().catch(undefined),
      in: z.enum(["query", "header", "cookie"]).optional().catch(undefined),
      scheme: z.string().optional().catch(undefined),
      bearerFormat: z.string().optional().catch(undefined),
      flows: OAuthFlows.optional().catch(undefined),
      openIdConnectUrl: z.string().optional().catch(undefined),
    },
    "SecurityScheme",
    { type: "apiKey" }
  );

  const SecuritySchemeOrReference = z.union([
    TaggedReference("SecurityScheme"),
    SecurityScheme,
  ]);

  // ===========================================================================
  // Layer 5: Operation-level types
  // ===========================================================================

  export const Responses = TaggedRecord(ResponseOrReference, "Responses");

  // Operation Object
  export const Operation = TaggedObjectCatch(
    {
      tags: z.array(z.string().catch("")).optional().catch(undefined),
      summary: z.string().optional().catch(undefined),
      description: z.string().optional().catch(undefined),
      externalDocs: ExternalDocumentation.optional().catch(undefined),
      operationId: z.string().optional().catch(undefined),
      parameters: Parameters.optional().catch(undefined),
      requestBody: RequestBodyOrReference.optional().catch(undefined),
      responses: Responses.catch({}),
      callbacks: z.record(z.string(), z.unknown()).optional().catch(undefined),
      deprecated: z.boolean().optional().catch(undefined),
      security: z.array(SecurityRequirement).optional().catch(undefined),
      servers: z.array(Server).optional().catch(undefined),
    },
    "Operation",
    { responses: {} }
  );

  // Path Item Object
  export const PathItem = TaggedObjectCatch(
    {
      summary: z.string().optional().catch(undefined),
      description: z.string().optional().catch(undefined),
      get: Operation.optional().catch(undefined),
      put: Operation.optional().catch(undefined),
      post: Operation.optional().catch(undefined),
      delete: Operation.optional().catch(undefined),
      options: Operation.optional().catch(undefined),
      head: Operation.optional().catch(undefined),
      patch: Operation.optional().catch(undefined),
      trace: Operation.optional().catch(undefined),
      servers: z.array(Server).optional().catch(undefined),
      parameters: Parameters.optional().catch(undefined),
    },
    "PathItem",
    {}
  );

  const PathItemOrReference = z.union([TaggedReference("PathItem"), PathItem]);

  // Callback Object
  export const Callback = z.record(z.string(), PathItemOrReference).catch({});

  const CallbackOrReference = z.union([TaggedReference("Callback"), Callback]);

  // ===========================================================================
  // Layer 6: Components
  // ===========================================================================

  // Components Object
  export const Components = TaggedObjectCatch(
    {
      schemas: z
        .record(z.string(), SchemaOrReference)
        .optional()
        .catch(undefined),
      responses: z
        .record(z.string(), ResponseOrReference)
        .optional()
        .catch(undefined),
      parameters: z
        .record(z.string(), ParameterOrReference)
        .optional()
        .catch(undefined),
      examples: z
        .record(z.string(), ExampleOrReference)
        .optional()
        .catch(undefined),
      requestBodies: z
        .record(z.string(), RequestBodyOrReference)
        .optional()
        .catch(undefined),
      headers: z
        .record(z.string(), HeaderOrReference)
        .optional()
        .catch(undefined),
      securitySchemes: z
        .record(z.string(), SecuritySchemeOrReference)
        .optional()
        .catch(undefined),
      links: z.record(z.string(), LinkOrReference).optional().catch(undefined),
      callbacks: z
        .record(z.string(), CallbackOrReference)
        .optional()
        .catch(undefined),
    },
    "Components",
    {}
  );

  // ===========================================================================
  // Layer 7: Top-level types
  // ===========================================================================

  // Tag Object
  export const Tag = TaggedObjectCatch(
    {
      name: z.string().catch(""),
      description: z.string().optional().catch(undefined),
      externalDocs: ExternalDocumentation.optional().catch(undefined),
    },
    "Tag",
    { name: "" }
  );

  // Info Object
  export const Info = TaggedObjectCatch(
    {
      title: z.string().catch(""),
      description: z.string().optional().catch(undefined),
      termsOfService: z.string().optional().catch(undefined),
      contact: Contact.optional().catch(undefined),
      license: License.optional().catch(undefined),
      version: z.string().catch("0.0.0"),
    },
    "Info",
    { title: "", version: "0.0.0" }
  );

  // OpenAPI Document Object
  export const Document = TaggedObjectCatch(
    {
      openapi: z.string().catch("3.0.3"),
      info: Info,
      servers: z.array(Server).optional().catch(undefined),
      paths: z
        .record(z.string(), PathItemOrReference)
        .optional()
        .catch(undefined),
      components: Components.optional().catch(undefined),
      security: z.array(SecurityRequirement).optional().catch(undefined),
      tags: z.array(Tag).optional().catch(undefined),
      externalDocs: ExternalDocumentation.optional().catch(undefined),
    },
    "Document",
    { openapi: "3.0.3", info: { title: "", version: "0.0.0" } }
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
  export type Responses = z.infer<typeof Responses>;
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
