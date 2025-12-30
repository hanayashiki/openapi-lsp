import { core, z, ZodObject, ZodRecord, ZodString } from "zod";
import { util } from "zod/v4/core";

export const OpenAPITag = z.enum([
  "Reference",
  "ExternalDocumentation",
  "XML",
  "Discriminator",
  "Schema",
  "MediaType",
  "Content",
  "Example",
  "Encoding",
  "Header",
  "Link",
  "Server",
  "ServerVariable",
  "Response",
  "Parameter",
  "RequestBody",
  "Callback",
  "SecurityRequirement",
  "Operation",
  "PathItem",
  "SecurityScheme",
  "OAuthFlows",
  "OAuthFlow",
  "Components",
  "Tag",
  "Contact",
  "License",
  "Info",
  "Document",
]);

export type OpenAPITag = z.infer<typeof OpenAPITag>;

const tagStorage = new WeakMap<object, OpenAPITag>();

export const TaggedObject = <T extends core.$ZodLooseShape>(
  shape: T,
  tag: OpenAPITag
): ZodObject<util.Writeable<T>, core.$strip> => {
  return z.object(shape).transform((value) => {
    tagStorage.set(value, tag);
    return value;
  }) as never;
};

export const TaggedRecord = <T extends core.SomeType>(
  value: T,
  tag: OpenAPITag,
): ZodRecord<ZodString, T> => {
  return z.record(z.string(), value).transform((value) => {
    tagStorage.set(value, tag);
    return value;
  }) as never;
};

export const getOpenAPITag = (obj: object): OpenAPITag | undefined => {
  return tagStorage.get(obj);
};

// Helper for manually tagging objects (used for recursive types with z.lazy)
export const setOpenAPITag = (obj: object, tag: OpenAPITag): void => {
  tagStorage.set(obj, tag);
};
