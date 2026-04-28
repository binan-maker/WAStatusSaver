// Production-safe logger.
// In development builds (__DEV__ = true) every call maps to the real
// console method so Metro / Logcat output is unchanged.
// In release builds (__DEV__ = false) log/warn/debug are no-ops so that
// (a) sensitive debug strings never appear in production Logcat,
// (b) the JS engine doesn't spend time serialising large objects, and
// (c) we avoid the pathological "log buffer full" OEM bug on MIUI/HyperOS
//     where rapid console.log calls can briefly block the native bridge.
//
// error() always calls console.error so crash-reporting SDKs
// (Sentry / Crashlytics) can intercept it via their global override.

function noop(..._args: unknown[]): void {}

export const log: (...args: unknown[]) => void =
  __DEV__ ? (...args) => console.log(...args) : noop;

export const debug: (...args: unknown[]) => void =
  __DEV__ ? (...args) => console.log(...args) : noop;

export const warn: (...args: unknown[]) => void =
  __DEV__ ? (...args) => console.warn(...args) : noop;

export const error: (...args: unknown[]) => void =
  (...args) => console.error(...args);

const logger = { log, debug, warn, error };
export default logger;
