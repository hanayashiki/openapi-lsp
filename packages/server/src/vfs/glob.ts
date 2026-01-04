import { minimatch } from "minimatch";
import { GlobOptions } from "./VFS.js";

/**
 * Check if a file path matches glob patterns with options.
 * @param filePath - Absolute file path to check
 * @param patterns - Glob patterns to match against
 * @param options - Glob options (cwd, exclude)
 * @returns true if the file matches patterns and is not excluded
 */
export function matchPathWithGlob(
  filePath: string,
  patterns: string[],
  options: GlobOptions
): boolean {
  // Determine the path to match against
  let matchPath: string;
  if (options.cwd === "" || options.cwd === "/") {
    // Match against full path (workspace-less mode)
    matchPath = filePath;
  } else {
    const cwd = options.cwd.endsWith("/") ? options.cwd : options.cwd + "/";
    // Must be inside cwd
    if (!filePath.startsWith(cwd)) {
      return false;
    }
    matchPath = filePath.slice(cwd.length);
  }

  // Check exclude patterns
  const excludePatterns = options.exclude ?? [];
  if (excludePatterns.some((p) => minimatch(matchPath, p))) {
    return false;
  }

  // Check include patterns
  return patterns.some((p) => minimatch(matchPath, p));
}
