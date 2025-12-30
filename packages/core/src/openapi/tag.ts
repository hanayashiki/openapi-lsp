import Type from "typebox";

export const OpenAPITag = Type.Union([
  Type.Literal("Reference"),
  Type.Literal("ExternalDocumentation"),
  Type.Literal("XML"),
  Type.Literal("Discriminator"),
  Type.Literal("Schema"),
  Type.Literal("MediaType"),
  Type.Literal("Example"),
  Type.Literal("Encoding"),
  Type.Literal("Header"),
  Type.Literal("Link"),
  Type.Literal("Server"),
  Type.Literal("ServerVariable"),
  Type.Literal("Response"),
  Type.Literal("Parameter"),
  Type.Literal("RequestBody"),
  Type.Literal("Callback"),
  Type.Literal("SecurityRequirement"),
  Type.Literal("Operation"),
  Type.Literal("PathItem"),
  Type.Literal("SecurityScheme"),
  Type.Literal("OAuthFlows"),
  Type.Literal("OAuthFlow"),
  Type.Literal("Components"),
  Type.Literal("Tag"),
  Type.Literal("Contact"),
  Type.Literal("License"),
  Type.Literal("Info"),
  Type.Literal("Document"),
]);

export type OpenAPITag = Type.Static<typeof OpenAPITag>;

export type TaggedMetadata = {
  tag: OpenAPITag;
};

const tagStorage = new WeakMap<object, OpenAPITag>();

export const TaggedObject = <T extends Type.TObject>(
  schema: T,
  tag: OpenAPITag
): T => {
  return Type.Decode(schema, (value) => {
    tagStorage.set(value as object, tag);
    return value;
  }) as any as T;
};

export const getOpenAPITag = (obj: object): OpenAPITag | undefined => {
  return tagStorage.get(obj);
};
