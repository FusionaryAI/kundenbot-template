"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingRows } from "@/components/ui/States";
import { KnowledgeManager } from "@/components/app/KnowledgeManager";

function Knowledge() {
  const { tenant } = useAuth();
  const prefill = useSearchParams().get("frage");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Wissen"
        description="Alles, was der Assistent über Ihr Unternehmen weiß. Neue Einträge gelten sofort im Chat."
      />
      {tenant ? <KnowledgeManager key={prefill ?? ""} tenantId={tenant.id} prefillQuestion={prefill} /> : <LoadingRows rows={5} />}
    </div>
  );
}

export default function KnowledgePage() {
  return (
    <Suspense fallback={<LoadingRows rows={5} />}>
      <Knowledge />
    </Suspense>
  );
}
