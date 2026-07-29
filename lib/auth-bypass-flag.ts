export function isAuthBypassEnabled(): boolean {
  return (
    process.env.AUTH_BYPASS === "true" &&
    process.env.NODE_ENV !== "production"
  );
}
