/**
 * Shared types and utilities for OpenAPI LSP
 * Based on OpenAPI Specification v3.0.3
 * https://spec.openapis.org/oas/v3.0.3.html
 *
 * Zod v4 implementation
 */

import { z } from "zod";
import {
  setOpenAPITag,
  TaggedArray,
  TaggedObject,
  TaggedRecord,
  TaggedReference,
} from "./tag.js";

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

  export const ServerVariables = TaggedRecord(
    ServerVariable,
    "ServerVariables"
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
      variables: ServerVariables.optional(),
    },
    "Server"
  );

  export const Servers = TaggedArray(Server, "Servers");

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
    z.union([TaggedReference("Schema"), Schema])
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
  const SchemaOrReference = z.union([TaggedReference("Schema"), Schema]);
  const ExampleOrReference = z.union([TaggedReference("Example"), Example]);

  // Examples record (used in MediaType, Header, Parameter)
  export const Examples = TaggedRecord(ExampleOrReference, "Examples");

  // Encoding Object
  export const Encoding = TaggedObject(
    {
      contentType: z.string().optional(),
      // Note: headers will be defined with HeaderOrReference after Header is defined
      headers: z
        .record(z.string(), z.union([TaggedReference("Header"), z.unknown()]))
        .optional(),
      style: z.string().optional(),
      explode: z.boolean().optional(),
      allowReserved: z.boolean().optional(),
    },
    "Encoding"
  );

  export const Encodings = TaggedRecord(Encoding, "Encodings");

  // MediaType Object
  export const MediaType = TaggedObject(
    {
      schema: SchemaOrReference.optional(),
      example: z.unknown().optional(),
      examples: Examples.optional(),
      encoding: Encodings.optional(),
    },
    "MediaType"
  );

  export const Content = TaggedRecord(MediaType, "Content");

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
      examples: Examples.optional(),
      content: Content.optional(),
    },
    "Header"
  );

  const HeaderOrReference = z.union([TaggedReference("Header"), Header]);

  // Headers record (used in Response, Components)
  export const Headers = TaggedRecord(HeaderOrReference, "Headers");

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

  const LinkOrReference = z.union([TaggedReference("Link"), Link]);

  // Links record (used in Response, Components)
  export const Links = TaggedRecord(LinkOrReference, "Links");

  // Response Object
  export const Response = TaggedObject(
    {
      description: z.string(),
      headers: Headers.optional(),
      content: Content.optional(),
      links: Links.optional(),
    },
    "Response"
  );

  const ResponseOrReference = z.union([TaggedReference("Response"), Response]);

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
      examples: Examples.optional(),
      content: Content.optional(),
    },
    "Parameter"
  );

  const ParameterOrReference = z.union([
    TaggedReference("Parameter"),
    Parameter,
  ]);

  export const Parameters = TaggedArray(ParameterOrReference, "Parameters");

  // Request Body Object
  export const RequestBody = TaggedObject(
    {
      description: z.string().optional(),
      content: Content,
      required: z.boolean().optional(),
    },
    "RequestBody"
  );

  const RequestBodyOrReference = z.union([
    TaggedReference("RequestBody"),
    RequestBody,
  ]);

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

  const SecuritySchemeOrReference = z.union([
    TaggedReference("SecurityScheme"),
    SecurityScheme,
  ]);

  // Tagged records for Components fields
  export const Schemas = TaggedRecord(SchemaOrReference, "Schemas");
  // Note: Examples is defined earlier (used in MediaType, Header, Parameter)
  // Note: Headers is defined earlier (used in Response)
  // Note: Links is defined earlier (used in Response)
  export const ComponentResponses = TaggedRecord(
    ResponseOrReference,
    "ComponentResponses"
  );
  export const ComponentParameters = TaggedRecord(
    ParameterOrReference,
    "ComponentParameters"
  );
  export const RequestBodies = TaggedRecord(
    RequestBodyOrReference,
    "RequestBodies"
  );
  export const SecuritySchemes = TaggedRecord(
    SecuritySchemeOrReference,
    "SecuritySchemes"
  );

  // ===========================================================================
  // Layer 5: Operation-level types
  // ===========================================================================

  export const Responses = TaggedRecord(ResponseOrReference, "Responses");

  // Operation Object
  export const Operation = TaggedObject(
    {
      tags: z.array(z.string()).optional(),
      summary: z.string().optional(),
      description: z.string().optional(),
      externalDocs: ExternalDocumentation.optional(),
      operationId: z.string().optional(),
      parameters: Parameters.optional(),
      requestBody: RequestBodyOrReference.optional(),
      responses: Responses,
      // callbacks defined below after PathItem
      callbacks: z.record(z.string(), z.unknown()).optional(),
      deprecated: z.boolean().optional(),
      security: z.array(SecurityRequirement).optional(),
      servers: Servers.optional(),
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
      servers: Servers.optional(),
      parameters: Parameters.optional(),
    },
    "PathItem"
  );

  const PathItemOrReference = z.union([TaggedReference("PathItem"), PathItem]);

  // Paths record (used in Document)
  export const Paths = TaggedRecord(PathItemOrReference, "Paths");

  // Callback Object
  export const Callback = TaggedRecord(PathItemOrReference, "Callback");

  const CallbackOrReference = z.union([TaggedReference("Callback"), Callback]);

  export const Callbacks = TaggedRecord(CallbackOrReference, "Callbacks");

  // ===========================================================================
  // Layer 6: Components
  // ===========================================================================

  // Components Object
  export const Components = TaggedObject(
    {
      schemas: Schemas.optional(),
      responses: ComponentResponses.optional(),
      parameters: ComponentParameters.optional(),
      examples: Examples.optional(),
      requestBodies: RequestBodies.optional(),
      headers: Headers.optional(),
      securitySchemes: SecuritySchemes.optional(),
      links: Links.optional(),
      callbacks: Callbacks.optional(),
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

  // Tags
  export const TagArray = TaggedArray(Tag, "TagArray");

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
      servers: Servers.optional(),
      paths: Paths.optional(),
      components: Components.optional(),
      security: z.array(SecurityRequirement).optional(),
      tags: TagArray.optional(),
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
  export type Schemas = z.infer<typeof Schemas>;
  export type MediaType = z.infer<typeof MediaType>;
  export type Content = z.infer<typeof Content>;
  export type Example = z.infer<typeof Example>;
  export type Examples = z.infer<typeof Examples>;
  export type Encoding = z.infer<typeof Encoding>;
  export type Encodings = z.infer<typeof Encodings>;
  export type Header = z.infer<typeof Header>;
  export type Headers = z.infer<typeof Headers>;
  export type Link = z.infer<typeof Link>;
  export type Links = z.infer<typeof Links>;
  export type Server = z.infer<typeof Server>;
  export type Servers = z.infer<typeof Servers>;
  export type ServerVariable = z.infer<typeof ServerVariable>;
  export type ServerVariables = z.infer<typeof ServerVariables>;
  export type Response = z.infer<typeof Response>;
  export type Responses = z.infer<typeof Responses>;
  export type ComponentResponses = z.infer<typeof ComponentResponses>;
  export type Parameter = z.infer<typeof Parameter>;
  export type Parameters = z.infer<typeof Parameters>;
  export type ComponentParameters = z.infer<typeof ComponentParameters>;
  export type RequestBody = z.infer<typeof RequestBody>;
  export type RequestBodies = z.infer<typeof RequestBodies>;
  export type Callback = z.infer<typeof Callback>;
  export type Callbacks = z.infer<typeof Callbacks>;
  export type SecurityRequirement = z.infer<typeof SecurityRequirement>;
  export type Operation = z.infer<typeof Operation>;
  export type PathItem = z.infer<typeof PathItem>;
  export type Paths = z.infer<typeof Paths>;
  export type SecurityScheme = z.infer<typeof SecurityScheme>;
  export type SecuritySchemes = z.infer<typeof SecuritySchemes>;
  export type OAuthFlows = z.infer<typeof OAuthFlows>;
  export type OAuthFlow = z.infer<typeof OAuthFlow>;
  export type Components = z.infer<typeof Components>;
  export type Tag = z.infer<typeof Tag>;
  export type TagArray = z.infer<typeof TagArray>;
  export type Contact = z.infer<typeof Contact>;
  export type License = z.infer<typeof License>;
  export type Info = z.infer<typeof Info>;
  export type Document = z.infer<typeof Document>;
}
