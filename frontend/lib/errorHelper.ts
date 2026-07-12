export function normalizeError(err: unknown): string {
  if (!err) return "Unknown error occurred";
  
  if (typeof err === "string") return err.trim();
  
  if (err instanceof Error) {
    // Some frameworks put object details into Error.message stringified, or Error itself might have them
    return err.message || "Unknown Error";
  }

  if (typeof err === "object" && err !== null) {
    const obj = err as Record<string, unknown>;

    if (typeof obj.message === "string") return obj.message.trim();
    if (typeof obj.msg === "string") return obj.msg.trim();
    if (typeof obj.detail === "string") return obj.detail.trim();
    
    if (obj.detail && typeof obj.detail === "object") {
      if (Array.isArray(obj.detail)) {
        const firstErr = obj.detail[0];
        if (firstErr && typeof firstErr === "object" && firstErr !== null) {
          const errObj = firstErr as Record<string, unknown>;
          if (typeof errObj.msg === "string") {
            const loc = Array.isArray(errObj.loc) ? errObj.loc.join(".") : "";
            return loc ? `${loc}: ${errObj.msg}` : errObj.msg;
          }
        }
      }
      return normalizeError(obj.detail);
    }
    
    if (obj.error) {
      if (typeof obj.error === "string") return obj.error.trim();
      if (typeof obj.error === "object") return normalizeError(obj.error);
    }

    try {
      return JSON.stringify(err);
    } catch {
      return "[Unstringifiable Error Object]";
    }
  }

  return String(err);
}
