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
  "Responses",
  "Parameter",
  "Parameters",
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

const addTag = (obj: object, tag: OpenAPITag): void => {
  tagStorage.set(obj, tag);
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

/**
 * Like TaggedObject but with a fallback value for lenient parsing.
 * Tags both successful parses and fallback values.
 */
export const TaggedObjectCatch = <T extends core.$ZodLooseShape>(
  shape: T,
  tag: OpenAPITag,
  fallback: z.infer<ZodObject<util.Writeable<T>>>
): ZodObject<util.Writeable<T>, core.$strip> => {
  return z
    .object(shape)
    .transform((value) => {
      addTag(value, tag);
      return value;
    })
    .catch((() => {
      const result = { ...fallback };
      addTag(result, tag);
      return result;
    }) as never) as never;
};

export const TaggedRecord = <T extends core.SomeType>(
  value: T,
  tag: OpenAPITag
): ZodRecord<ZodString, T> => {
  return z.record(z.string(), value).transform((value) => {
    addTag(value, tag);
    return value;
  }) as never;
};

export const TaggedArray = <T extends core.SomeType>(
  item: T,
  tag: OpenAPITag
): z.ZodArray<T> => {
  return z.array(item).transform((value) => {
    addTag(value, tag);
    return value;
  }) as never;
};

export const hasOpenAPITag = (obj: object, tag: OpenAPITag): boolean => {
  return tagStorage.get(obj) === tag;
};

export const getOpenAPITag = (obj: object): OpenAPITag | undefined => {
  return tagStorage.get(obj);
};

// Helper for manually tagging objects (used for recursive types with z.lazy)
export const setOpenAPITag = (obj: object, tag: OpenAPITag): void => {
  addTag(obj, tag);
};

// ------------------------------------------------------------------------------
// Reference Nominal Storage
// ------------------------------------------------------------------------------

/**
 * Storage for Reference nominal associations.
 * Maps a Reference object to the OpenAPI node type it expects from its target.
 *
 * For example, a Reference in `components.schemas` expects a "Schema" nominal,
 * while a Reference in `components.responses` expects a "Response" nominal.
 */
const referenceNominalStorage = new WeakMap<object, OpenAPITag>();

export const setReferenceNominal = (ref: object, nominal: OpenAPITag): void => {
  referenceNominalStorage.set(ref, nominal);
};

export const getReferenceNominal = (ref: object): OpenAPITag | undefined => {
  return referenceNominalStorage.get(ref);
};

/**
 * Creates a Reference schema that expects a specific OpenAPI node type.
 * The nominal is stored in referenceNominalStorage when parsed.
 *
 * Usage: `z.union([TaggedReference("Schema"), Schema])` instead of
 *        `z.union([Reference, Schema])`
 */
export const TaggedReference = (nominal: OpenAPITag) => {
  return z
    .object({
      $ref: z.string(),
    })
    .transform((value) => {
      addTag(value, "Reference");
      setReferenceNominal(value, nominal);
      return value;
    });
};
