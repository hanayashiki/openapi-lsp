/**
 * Shared types and utilities for OpenAPI LSP
 * Based on OpenAPI Specification v3.0.3
 * https://spec.openapis.org/oas/v3.0.3.html
 */

import Type from "typebox";
//import { Settings } from "typebox/system";
import { TaggedObject } from "./tag.js";

// ------------------------------------------------------------------------------
// OpenAPI Namespace
//
// Strict types matching OpenAPI 3.0.3 specification
// Uses Type.Cyclic only for Schema (the only truly recursive type)
// All other types use direct references
// ------------------------------------------------------------------------------
export namespace OpenAPI {
  // @see https://github.com/sinclairzx81/typebox/issues/1495
  // the bug erases settings by `Type.Codec` so decoding does not work in `TaggedObject`
  //Settings.Set({ enumerableKind: true });

  // ===========================================================================
  // Layer 1: Leaf types (no dependencies)
  // ===========================================================================

  // Reference Object - used at use sites for referenceable types
  export const Reference = TaggedObject(
    Type.Object({
      $ref: Type.String(),
    }),
    "Reference"
  );

  // XML Object
  export const XML = TaggedObject(
    Type.Object({
      name: Type.Optional(Type.String()),
      namespace: Type.Optional(Type.String()),
      prefix: Type.Optional(Type.String()),
      attribute: Type.Optional(Type.Boolean()),
      wrapped: Type.Optional(Type.Boolean()),
    }),
    "XML"
  );

  // Discriminator Object
  export const Discriminator = TaggedObject(
    Type.Object({
      propertyName: Type.String(),
      mapping: Type.Optional(Type.Record(Type.String(), Type.String())),
    }),
    "Discriminator"
  );

  // Contact Object
  export const Contact = TaggedObject(
    Type.Object({
      name: Type.Optional(Type.String()),
      url: Type.Optional(Type.String()),
      email: Type.Optional(Type.String()),
    }),
    "Contact"
  );

  // License Object
  export const License = TaggedObject(
    Type.Object({
      name: Type.String(),
      url: Type.Optional(Type.String()),
    }),
    "License"
  );

  // Server Variable Object
  export const ServerVariable = TaggedObject(
    Type.Object({
      enum: Type.Optional(Type.Array(Type.String())),
      default: Type.String(),
      description: Type.Optional(Type.String()),
    }),
    "ServerVariable"
  );

  // OAuth Flow Object
  export const OAuthFlow = TaggedObject(
    Type.Object({
      authorizationUrl: Type.Optional(Type.String()),
      tokenUrl: Type.Optional(Type.String()),
      refreshUrl: Type.Optional(Type.String()),
      scopes: Type.Record(Type.String(), Type.String()),
    }),
    "OAuthFlow"
  );

  // Example Object
  export const Example = TaggedObject(
    Type.Object({
      summary: Type.Optional(Type.String()),
      description: Type.Optional(Type.String()),
      value: Type.Optional(Type.Unknown()),
      externalValue: Type.Optional(Type.String()),
    }),
    "Example"
  );

  // Security Requirement Object
  export const SecurityRequirement = Type.Record(
    Type.String(),
    Type.Array(Type.String())
  );

  // ===========================================================================
  // Layer 2: Simple composed types
  // ===========================================================================

  // External Documentation Object
  export const ExternalDocumentation = TaggedObject(
    Type.Object({
      description: Type.Optional(Type.String()),
      url: Type.String(),
    }),
    "ExternalDocumentation"
  );

  // OAuth Flows Object
  export const OAuthFlows = TaggedObject(
    Type.Object({
      implicit: Type.Optional(OAuthFlow),
      password: Type.Optional(OAuthFlow),
      clientCredentials: Type.Optional(OAuthFlow),
      authorizationCode: Type.Optional(OAuthFlow),
    }),
    "OAuthFlows"
  );

  // Server Object
  export const Server = TaggedObject(
    Type.Object({
      url: Type.String(),
      description: Type.Optional(Type.String()),
      variables: Type.Optional(Type.Record(Type.String(), ServerVariable)),
    }),
    "Server"
  );

  // ===========================================================================
  // Layer 3: Schema (recursive - uses Type.Cyclic)
  // ===========================================================================

  // Helper to create "Schema | Reference" union for use inside Schema
  const SchemaOrRef = Type.Union([Type.Ref("Schema"), Reference]);

