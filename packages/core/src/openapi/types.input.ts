/**
 * Lenient input types matching OpenAPI 3.0.3 specification
 */

import Type from "typebox";
import {
  FallbackString,
  FallbackOptionalString,
  FallbackOptionalNumber,
  FallbackOptionalInteger,
  FallbackOptionalBoolean,
  FallbackLiteralUnion,
  FallbackOptionalLiteralUnion,
  FallbackArray,
  FallbackOptionalArray,
  FallbackRecord,
  FallbackOptionalRecord,
  FallbackObject,
  FallbackOptionalObject,
  FallbackOptionalBooleanOrSchema,
} from "./input-codec.js";

// ------------------------------------------------------------------------------
// OpenAPI Namespace
//
// Strict types matching OpenAPI 3.0.3 specification
// Uses Type.Cyclic only for Schema (the only truly recursive type)
// All other types use direct references
// ------------------------------------------------------------------------------
export namespace OpenAPIInput {
  // ===========================================================================
  // Layer 1: Leaf types (no dependencies)
  // ===========================================================================

  // Reference Object - used at use sites for referenceable types
  export const Reference = FallbackObject(Type.Object({
    // TODO: mark this as JSONPointer
    $ref: FallbackString(""),
  }));

  // XML Object
  export const XML = FallbackObject(Type.Object({
    name: FallbackOptionalString(),
    namespace: FallbackOptionalString(),
    prefix: FallbackOptionalString(),
    attribute: FallbackOptionalBoolean(),
    wrapped: FallbackOptionalBoolean(),
  }));

  // Discriminator Object
  export const Discriminator = FallbackObject(Type.Object({
    propertyName: FallbackString(""),
    mapping: FallbackOptionalRecord(Type.String(), FallbackString("")),
  }));

  // Contact Object
  export const Contact = FallbackObject(Type.Object({
    name: FallbackOptionalString(),
    url: FallbackOptionalString(),
    email: FallbackOptionalString(),
  }));

  // License Object
  export const License = FallbackObject(Type.Object({
    name: FallbackString(""),
    url: FallbackOptionalString(),
  }));

  // Server Variable Object
  export const ServerVariable = FallbackObject(Type.Object({
    enum: FallbackOptionalArray(FallbackString("")),
    default: FallbackString(""),
    description: FallbackOptionalString(),
  }));

  // OAuth Flow Object
  export const OAuthFlow = FallbackObject(Type.Object({
    authorizationUrl: FallbackOptionalString(),
    tokenUrl: FallbackOptionalString(),
    refreshUrl: FallbackOptionalString(),
    scopes: FallbackRecord(Type.String(), FallbackString("")),
  }));

  // Example Object
  export const Example = FallbackObject(Type.Object({
    summary: FallbackOptionalString(),
    description: FallbackOptionalString(),
    value: Type.Optional(Type.Unknown()),
    externalValue: FallbackOptionalString(),
  }));

  // Security Requirement Object
  export const SecurityRequirement = FallbackRecord(
    Type.String(),
    FallbackArray(FallbackString(""))
  );

  // ===========================================================================
  // Layer 2: Simple composed types
  // ===========================================================================

  // External Documentation Object
  export const ExternalDocumentation = FallbackObject(Type.Object({
    description: FallbackOptionalString(),
    url: FallbackString(""),
  }));

  // OAuth Flows Object
  export const OAuthFlows = FallbackObject(Type.Object({
    implicit: Type.Optional(OAuthFlow),
    password: Type.Optional(OAuthFlow),
    clientCredentials: Type.Optional(OAuthFlow),
    authorizationCode: Type.Optional(OAuthFlow),
  }));

  // Server Object
  export const Server = FallbackObject(Type.Object({
    url: FallbackString(""),
    description: FallbackOptionalString(),
    variables: FallbackOptionalRecord(Type.String(), ServerVariable),
  }));

  // ===========================================================================
  // Layer 3: Schema (recursive - uses Type.Cyclic)
  // ===========================================================================

  // Helper to create "Schema | Reference" union for use inside Schema
  const SchemaOrRef = Type.Union([Type.Ref("Schema"), Reference]);

