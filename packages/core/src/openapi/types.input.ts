/**
 * Lenient input types matching OpenAPI 3.0.3 specification
 * Uses Zod .catch() for fallback defaults on invalid input
 */

import { z } from "zod";
import { setOpenAPITag } from "./tag.js";

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

  // Reference Object - used at use sites for referenceable types
  export const Reference = z
    .object({
      $ref: z.string().catch(""),
    })
    .catch({ $ref: "" });

  // XML Object
  export const XML = z
    .object({
      name: z.string().optional().catch(undefined),
      namespace: z.string().optional().catch(undefined),
      prefix: z.string().optional().catch(undefined),
      attribute: z.boolean().optional().catch(undefined),
      wrapped: z.boolean().optional().catch(undefined),
    })
    .catch({});

  // Discriminator Object
  export const Discriminator = z
    .object({
      propertyName: z.string().catch(""),
      mapping: z.record(z.string(), z.string().catch("")).optional().catch(undefined),
    })
    .catch({ propertyName: "" });

  // Contact Object
  export const Contact = z
    .object({
      name: z.string().optional().catch(undefined),
      url: z.string().optional().catch(undefined),
      email: z.string().optional().catch(undefined),
    })
    .catch({});

  // License Object
  export const License = z
    .object({
      name: z.string().catch(""),
      url: z.string().optional().catch(undefined),
    })
    .catch({ name: "" });

  // Server Variable Object
  export const ServerVariable = z
    .object({
      enum: z.array(z.string().catch("")).optional().catch(undefined),
      default: z.string().catch(""),
      description: z.string().optional().catch(undefined),
    })
    .catch({ default: "" });

  // OAuth Flow Object
  export const OAuthFlow = z
    .object({
      authorizationUrl: z.string().optional().catch(undefined),
      tokenUrl: z.string().optional().catch(undefined),
      refreshUrl: z.string().optional().catch(undefined),
      scopes: z.record(z.string(), z.string().catch("")).catch({}),
    })
    .catch({ scopes: {} });

  // Example Object
  export const Example = z
    .object({
      summary: z.string().optional().catch(undefined),
      description: z.string().optional().catch(undefined),
      value: z.unknown().optional(),
      externalValue: z.string().optional().catch(undefined),
    })
    .catch({});

  // Security Requirement Object
  export const SecurityRequirement = z
    .record(z.string(), z.array(z.string().catch("")).catch([]))
    .catch({});

  // ===========================================================================
  // Layer 2: Simple composed types
  // ===========================================================================

  // External Documentation Object
  export const ExternalDocumentation = z
    .object({
      description: z.string().optional().catch(undefined),
      url: z.string().catch(""),
    })
    .catch({ url: "" });

  // OAuth Flows Object
  export const OAuthFlows = z
    .object({
      implicit: OAuthFlow.optional().catch(undefined),
      password: OAuthFlow.optional().catch(undefined),
      clientCredentials: OAuthFlow.optional().catch(undefined),
      authorizationCode: OAuthFlow.optional().catch(undefined),
    })
    .catch({});

  // Server Object
  export const Server = z
    .object({
      url: z.string().catch(""),
      description: z.string().optional().catch(undefined),
      variables: z.record(z.string(), ServerVariable).optional().catch(undefined),
    })
    .catch({ url: "" });

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
  const SchemaOrRef: z.ZodType<SchemaType | Reference> = z.lazy(() =>
    z.union([Reference, Schema])
  );

  export const Schema: z.ZodType<SchemaType> = z.lazy(() =>
    z
      .object({
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
        properties: z.record(z.string(), SchemaOrRef).optional().catch(undefined),
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
      })
      .transform((value) => {
        setOpenAPITag(value, "Schema");
        return value;
      })
  );

  // ===========================================================================
  // Layer 4: Schema-dependent types
  // ===========================================================================

  // Helper to create "Reference | Schema" union for use outside Schema
  const SchemaOrReference = z.union([Reference, Schema]);
  const ExampleOrReference = z.union([Reference, Example]);

  // Encoding Object
  export const Encoding = z
    .object({
      contentType: z.string().optional().catch(undefined),
      headers: z
        .record(z.string(), z.union([Reference, z.unknown()]))
        .optional()
        .catch(undefined),
      style: z.string().optional().catch(undefined),
      explode: z.boolean().optional().catch(undefined),
      allowReserved: z.boolean().optional().catch(undefined),
    })
    .catch({});

  // MediaType Object
  export const MediaType = z
    .object({
      schema: SchemaOrReference.optional().catch(undefined),
      example: z.unknown().optional(),
      examples: z.record(z.string(), ExampleOrReference).optional().catch(undefined),
      encoding: z.record(z.string(), Encoding).optional().catch(undefined),
    })
    .catch({});

  // Header Object
  export const Header = z
    .object({
      description: z.string().optional().catch(undefined),
      required: z.boolean().optional().catch(undefined),
      deprecated: z.boolean().optional().catch(undefined),
      allowEmptyValue: z.boolean().optional().catch(undefined),
      style: z.string().optional().catch(undefined),
      explode: z.boolean().optional().catch(undefined),
      allowReserved: z.boolean().optional().catch(undefined),
      schema: SchemaOrReference.optional().catch(undefined),
      example: z.unknown().optional(),
      examples: z.record(z.string(), ExampleOrReference).optional().catch(undefined),
      content: z.record(z.string(), MediaType).optional().catch(undefined),
    })
    .catch({});

  const HeaderOrReference = z.union([Reference, Header]);

  // Link Object
  export const Link = z
    .object({
      operationRef: z.string().optional().catch(undefined),
      operationId: z.string().optional().catch(undefined),
      parameters: z.record(z.string(), z.unknown()).optional().catch(undefined),
      requestBody: z.unknown().optional(),
      description: z.string().optional().catch(undefined),
      server: Server.optional().catch(undefined),
    })
    .catch({});

  const LinkOrReference = z.union([Reference, Link]);

  // Response Object
  export const Response = z
    .object({
      description: z.string().catch(""),
      headers: z.record(z.string(), HeaderOrReference).optional().catch(undefined),
      content: z.record(z.string(), MediaType).optional().catch(undefined),
      links: z.record(z.string(), LinkOrReference).optional().catch(undefined),
    })
    .catch({ description: "" });

  const ResponseOrReference = z.union([Reference, Response]);

  // Parameter Object
  export const Parameter = z
    .object({
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
      examples: z.record(z.string(), ExampleOrReference).optional().catch(undefined),
      content: z.record(z.string(), MediaType).optional().catch(undefined),
    })
    .catch({ name: "", in: "query" });

  const ParameterOrReference = z.union([Reference, Parameter]);

  // Request Body Object
  export const RequestBody = z
    .object({
      description: z.string().optional().catch(undefined),
      content: z.record(z.string(), MediaType).catch({}),
      required: z.boolean().optional().catch(undefined),
    })
    .catch({ content: {} });

  const RequestBodyOrReference = z.union([Reference, RequestBody]);

  // Security Scheme Object
  export const SecurityScheme = z
    .object({
      type: z.enum(["apiKey", "http", "oauth2", "openIdConnect"]).catch("apiKey"),
      description: z.string().optional().catch(undefined),
      name: z.string().optional().catch(undefined),
      in: z.enum(["query", "header", "cookie"]).optional().catch(undefined),
      scheme: z.string().optional().catch(undefined),
      bearerFormat: z.string().optional().catch(undefined),
      flows: OAuthFlows.optional().catch(undefined),
      openIdConnectUrl: z.string().optional().catch(undefined),
    })
    .catch({ type: "apiKey" });

  const SecuritySchemeOrReference = z.union([Reference, SecurityScheme]);

  // ===========================================================================
  // Layer 5: Operation-level types
  // ===========================================================================

  // Operation Object
  export const Operation = z
    .object({
      tags: z.array(z.string().catch("")).optional().catch(undefined),
      summary: z.string().optional().catch(undefined),
      description: z.string().optional().catch(undefined),
      externalDocs: ExternalDocumentation.optional().catch(undefined),
      operationId: z.string().optional().catch(undefined),
      parameters: z.array(ParameterOrReference).optional().catch(undefined),
      requestBody: RequestBodyOrReference.optional().catch(undefined),
      responses: z.record(z.string(), ResponseOrReference).catch({}),
      callbacks: z.record(z.string(), z.unknown()).optional().catch(undefined),
      deprecated: z.boolean().optional().catch(undefined),
      security: z.array(SecurityRequirement).optional().catch(undefined),
      servers: z.array(Server).optional().catch(undefined),
    })
    .catch({ responses: {} });

  // Path Item Object
  export const PathItem = z
    .object({
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
      parameters: z.array(ParameterOrReference).optional().catch(undefined),
    })
    .catch({});

  const PathItemOrReference = z.union([Reference, PathItem]);

  // Callback Object
  export const Callback = z.record(z.string(), PathItemOrReference).catch({});

  const CallbackOrReference = z.union([Reference, Callback]);

  // ===========================================================================
  // Layer 6: Components
  // ===========================================================================

  // Components Object
  export const Components = z
    .object({
      schemas: z.record(z.string(), SchemaOrReference).optional().catch(undefined),
      responses: z.record(z.string(), ResponseOrReference).optional().catch(undefined),
      parameters: z.record(z.string(), ParameterOrReference).optional().catch(undefined),
      examples: z.record(z.string(), ExampleOrReference).optional().catch(undefined),
      requestBodies: z
        .record(z.string(), RequestBodyOrReference)
        .optional()
        .catch(undefined),
      headers: z.record(z.string(), HeaderOrReference).optional().catch(undefined),
      securitySchemes: z
        .record(z.string(), SecuritySchemeOrReference)
        .optional()
        .catch(undefined),
      links: z.record(z.string(), LinkOrReference).optional().catch(undefined),
      callbacks: z.record(z.string(), CallbackOrReference).optional().catch(undefined),
    })
    .catch({});

  // ===========================================================================
  // Layer 7: Top-level types
  // ===========================================================================

  // Tag Object
  export const Tag = z
    .object({
      name: z.string().catch(""),
      description: z.string().optional().catch(undefined),
      externalDocs: ExternalDocumentation.optional().catch(undefined),
    })
    .catch({ name: "" });

  // Info Object
  export const Info = z
    .object({
      title: z.string().catch(""),
      description: z.string().optional().catch(undefined),
      termsOfService: z.string().optional().catch(undefined),
      contact: Contact.optional().catch(undefined),
      license: License.optional().catch(undefined),
      version: z.string().catch("0.0.0"),
    })
    .catch({ title: "", version: "0.0.0" });

  // OpenAPI Document Object
  export const Document = z
    .object({
      openapi: z.string().catch("3.0.3"),
      info: Info,
      servers: z.array(Server).optional().catch(undefined),
      paths: z.record(z.string(), PathItemOrReference).optional().catch(undefined),
      components: Components.optional().catch(undefined),
      security: z.array(SecurityRequirement).optional().catch(undefined),
      tags: z.array(Tag).optional().catch(undefined),
      externalDocs: ExternalDocumentation.optional().catch(undefined),
    })
    .catch({ openapi: "3.0.3", info: { title: "", version: "0.0.0" } });

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
