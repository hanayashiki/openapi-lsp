import { minimatch } from "minimatch";

export const openapiFilePatterns = [
  "*.openapi.yml",
  "*.openapi.yaml",
  "openapi.yml",
  "openapi.yaml",
];

export const componentFilePatterns = ["*.json", "*.yml", "*.yaml"];

function matchesAny(filename: string, patterns: string[]): boolean {
  return patterns.some((pattern) => minimatch(filename, pattern));
}

export function isOpenapiFile(filename: string): boolean {
  return matchesAny(filename, openapiFilePatterns);
}

export function isComponentFile(filename: string): boolean {
  return matchesAny(filename, componentFilePatterns);
}
