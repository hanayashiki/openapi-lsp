import { getOpenAPITag } from "./tag.js";
import { OpenAPI } from "./types.js";

// Type guards for OpenAPI tagged objects

export const isReference = (obj: object): obj is OpenAPI.Reference =>
  getOpenAPITag(obj) === "Reference";

export const isExternalDocumentation = (
  obj: object
): obj is OpenAPI.ExternalDocumentation =>
  getOpenAPITag(obj) === "ExternalDocumentation";

export const isXML = (obj: object): obj is OpenAPI.XML =>
  getOpenAPITag(obj) === "XML";

export const isDiscriminator = (obj: object): obj is OpenAPI.Discriminator =>
  getOpenAPITag(obj) === "Discriminator";

export const isSchema = (obj: object): obj is OpenAPI.Schema =>
  getOpenAPITag(obj) === "Schema";

export const isMediaType = (obj: object): obj is OpenAPI.MediaType =>
  getOpenAPITag(obj) === "MediaType";

export const isContent = (obj: object): obj is OpenAPI.Content =>
  getOpenAPITag(obj) === "Content";

export const isExample = (obj: object): obj is OpenAPI.Example =>
  getOpenAPITag(obj) === "Example";

export const isEncoding = (obj: object): obj is OpenAPI.Encoding =>
  getOpenAPITag(obj) === "Encoding";

export const isHeader = (obj: object): obj is OpenAPI.Header =>
  getOpenAPITag(obj) === "Header";

export const isLink = (obj: object): obj is OpenAPI.Link =>
  getOpenAPITag(obj) === "Link";

export const isServer = (obj: object): obj is OpenAPI.Server =>
  getOpenAPITag(obj) === "Server";

export const isServerVariable = (obj: object): obj is OpenAPI.ServerVariable =>
  getOpenAPITag(obj) === "ServerVariable";

export const isResponse = (obj: object): obj is OpenAPI.Response =>
  getOpenAPITag(obj) === "Response";

export const isParameter = (obj: object): obj is OpenAPI.Parameter =>
  getOpenAPITag(obj) === "Parameter";

export const isRequestBody = (obj: object): obj is OpenAPI.RequestBody =>
  getOpenAPITag(obj) === "RequestBody";

export const isCallback = (obj: object): obj is OpenAPI.Callback =>
  getOpenAPITag(obj) === "Callback";

export const isSecurityRequirement = (
  obj: object
): obj is OpenAPI.SecurityRequirement =>
  getOpenAPITag(obj) === "SecurityRequirement";

export const isOperation = (obj: object): obj is OpenAPI.Operation =>
  getOpenAPITag(obj) === "Operation";

export const isPathItem = (obj: object): obj is OpenAPI.PathItem =>
  getOpenAPITag(obj) === "PathItem";

export const isSecurityScheme = (obj: object): obj is OpenAPI.SecurityScheme =>
  getOpenAPITag(obj) === "SecurityScheme";

export const isOAuthFlows = (obj: object): obj is OpenAPI.OAuthFlows =>
  getOpenAPITag(obj) === "OAuthFlows";

export const isOAuthFlow = (obj: object): obj is OpenAPI.OAuthFlow =>
  getOpenAPITag(obj) === "OAuthFlow";

export const isComponents = (obj: object): obj is OpenAPI.Components =>
  getOpenAPITag(obj) === "Components";

export const isTag = (obj: object): obj is OpenAPI.Tag =>
  getOpenAPITag(obj) === "Tag";

export const isContact = (obj: object): obj is OpenAPI.Contact =>
  getOpenAPITag(obj) === "Contact";

export const isLicense = (obj: object): obj is OpenAPI.License =>
  getOpenAPITag(obj) === "License";

export const isInfo = (obj: object): obj is OpenAPI.Info =>
  getOpenAPITag(obj) === "Info";

export const isDocument = (obj: object): obj is OpenAPI.Document =>
  getOpenAPITag(obj) === "Document";