  export const Schema = Type.Cyclic(
    {
      Schema: Type.Object({
        // JSON Schema properties
        title: Type.Optional(Type.String()),
        multipleOf: Type.Optional(Type.Number()),
        maximum: Type.Optional(Type.Number()),
        exclusiveMaximum: Type.Optional(Type.Boolean()),
        minimum: Type.Optional(Type.Number()),
        exclusiveMinimum: Type.Optional(Type.Boolean()),
        maxLength: Type.Optional(Type.Integer()),
        minLength: Type.Optional(Type.Integer()),
        pattern: Type.Optional(Type.String()),
        maxItems: Type.Optional(Type.Integer()),
        minItems: Type.Optional(Type.Integer()),
        uniqueItems: Type.Optional(Type.Boolean()),
        maxProperties: Type.Optional(Type.Integer()),
        minProperties: Type.Optional(Type.Integer()),
        required: Type.Optional(Type.Array(Type.String())),
        enum: Type.Optional(Type.Array(Type.Unknown())),

        // Modified JSON Schema properties - use SchemaOrRef for schema references
        type: Type.Optional(Type.String()),
        allOf: Type.Optional(Type.Array(SchemaOrRef)),
        oneOf: Type.Optional(Type.Array(SchemaOrRef)),
        anyOf: Type.Optional(Type.Array(SchemaOrRef)),
        not: Type.Optional(SchemaOrRef),
        items: Type.Optional(SchemaOrRef),
        properties: Type.Optional(Type.Record(Type.String(), SchemaOrRef)),
        additionalProperties: Type.Optional(
          Type.Union([Type.Boolean(), SchemaOrRef])
        ),
        description: Type.Optional(Type.String()),
        format: Type.Optional(Type.String()),
        default: Type.Optional(Type.Unknown()),

        // OpenAPI-specific properties
        nullable: Type.Optional(Type.Boolean()),
        discriminator: Type.Optional(Discriminator),
        readOnly: Type.Optional(Type.Boolean()),
        writeOnly: Type.Optional(Type.Boolean()),
        xml: Type.Optional(XML),
        externalDocs: Type.Optional(ExternalDocumentation),
        example: Type.Optional(Type.Unknown()),
        deprecated: Type.Optional(Type.Boolean()),
      }),
    },
    "Schema"
  );

  // ===========================================================================
  // Layer 4: Schema-dependent types
  // ===========================================================================

  // Helper to create "Schema | Reference" union for use outside Schema
  const SchemaOrReference = Type.Union([Schema, Reference]);
  const ExampleOrReference = Type.Union([Example, Reference]);

  // Encoding Object
  export const Encoding = TaggedObject(
    Type.Object({
      contentType: Type.Optional(Type.String()),
      // Note: headers will be defined with HeaderOrReference after Header is defined
      headers: Type.Optional(
        Type.Record(Type.String(), Type.Union([Type.Unknown(), Reference]))
      ),
      style: Type.Optional(Type.String()),
      explode: Type.Optional(Type.Boolean()),
      allowReserved: Type.Optional(Type.Boolean()),
    }),
    "Encoding"
  );

  // MediaType Object
  export const MediaType = TaggedObject(
    Type.Object({
      schema: Type.Optional(SchemaOrReference),
      example: Type.Optional(Type.Unknown()),
      examples: Type.Optional(Type.Record(Type.String(), ExampleOrReference)),
      encoding: Type.Optional(Type.Record(Type.String(), Encoding)),
    }),
    "MediaType"
  );

  // Header Object
  export const Header = TaggedObject(
    Type.Object({
      description: Type.Optional(Type.String()),
      required: Type.Optional(Type.Boolean()),
      deprecated: Type.Optional(Type.Boolean()),
      allowEmptyValue: Type.Optional(Type.Boolean()),
      style: Type.Optional(Type.String()),
      explode: Type.Optional(Type.Boolean()),
      allowReserved: Type.Optional(Type.Boolean()),
      schema: Type.Optional(SchemaOrReference),
      example: Type.Optional(Type.Unknown()),
      examples: Type.Optional(Type.Record(Type.String(), ExampleOrReference)),
      content: Type.Optional(Type.Record(Type.String(), MediaType)),
    }),
    "Header"
  );

  const HeaderOrReference = Type.Union([Header, Reference]);

