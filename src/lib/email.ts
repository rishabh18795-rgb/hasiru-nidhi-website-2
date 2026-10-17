import "server-only";

export type EmailStatus = "sent" | "skipped_not_configured" | "failed";
export interface EmailResult {
  status: EmailStatus;
  error?: string;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

/**
 * Sends a transactional e-mail through Resend (https://resend.com) when RESEND_API_KEY and
 * EMAIL_FROM are set. When they are not, it returns `skipped_not_configured` — it NEVER reports
 * a delivery that did not happen. Callers must not block the user's action on the result.
 */
export async function sendEmail(input: { to: string | string[]; subject: string; text: string }): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!key || !from) return { status: "skipped_not_configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: input.to, subject: input.subject, text: input.text }),
    });
    if (!res.ok) {
      return { status: "failed", error: `Email provider responded ${res.status}` };
    }
    return { status: "sent" };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : "unknown error" };
  }
}

export function adminNotifyEmail(): string | null {
  return process.env.ADMIN_NOTIFY_EMAIL?.trim() || null;
}
