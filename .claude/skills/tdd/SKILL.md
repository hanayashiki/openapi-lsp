---
name: tdd
description: Test-Driven Development workflow for packages/server. Write failing test first, then implement the fix.
user_invocable: true
allowed_tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash(pnpm test *:*)
  - Bash(npm run test:*)
---

# TDD Workflow

This skill enforces Test-Driven Development for the `packages/server` package.

## Workflow

### 1. Red: Write a Failing Test First

Before writing any implementation code, create or update a test file in `packages/server/test/`:

```typescript
// Example test structure
import { describe, it, expect } from "vitest";
import dedent from "dedent";

describe("featureName", () => {
  it("should do the expected behavior", () => {
    // Arrange
    const input = ...;

    // Act
    const result = functionUnderTest(input);

    // Assert
    expect(result).toBe(expectedValue);
  });
});
```

Run the test to confirm it fails:
```bash
cd packages/server && pnpm test -- --run test/<test-file>.test.ts
```

**The test MUST fail before proceeding.** If it passes, the test is not testing new behavior.

### 2. Green: Write Minimal Implementation

Write the minimum code needed to make the test pass:
- Only implement what's required to pass the test
- Don't add extra features or optimizations
- Don't refactor yet

Run the test again:
```bash
cd packages/server && pnpm test -- --run test/<test-file>.test.ts
```

**The test MUST pass before proceeding.**

### 3. Refactor: Clean Up the Code

Now that tests are green, improve the code:
- Remove duplication
- Improve naming
- Simplify logic
- Ensure consistent style

Run tests after each refactoring step to ensure nothing breaks:
```bash
cd packages/server && pnpm test
```

## Test File Conventions

- Test files: `packages/server/test/*.test.ts`
- Use `vitest` with `describe`, `it`, `expect`
- Use `dedent` for multi-line string fixtures
- Import types from `@openapi-lsp/core/openapi`

## Example TDD Session

**Task:** Add validation for empty arrays

**Step 1 - Red:**
```typescript
it("should return error for empty array", () => {
  const result = validate([]);
  expect(result.ok).toBe(false);
  expect(result.error).toBe("Array cannot be empty");
});
```
Run test → FAIL ✗

**Step 2 - Green:**
```typescript
function validate(arr: unknown[]) {
  if (arr.length === 0) {
    return { ok: false, error: "Array cannot be empty" };
  }
  return { ok: true };
}
```
Run test → PASS ✓

**Step 3 - Refactor:**
```typescript
function validate(arr: unknown[]): Result<void, string> {
  if (arr.length === 0) {
    return Err("Array cannot be empty");
  }
  return Ok(undefined);
}
```
Run test → PASS ✓

## Running Tests

```bash
# Run specific test file
cd packages/server && pnpm test -- --run test/serializeSchema.test.ts

# Run all tests
npm run test

# Run tests in watch mode (during development)
cd packages/server && pnpm test
```
