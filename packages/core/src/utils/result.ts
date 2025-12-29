export type Result<T, E> =
  | { success: true; data: T }
  | { success: false; error: E };

export const ok = <T, E = never>(data: T): Result<T, E> => ({
  success: true,
  data,
});

export const err = <E, T = never>(error: E): Result<T, E> => ({
  success: false,
  error,
});

export type AndThenReturn<T1, T2, E> = (data: Result<T1, E>) => Result<T2, E>;

export const andThen = <T1, T2, E>(
  fn: (data: T1) => Result<T2, E>
): AndThenReturn<T1, T2, E> => {
  return (data) => {
    if (data.success) {
      return fn(data.data);
    }
    return data;
  };
};

export type Option<T> = Result<T, undefined>;

export const some = <T>(data: T): Option<T> => ok(data);

const NONE = Object.freeze(err(undefined));

export const none = <T>(): Option<T> => NONE;

/**
 * Converts an Option<T> to T | undefined.
 * Returns the unwrapped value if Some, or undefined if None.
 */
export const flattenOption = <T>(option: Option<T>): T | undefined => {
  if (option.success) return option.data;
  return undefined;
};
