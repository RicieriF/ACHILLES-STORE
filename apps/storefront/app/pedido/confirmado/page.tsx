import { Suspense } from "react";
import { ConfirmationClient } from "./confirmation-client";
export default function ConfirmedPage() {
  return (
    <Suspense fallback={<p>Carregando confirmação…</p>}>
      <ConfirmationClient />
    </Suspense>
  );
}
