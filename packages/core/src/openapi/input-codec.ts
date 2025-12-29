// oxlint-disable typescript/no-explicit-any

import Type from "typebox";

// ===========================================================================
// Permissive Input Codecs
//
// These codecs accept Type.Unknown() as input and decode to sensible defaults
// if the value doesn't match the expected type. This makes the input schema
// maximally permissive - invalid values fallback to defaults instead of failing.
// ===========================================================================

// ---------------------------------------------------------------------------
// String codecs
// ---------------------------------------------------------------------------
export const FallbackString = (defaultValue: string) =>
  Type.Encode(Type.String(), (value): string =>
    typeof value === "string" ? value : defaultValue
  );

export const FallbackOptionalString = () =>
  Type.Encode(
    Type.Optional(Type.Union([Type.Undefined(), Type.String()])),
    (value) => (typeof value === "string" ? value : undefined)
  );

// ---------------------------------------------------------------------------
// Number codecs
// ---------------------------------------------------------------------------
export const FallbackNumber = (defaultValue: number) =>
  Type.Encode(Type.Number(), (value): number =>
    typeof value === "number" && !Number.isNaN(value) ? value : defaultValue
  );

export const FallbackOptionalNumber = () =>
  Type.Encode(
    Type.Optional(Type.Union([Type.Undefined(), Type.Number()])),
    (value) =>
      typeof value === "number" && !Number.isNaN(value) ? value : undefined
  );

// ---------------------------------------------------------------------------
// Integer codecs
// ---------------------------------------------------------------------------
export const FallbackInteger = (defaultValue: number) =>
  Type.Encode(Type.Integer(), (value): number =>
    typeof value === "number" && Number.isInteger(value) ? value : defaultValue
  );

export const FallbackOptionalInteger = () =>
  Type.Encode(
    Type.Optional(Type.Union([Type.Undefined(), Type.Integer()])),
    (value) =>
      typeof value === "number" && Number.isInteger(value) ? value : undefined
  );

// ---------------------------------------------------------------------------
// Boolean codecs
// ---------------------------------------------------------------------------
export const FallbackBoolean = (defaultValue: boolean) =>
  Type.Encode(Type.Boolean(), (value): boolean =>
    typeof value === "boolean" ? value : defaultValue
  );

export const FallbackOptionalBoolean = () =>
  Type.Encode(
    Type.Optional(Type.Union([Type.Undefined(), Type.Boolean()])),
    (value) => (typeof value === "boolean" ? value : undefined)
  );

// ---------------------------------------------------------------------------
// Literal union codecs
// ---------------------------------------------------------------------------
// Helper function to check if value is in literals array
function isInLiterals(literals: readonly string[], value: unknown): boolean {
  return typeof value === "string" && literals.includes(value);
}

export function FallbackLiteralUnion<const T extends readonly string[]>(
  literals: T
) {
  return Type.Encode(
    Type.Union(literals.map((l) => Type.Literal(l))),
    ((value: unknown): T[number] =>
      isInLiterals(literals, value) ? (value as T[number]) : literals[0]) as any
  );
}

export function FallbackOptionalLiteralUnion<const T extends readonly string[]>(
  literals: T
) {
  return Type.Encode(
    Type.Optional(
      Type.Union([Type.Undefined(), ...literals.map((l) => Type.Literal(l))])
    ),
    ((value: unknown): T[number] | undefined =>
      isInLiterals(literals, value) ? (value as T[number]) : undefined) as any
  );
}

// ---------------------------------------------------------------------------
// Array codecs
// ---------------------------------------------------------------------------
export const FallbackArray = <T extends Type.TSchema>(itemSchema: T) =>
  Type.Encode(Type.Array(itemSchema), (value) =>
    Array.isArray(value) ? value : []
  ) as unknown as Type.TArray<T>;

export const FallbackOptionalArray = <T extends Type.TSchema>(itemSchema: T) =>
  Type.Encode(
    Type.Optional(Type.Union([Type.Undefined(), Type.Array(itemSchema)])),
    (value) => (Array.isArray(value) ? value : undefined)
  ) as unknown as Type.TOptional<Type.TArray<T>>;

// ---------------------------------------------------------------------------
// Record codecs
// ---------------------------------------------------------------------------
function isPlainObject(value: unknown): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Return type uses ReturnType to get the actual type from Type.Record
export function FallbackRecord<
  K extends Type.TString | Type.TTemplateLiteral,
  V extends Type.TSchema
>(keySchema: K, valueSchema: V) {
  const recordType = Type.Record(keySchema, valueSchema);
  return Type.Encode(
    recordType,
    ((value: unknown) => (isPlainObject(value) ? value : {})) as any
  ) as unknown as typeof recordType;
}

export function FallbackOptionalRecord<
  K extends Type.TString | Type.TTemplateLiteral,
  V extends Type.TSchema
>(keySchema: K, valueSchema: V) {
  const recordType = Type.Record(keySchema, valueSchema);
  return Type.Encode(
    Type.Optional(Type.Union([Type.Undefined(), recordType])),
    ((value: unknown) => (isPlainObject(value) ? value : undefined)) as any
  ) as unknown as Type.TOptional<typeof recordType>;
}

// ---------------------------------------------------------------------------
// Object codecs
// ---------------------------------------------------------------------------

export function FallbackObject<T extends Type.TObject>(schema: T): T {
  return Type.Encode(
    schema,
    ((value: unknown) => (isPlainObject(value) ? value : {})) as any
  ) as unknown as T;
}

export function FallbackOptionalObject<T extends Type.TObject>(
  schema: T
): Type.TOptional<T> {
  return Type.Encode(
    Type.Optional(Type.Union([Type.Undefined(), schema])),
    ((value: unknown) => (isPlainObject(value) ? value : undefined)) as any
  ) as unknown as Type.TOptional<T>;
}

// ---------------------------------------------------------------------------
// Special union codecs
// ---------------------------------------------------------------------------

// For additionalProperties: Type.Union([Type.Boolean(), Schema])
export function FallbackOptionalBooleanOrSchema<T extends Type.TSchema>(
  schemaRef: T
) {
  return Type.Encode(
    Type.Optional(Type.Union([Type.Undefined(), Type.Boolean(), schemaRef])),
    (value): boolean | Type.Static<T> | undefined => {
      if (value === undefined || value === null) return undefined;
      if (typeof value === "boolean") return value;
      if (typeof value === "object") return value as Type.Static<T>;
      return undefined;
    }
  ) as unknown as Type.TOptional<Type.TUnion<[Type.TBoolean, T]>>;
}