  // Link Object
  export const Link = TaggedObject(
    Type.Object({
      operationRef: Type.Optional(Type.String()),
      operationId: Type.Optional(Type.String()),
      parameters: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
      requestBody: Type.Optional(Type.Unknown()),
      description: Type.Optional(Type.String()),
      server: Type.Optional(Server),
    }),
    "Link"
  );

  const LinkOrReference = Type.Union([Link, Reference]);

  // Response Object
  export const Response = TaggedObject(
    Type.Object({
      description: Type.String(),
      headers: Type.Optional(Type.Record(Type.String(), HeaderOrReference)),
      content: Type.Optional(Type.Record(Type.String(), MediaType)),
      links: Type.Optional(Type.Record(Type.String(), LinkOrReference)),
    }),
    "Response"
  );

  const ResponseOrReference = Type.Union([Response, Reference]);

  // Parameter Object
  export const Parameter = TaggedObject(
    Type.Object({
      name: Type.String(),
      in: Type.Union([
        Type.Literal("query"),
        Type.Literal("header"),
        Type.Literal("path"),
        Type.Literal("cookie"),
      ]),
      description: Type.Optional(Type.String()),
      required: Type.Optional(Type.Boolean()),
      deprecated: Type.Optional(Type.Boolean()),
      allowEmptyValue: Type.Optional(Type.Boolean()),
      style: Type.Optional(Type.String()),
      explode: Type.Optional(Type.Boolean()),
      allowReserved: Type.Optional(Type.Boolean()),
      schema: Type.Optional(SchemaOrReference),
      example: Type.Optional(Type.Unknown()),
      examples: Type.Optional(Type.Record(Type.String(), ExampleOrReference)),
      content: Type.Optional(Type.Record(Type.String(), MediaType)),
    }),
    "Parameter"
  );

  const ParameterOrReference = Type.Union([Parameter, Reference]);

  // Request Body Object
  export const RequestBody = TaggedObject(
    Type.Object({
      description: Type.Optional(Type.String()),
      content: Type.Record(Type.String(), MediaType),
      required: Type.Optional(Type.Boolean()),
    }),
    "RequestBody"
  );

  const RequestBodyOrReference = Type.Union([RequestBody, Reference]);

  // Security Scheme Object
  export const SecurityScheme = TaggedObject(
    Type.Object({
      type: Type.Union([
        Type.Literal("apiKey"),
        Type.Literal("http"),
        Type.Literal("oauth2"),
        Type.Literal("openIdConnect"),
      ]),
      description: Type.Optional(Type.String()),
      name: Type.Optional(Type.String()),
      in: Type.Optional(
        Type.Union([
          Type.Literal("query"),
          Type.Literal("header"),
          Type.Literal("cookie"),
        ])
      ),
      scheme: Type.Optional(Type.String()),
      bearerFormat: Type.Optional(Type.String()),
      flows: Type.Optional(OAuthFlows),
      openIdConnectUrl: Type.Optional(Type.String()),
    }),
    "SecurityScheme"
  );

  const SecuritySchemeOrReference = Type.Union([SecurityScheme, Reference]);

  // ===========================================================================
  // Layer 5: Operation-level types
  // ===========================================================================

  // Operation Object
  export const Operation = TaggedObject(
    Type.Object({
      tags: Type.Optional(Type.Array(Type.String())),
      summary: Type.Optional(Type.String()),
      description: Type.Optional(Type.String()),
      externalDocs: Type.Optional(ExternalDocumentation),
      operationId: Type.Optional(Type.String()),
      parameters: Type.Optional(Type.Array(ParameterOrReference)),
      requestBody: Type.Optional(RequestBodyOrReference),
      responses: Type.Record(Type.String(), ResponseOrReference),
      // callbacks defined below after PathItem
      callbacks: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
      deprecated: Type.Optional(Type.Boolean()),
      security: Type.Optional(Type.Array(SecurityRequirement)),
      servers: Type.Optional(Type.Array(Server)),
    }),
    "Operation"
  );

  // Path Item Object
  export const PathItem = TaggedObject(
    Type.Object({
      summary: Type.Optional(Type.String()),
      description: Type.Optional(Type.String()),
      get: Type.Optional(Operation),
      put: Type.Optional(Operation),
      post: Type.Optional(Operation),
      delete: Type.Optional(Operation),
      options: Type.Optional(Operation),
      head: Type.Optional(Operation),
      patch: Type.Optional(Operation),
      trace: Type.Optional(Operation),
      servers: Type.Optional(Type.Array(Server)),
      parameters: Type.Optional(Type.Array(ParameterOrReference)),
    }),
    "PathItem"
  );