  export const Schema = Type.Cyclic(
    {
      Schema: Type.Object({
        // JSON Schema properties
        title: FallbackOptionalString(),
        multipleOf: FallbackOptionalNumber(),
        maximum: FallbackOptionalNumber(),
        exclusiveMaximum: FallbackOptionalBoolean(),
        minimum: FallbackOptionalNumber(),
        exclusiveMinimum: FallbackOptionalBoolean(),
        maxLength: FallbackOptionalInteger(),
        minLength: FallbackOptionalInteger(),
        pattern: FallbackOptionalString(),
        maxItems: FallbackOptionalInteger(),
        minItems: FallbackOptionalInteger(),
        uniqueItems: FallbackOptionalBoolean(),
        maxProperties: FallbackOptionalInteger(),
        minProperties: FallbackOptionalInteger(),
        required: FallbackOptionalArray(FallbackString("")),
        enum: Type.Optional(Type.Array(Type.Unknown())),

        // Modified JSON Schema properties - use SchemaOrRef for schema references
        type: FallbackOptionalString(),
        allOf: FallbackOptionalArray(SchemaOrRef),
        oneOf: FallbackOptionalArray(SchemaOrRef),
        anyOf: FallbackOptionalArray(SchemaOrRef),
        not: Type.Optional(SchemaOrRef),
        items: Type.Optional(SchemaOrRef),
        properties: FallbackOptionalRecord(Type.String(), SchemaOrRef),
        additionalProperties: FallbackOptionalBooleanOrSchema(SchemaOrRef),
        description: FallbackOptionalString(),
        format: FallbackOptionalString(),
        default: Type.Optional(Type.Unknown()),

        // OpenAPI-specific properties
        nullable: FallbackOptionalBoolean(),
        discriminator: Type.Optional(Discriminator),
        readOnly: FallbackOptionalBoolean(),
        writeOnly: FallbackOptionalBoolean(),
        xml: Type.Optional(XML),
        externalDocs: Type.Optional(ExternalDocumentation),
        example: Type.Optional(Type.Unknown()),
        deprecated: FallbackOptionalBoolean(),
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
  export const Encoding = FallbackObject(Type.Object({
    contentType: FallbackOptionalString(),
    // Note: headers will be defined with HeaderOrReference after Header is defined
    headers: FallbackOptionalRecord(
      Type.String(),
      Type.Union([Type.Unknown(), Reference])
    ),
    style: FallbackOptionalString(),
    explode: FallbackOptionalBoolean(),
    allowReserved: FallbackOptionalBoolean(),
  }));

  // MediaType Object
  export const MediaType = FallbackObject(Type.Object({
    schema: Type.Optional(SchemaOrReference),
    example: Type.Optional(Type.Unknown()),
    examples: FallbackOptionalRecord(Type.String(), ExampleOrReference),
    encoding: FallbackOptionalRecord(Type.String(), Encoding),
  }));

  // Header Object
  export const Header = FallbackObject(Type.Object({
    description: FallbackOptionalString(),
    required: FallbackOptionalBoolean(),
    deprecated: FallbackOptionalBoolean(),
    allowEmptyValue: FallbackOptionalBoolean(),
    style: FallbackOptionalString(),
    explode: FallbackOptionalBoolean(),
    allowReserved: FallbackOptionalBoolean(),
    schema: Type.Optional(SchemaOrReference),
    example: Type.Optional(Type.Unknown()),
    examples: FallbackOptionalRecord(Type.String(), ExampleOrReference),
    content: FallbackOptionalRecord(Type.String(), MediaType),
  }));

  const HeaderOrReference = Type.Union([Header, Reference]);

  // Link Object
  export const Link = FallbackObject(Type.Object({
    operationRef: FallbackOptionalString(),
    operationId: FallbackOptionalString(),
    parameters: FallbackOptionalRecord(Type.String(), Type.Unknown()),
    requestBody: Type.Optional(Type.Unknown()),
    description: FallbackOptionalString(),
    server: Type.Optional(Server),
  }));

  const LinkOrReference = Type.Union([Link, Reference]);

  // Response Object
  export const Response = FallbackObject(Type.Object({
    description: FallbackString(""),
    headers: FallbackOptionalRecord(Type.String(), HeaderOrReference),
    content: FallbackOptionalRecord(Type.String(), MediaType),
    links: FallbackOptionalRecord(Type.String(), LinkOrReference),
  }));

  const ResponseOrReference = Type.Union([Response, Reference]);

  // Parameter Object
  export const Parameter = FallbackObject(Type.Object({
    name: FallbackString(""),
    in: FallbackLiteralUnion(["query", "header", "path", "cookie"] as const),
    description: FallbackOptionalString(),
    required: FallbackOptionalBoolean(),
    deprecated: FallbackOptionalBoolean(),
    allowEmptyValue: FallbackOptionalBoolean(),
    style: FallbackOptionalString(),
    explode: FallbackOptionalBoolean(),
    allowReserved: FallbackOptionalBoolean(),
    schema: Type.Optional(SchemaOrReference),
    example: Type.Optional(Type.Unknown()),
    examples: FallbackOptionalRecord(Type.String(), ExampleOrReference),
    content: FallbackOptionalRecord(Type.String(), MediaType),
  }));

  const ParameterOrReference = Type.Union([Parameter, Reference]);

  // Request Body Object
  export const RequestBody = FallbackObject(Type.Object({
    description: FallbackOptionalString(),
    content: FallbackRecord(Type.String(), MediaType),
    required: FallbackOptionalBoolean(),
  }));

  const RequestBodyOrReference = Type.Union([RequestBody, Reference]);

  // Security Scheme Object
  export const SecurityScheme = FallbackObject(Type.Object({
    type: FallbackLiteralUnion([
      "apiKey",
      "http",
      "oauth2",
      "openIdConnect",
    ] as const),
    description: FallbackOptionalString(),
    name: FallbackOptionalString(),
    in: FallbackOptionalLiteralUnion([
      "query",
      "header",
      "cookie",
    ] as const),
    scheme: FallbackOptionalString(),
    bearerFormat: FallbackOptionalString(),
    flows: Type.Optional(OAuthFlows),
    openIdConnectUrl: FallbackOptionalString(),
  }));

  const SecuritySchemeOrReference = Type.Union([SecurityScheme, Reference]);

  // ===========================================================================
  // Layer 5: Operation-level types
  // ===========================================================================

  // Operation Object (forward declaration for PathItem)
  export const Operation = FallbackObject(Type.Object({
    tags: FallbackOptionalArray(FallbackString("")),
    summary: FallbackOptionalString(),
    description: FallbackOptionalString(),
    externalDocs: Type.Optional(ExternalDocumentation),
    operationId: FallbackOptionalString(),
    parameters: FallbackOptionalArray(ParameterOrReference),
    requestBody: Type.Optional(RequestBodyOrReference),
    responses: FallbackRecord(Type.String(), ResponseOrReference),
    // callbacks defined below after PathItem
    callbacks: FallbackOptionalRecord(Type.String(), Type.Unknown()),
    deprecated: FallbackOptionalBoolean(),
    security: FallbackOptionalArray(SecurityRequirement),
    servers: FallbackOptionalArray(Server),
  }));

  // Path Item Object
  export const PathItem = FallbackObject(Type.Object({
    summary: FallbackOptionalString(),
    description: FallbackOptionalString(),
    get: Type.Optional(Operation),
    put: Type.Optional(Operation),
    post: Type.Optional(Operation),
    delete: Type.Optional(Operation),
    options: Type.Optional(Operation),
    head: Type.Optional(Operation),
    patch: Type.Optional(Operation),
    trace: Type.Optional(Operation),
    servers: FallbackOptionalArray(Server),
    parameters: FallbackOptionalArray(ParameterOrReference),
  }));

  const PathItemOrReference = Type.Union([PathItem, Reference]);

  // Callback Object
  export const Callback = FallbackRecord(Type.String(), PathItemOrReference);

  const CallbackOrReference = Type.Union([Callback, Reference]);

  // ===========================================================================
  // Layer 6: Components
  // ===========================================================================

  // Components Object
  export const Components = FallbackObject(Type.Object({
    schemas: FallbackOptionalRecord(Type.String(), SchemaOrReference),
    responses: FallbackOptionalRecord(Type.String(), ResponseOrReference),
    parameters: FallbackOptionalRecord(Type.String(), ParameterOrReference),
    examples: FallbackOptionalRecord(Type.String(), ExampleOrReference),
    requestBodies: FallbackOptionalRecord(
      Type.String(),
      RequestBodyOrReference
    ),
    headers: FallbackOptionalRecord(Type.String(), HeaderOrReference),
    securitySchemes: FallbackOptionalRecord(
      Type.String(),
      SecuritySchemeOrReference
    ),
    links: FallbackOptionalRecord(Type.String(), LinkOrReference),
    callbacks: FallbackOptionalRecord(Type.String(), CallbackOrReference),
  }));

  // ===========================================================================
  // Layer 7: Top-level types
  // ===========================================================================

  // Tag Object
  export const Tag = FallbackObject(Type.Object({
    name: FallbackString(""),
    description: FallbackOptionalString(),
    externalDocs: Type.Optional(ExternalDocumentation),
  }));

  // Info Object
  export const Info = FallbackObject(Type.Object({
    title: FallbackString(""),
    description: FallbackOptionalString(),
    termsOfService: FallbackOptionalString(),
    contact: Type.Optional(Contact),
    license: Type.Optional(License),
    version: FallbackString("0.0.0"),
  }));

  // OpenAPI Document Object
  export const Document = FallbackObject(Type.Object({
    openapi: FallbackString("3.0.3"),
    info: Info,
    servers: FallbackOptionalArray(Server),
    paths: FallbackOptionalRecord(Type.String(), PathItemOrReference),
    components: FallbackOptionalObject(Components),
    security: FallbackOptionalArray(SecurityRequirement),
    tags: FallbackOptionalArray(Tag),
    externalDocs: Type.Optional(ExternalDocumentation),
  }));

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
