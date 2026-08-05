import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getErrorMessage(err: unknown): string {
  if (err == null) return "Something went wrong";
  if (typeof err === "string") return err;
  if (err instanceof Error) {
    // For Axios errors, check the message structure
    if ("response" in err) {
      const axiosErr = err as Record<string, unknown>;
      const resp = axiosErr.response as Record<string, unknown> | undefined;

      if (resp?.data) {
        const data = resp.data as Record<string, unknown>;
        const msg = data.message ?? data.error ?? data.msg;
        if (typeof msg === "string" && msg.trim()) return msg;
      }
    }
    return err.message;
  }
  if (typeof err === "object") {
    const obj = err as Record<string, unknown>;

    // Try to get error message from Axios response
    const resp = obj.response as Record<string, unknown> | undefined;
    if (resp) {
      const data = resp.data as Record<string, unknown> | undefined;
      if (data) {
        // Check common error response fields
        const msg = data.message ?? data.error ?? data.msg;
        if (typeof msg === "string" && msg.trim()) return msg;
      }
      // Try status text as fallback
      const statusText = resp.statusText as string | undefined;
      if (statusText && statusText.trim()) return statusText;
    }

    // Try direct message field
    const msg = obj.message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return "Something went wrong";
}