  const PathItemOrReference = Type.Union([PathItem, Reference]);

  // Callback Object
  export const Callback = Type.Record(Type.String(), PathItemOrReference);

  const CallbackOrReference = Type.Union([Callback, Reference]);

  // ===========================================================================
  // Layer 6: Components
  // ===========================================================================

  // Components Object
  export const Components = TaggedObject(
    Type.Object({
      schemas: Type.Optional(Type.Record(Type.String(), SchemaOrReference)),
      responses: Type.Optional(Type.Record(Type.String(), ResponseOrReference)),
      parameters: Type.Optional(
        Type.Record(Type.String(), ParameterOrReference)
      ),
      examples: Type.Optional(Type.Record(Type.String(), ExampleOrReference)),
      requestBodies: Type.Optional(
        Type.Record(Type.String(), RequestBodyOrReference)
      ),
      headers: Type.Optional(Type.Record(Type.String(), HeaderOrReference)),
      securitySchemes: Type.Optional(
        Type.Record(Type.String(), SecuritySchemeOrReference)
      ),
      links: Type.Optional(Type.Record(Type.String(), LinkOrReference)),
      callbacks: Type.Optional(Type.Record(Type.String(), CallbackOrReference)),
    }),
    "Components"
  );

  // ===========================================================================
  // Layer 7: Top-level types
  // ===========================================================================

  // Tag Object
  export const Tag = TaggedObject(
    Type.Object({
      name: Type.String(),
      description: Type.Optional(Type.String()),
      externalDocs: Type.Optional(ExternalDocumentation),
    }),
    "Tag"
  );

  // Info Object
  export const Info = TaggedObject(
    Type.Object({
      title: Type.String(),
      description: Type.Optional(Type.String()),
      termsOfService: Type.Optional(Type.String()),
      contact: Type.Optional(Contact),
      license: Type.Optional(License),
      version: Type.String(),
    }),
    "Info"
  );

  // OpenAPI Document Object
  export const Document = TaggedObject(
    Type.Object({
      openapi: Type.String(),
      info: Info,
      servers: Type.Optional(Type.Array(Server)),
      paths: Type.Optional(Type.Record(Type.String(), PathItemOrReference)),
      components: Type.Optional(Components),
      security: Type.Optional(Type.Array(SecurityRequirement)),
      tags: Type.Optional(Type.Array(Tag)),
      externalDocs: Type.Optional(ExternalDocumentation),
    }),
    "Document"
  );

  // ===========================================================================
  // Type exports
  // ===========================================================================
  export type Reference = Type.Static<typeof Reference>;
  export type ExternalDocumentation = Type.Static<typeof ExternalDocumentation>;
  export type XML = Type.Static<typeof XML>;
  export type Discriminator = Type.Static<typeof Discriminator>;
  export type Schema = Type.Static<typeof Schema>;
  export type MediaType = Type.Static<typeof MediaType>;
  export type Example = Type.Static<typeof Example>;
  export type Encoding = Type.Static<typeof Encoding>;
  export type Header = Type.Static<typeof Header>;
  export type Link = Type.Static<typeof Link>;
  export type Server = Type.Static<typeof Server>;
  export type ServerVariable = Type.Static<typeof ServerVariable>;
  export type Response = Type.Static<typeof Response>;
  export type Parameter = Type.Static<typeof Parameter>;
  export type RequestBody = Type.Static<typeof RequestBody>;
  export type Callback = Type.Static<typeof Callback>;
  export type SecurityRequirement = Type.Static<typeof SecurityRequirement>;
  export type Operation = Type.Static<typeof Operation>;
  export type PathItem = Type.Static<typeof PathItem>;
  export type SecurityScheme = Type.Static<typeof SecurityScheme>;
  export type OAuthFlows = Type.Static<typeof OAuthFlows>;
  export type OAuthFlow = Type.Static<typeof OAuthFlow>;
  export type Components = Type.Static<typeof Components>;
  export type Tag = Type.Static<typeof Tag>;
  export type Contact = Type.Static<typeof Contact>;
  export type License = Type.Static<typeof License>;
  export type Info = Type.Static<typeof Info>;
  export type Document = Type.Static<typeof Document>;
}

export type JSONPointer = string & { __jsonPointer?: true };
