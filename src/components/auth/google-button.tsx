import { signInWithGoogle } from "@/app/auth/actions";

/** Google's multicolour "G" mark (inline so no third-party request is needed and the CSP stays strict). */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.3 0 11.7-2.1 15.6-5.7l-7.5-5.8c-2.1 1.4-4.8 2.3-8.1 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

/**
 * "Continue with Google". A real server-action form: the visitor's intent (host/customer) and destination travel to the server,
 * which keeps them in an httpOnly cookie; nothing about roles is put in the redirect URL.
 */
export function GoogleButton({ intent, next, label = "Continue with Google" }: { intent: "host" | "customer"; next?: string; label?: string }) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="intent" value={intent} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <button
        type="submit"
        className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-full border border-forest-900/20 bg-white px-6 text-sm font-medium text-forest-950 transition-colors hover:bg-forest-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-forest-500/40"
      >
        <GoogleMark />
        {label}
      </button>
    </form>
  );
}

export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-ink/45" role="separator" aria-label="or">
      <span className="h-px flex-1 bg-forest-900/10" /> or <span className="h-px flex-1 bg-forest-900/10" />
    </div>
  );
}
