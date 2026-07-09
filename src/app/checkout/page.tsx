import { validateSession } from "@/lib/auth/session";
import CheckoutClient from "./CheckoutClient";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  // Guest checkout is allowed — the client shows name/email fields when there
  // is no session. We pass a minimal, serializable user (or null).
  const sessionResult = await validateSession();
  const user = sessionResult
    ? { id: sessionResult.user.id, name: sessionResult.user.name, email: sessionResult.user.email }
    : null;

  return <CheckoutClient user={user} />;
}
