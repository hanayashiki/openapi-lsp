/**
 * ECMAScript Identifier Parser
 *
 * Implements identifier validation and transformation per ECMAScript specification.
 * Uses Unicode property escapes for full spec compliance.
 *
 * @see https://tc39.es/ecma262/multipage/ecmascript-language-lexical-grammar.html
 */

// =============================================================================
// Constants - Unicode property escape patterns (requires /u flag)
// =============================================================================

/**
 * Pattern matching valid identifier start characters.
 * Matches: $ | _ | \p{ID_Start}
 */
export const ID_START_PATTERN = /[$_\p{ID_Start}]/u;

/**
 * Pattern matching valid identifier continuation characters.
 * Matches: $ | \p{ID_Continue}
 * Note: _ is included in ID_Continue, and ZWNJ/ZWJ (\u200C, \u200D) are technically
 * allowed but rarely used in practice.
 */
export const ID_CONTINUE_PATTERN = /[$\p{ID_Continue}]/u;

/**
 * Pattern matching a complete valid identifier.
 * Anchored to match entire string.
 */
export const IDENTIFIER_PATTERN = /^[$_\p{ID_Start}][$\p{ID_Continue}]*$/u;

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Check if a string is a valid ECMAScript identifier.
 *
 * @param str - The string to validate
 * @returns true if the string is a valid identifier
 *
 * @example
 * isValidIdentifier("foo")     // true
 * isValidIdentifier("_bar")    // true
 * isValidIdentifier("$baz")    // true
 * isValidIdentifier("变量")     // true
 * isValidIdentifier("123abc")  // false
 * isValidIdentifier("foo-bar") // false
 */
export function isValidIdentifier(str: string): boolean {
  if (str.length === 0) return false;
  return IDENTIFIER_PATTERN.test(str);
}

/**
 * Check if a character can start an identifier.
 *
 * @param char - A single character (or first code point of string)
 * @returns true if the character is valid at identifier start position
 *
 * @example
 * isIdentifierStart("a")  // true
 * isIdentifierStart("_")  // true
 * isIdentifierStart("$")  // true
 * isIdentifierStart("π")  // true
 * isIdentifierStart("1")  // false
 * isIdentifierStart("-")  // false
 */
export function isIdentifierStart(char: string): boolean {
  if (char.length === 0) return false;
  // Extract first code point (handles surrogate pairs)
  const codePoint = char.codePointAt(0);
  if (codePoint === undefined) return false;
  const firstChar = String.fromCodePoint(codePoint);
  return ID_START_PATTERN.test(firstChar);
}

/**
 * Check if a character can continue an identifier (non-first position).
 *
 * @param char - A single character (or first code point of string)
 * @returns true if the character is valid at identifier continuation position
 *
 * @example
 * isIdentifierPart("a")  // true
 * isIdentifierPart("1")  // true
 * isIdentifierPart("_")  // true
 * isIdentifierPart("$")  // true
 * isIdentifierPart("-")  // false
 * isIdentifierPart(".")  // false
 */
export function isIdentifierPart(char: string): boolean {
  if (char.length === 0) return false;
  // Extract first code point (handles surrogate pairs)
  const codePoint = char.codePointAt(0);
  if (codePoint === undefined) return false;
  const firstChar = String.fromCodePoint(codePoint);
  return ID_CONTINUE_PATTERN.test(firstChar);
}

// =============================================================================
// Transformation Functions
// =============================================================================

/**
 * Transform a string into a valid ECMAScript identifier.
 *
 * - Empty string becomes "_"
 * - Leading digits are prefixed with "_"
 * - Invalid characters are replaced with "_"
 * - Consecutive underscores from replacements are preserved (no collapsing)
 *
 * @param input - The input string to transform
 * @returns A valid identifier
 *
 * @example
 * trimToIdentifier("foo")       // "foo"
 * trimToIdentifier("foo-bar")   // "foo_bar"
 * trimToIdentifier("123abc")    // "_123abc"
 * trimToIdentifier("foo.bar")   // "foo_bar"
 * trimToIdentifier("")          // "_"
 * trimToIdentifier("---")       // "___"
 * trimToIdentifier("变量")       // "变量"
 */
export function trimToIdentifier(input: string): string {
  if (input.length === 0) return "_";

  // Iterate using code points to handle surrogate pairs correctly
  const codePoints = [...input];
  if (codePoints.length === 0) return "_";

  const result: string[] = [];

  for (let i = 0; i < codePoints.length; i++) {
    const char = codePoints[i]!;

    if (i === 0) {
      // First character must be identifier start
      if (isIdentifierStart(char)) {
        result.push(char);
      } else if (isIdentifierPart(char)) {
        // Valid continuation but not start (e.g., digit) - prefix with underscore
        result.push("_", char);
      } else {
        // Invalid character - replace with underscore
        result.push("_");
      }
    } else {
      // Continuation characters
      if (isIdentifierPart(char)) {
        result.push(char);
      } else {
        // Invalid character - replace with underscore
        result.push("_");
      }
    }
  }

  return result.join("");
}
