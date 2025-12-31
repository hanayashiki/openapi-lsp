import picomatch from "picomatch";

export const openapiFilePatterns = [
  "*.openapi.yml",
  "*.openapi.yaml",
  "openapi.yml",
  "openapi.yaml",
];

export const componentFilePatterns = ["*.json", "*.yml", "*.yaml"];

const isOpenapiFileMatcher = picomatch(openapiFilePatterns);
const isComponentFileMatcher = picomatch(componentFilePatterns);

export function isOpenapiFile(filename: string): boolean {
  return isOpenapiFileMatcher(filename);
}

export function isComponentFile(filename: string): boolean {
  return isComponentFileMatcher(filename);
}
