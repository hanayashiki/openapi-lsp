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

const tagStorage = new WeakMap<object, Set<OpenAPITag>>();

const addTag = (obj: object, tag: OpenAPITag): void => {
  const existing = tagStorage.get(obj);
  if (existing) {
    existing.add(tag);
  } else {
    tagStorage.set(obj, new Set([tag]));
  }
};

export const TaggedObject = <T extends core.$ZodLooseShape>(
  shape: T,
  tag: OpenAPITag
): ZodObject<util.Writeable<T>, core.$strip> => {
  return z.object(shape).transform((value) => {
    addTag(value, tag);
    return value;
  }) as never;
};

export const TaggedRecord = <T extends core.SomeType>(
  value: T,
  tag: OpenAPITag,
): ZodRecord<ZodString, T> => {
  return z.record(z.string(), value).transform((value) => {
    addTag(value, tag);
    return value;
  }) as never;
};

export const hasOpenAPITag = (obj: object, tag: OpenAPITag): boolean => {
  return tagStorage.get(obj)?.has(tag) ?? false;
};

export const getOpenAPITags = (obj: object): OpenAPITag[] => {
  const tags = tagStorage.get(obj);
  return tags ? [...tags] : [];
};

// Helper for manually tagging objects (used for recursive types with z.lazy)
export const setOpenAPITag = (obj: object, tag: OpenAPITag): void => {
  addTag(obj, tag);
};
