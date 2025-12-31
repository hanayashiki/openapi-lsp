import { hasOpenAPITag } from "./tag.js";
import { OpenAPI } from "./types.js";

// Type guards for OpenAPI tagged objects

export const isReference = (obj: object): obj is OpenAPI.Reference =>
  hasOpenAPITag(obj, "Reference");

export const isExternalDocumentation = (
  obj: object
): obj is OpenAPI.ExternalDocumentation =>
  hasOpenAPITag(obj, "ExternalDocumentation");

export const isXML = (obj: object): obj is OpenAPI.XML =>
  hasOpenAPITag(obj, "XML");

export const isDiscriminator = (obj: object): obj is OpenAPI.Discriminator =>
  hasOpenAPITag(obj, "Discriminator");

export const isSchema = (obj: object): obj is OpenAPI.Schema =>
  hasOpenAPITag(obj, "Schema");

export const isMediaType = (obj: object): obj is OpenAPI.MediaType =>
  hasOpenAPITag(obj, "MediaType");

export const isContent = (obj: object): obj is OpenAPI.Content =>
  hasOpenAPITag(obj, "Content");

export const isExample = (obj: object): obj is OpenAPI.Example =>
  hasOpenAPITag(obj, "Example");

export const isEncoding = (obj: object): obj is OpenAPI.Encoding =>
  hasOpenAPITag(obj, "Encoding");

export const isHeader = (obj: object): obj is OpenAPI.Header =>
  hasOpenAPITag(obj, "Header");

export const isLink = (obj: object): obj is OpenAPI.Link =>
  hasOpenAPITag(obj, "Link");

export const isServer = (obj: object): obj is OpenAPI.Server =>
  hasOpenAPITag(obj, "Server");

export const isServerVariable = (obj: object): obj is OpenAPI.ServerVariable =>
  hasOpenAPITag(obj, "ServerVariable");

export const isResponse = (obj: object): obj is OpenAPI.Response =>
  hasOpenAPITag(obj, "Response");

export const isParameter = (obj: object): obj is OpenAPI.Parameter =>
  hasOpenAPITag(obj, "Parameter");

export const isRequestBody = (obj: object): obj is OpenAPI.RequestBody =>
  hasOpenAPITag(obj, "RequestBody");

export const isCallback = (obj: object): obj is OpenAPI.Callback =>
  hasOpenAPITag(obj, "Callback");

export const isSecurityRequirement = (
  obj: object
): obj is OpenAPI.SecurityRequirement =>
  hasOpenAPITag(obj, "SecurityRequirement");

export const isOperation = (obj: object): obj is OpenAPI.Operation =>
  hasOpenAPITag(obj, "Operation");

export const isPathItem = (obj: object): obj is OpenAPI.PathItem =>
  hasOpenAPITag(obj, "PathItem");

export const isSecurityScheme = (obj: object): obj is OpenAPI.SecurityScheme =>
  hasOpenAPITag(obj, "SecurityScheme");

export const isOAuthFlows = (obj: object): obj is OpenAPI.OAuthFlows =>
  hasOpenAPITag(obj, "OAuthFlows");

export const isOAuthFlow = (obj: object): obj is OpenAPI.OAuthFlow =>
  hasOpenAPITag(obj, "OAuthFlow");

export const isComponents = (obj: object): obj is OpenAPI.Components =>
  hasOpenAPITag(obj, "Components");

export const isTag = (obj: object): obj is OpenAPI.Tag =>
  hasOpenAPITag(obj, "Tag");

export const isContact = (obj: object): obj is OpenAPI.Contact =>
  hasOpenAPITag(obj, "Contact");

export const isLicense = (obj: object): obj is OpenAPI.License =>
  hasOpenAPITag(obj, "License");

export const isInfo = (obj: object): obj is OpenAPI.Info =>
  hasOpenAPITag(obj, "Info");

export const isDocument = (obj: object): obj is OpenAPI.Document =>
  hasOpenAPITag(obj, "Document");
