"use client";

import { useParams } from "next/navigation";
import { AdminTenantFrame } from "@/components/app/AdminTenant";
import { KnowledgeManager } from "@/components/app/KnowledgeManager";

export default function AdminKnowledgePage() {
  const { slug } = useParams<{ slug: string }>();
  return <AdminTenantFrame slug={slug}>{(tenant) => <KnowledgeManager tenantId={tenant.id} />}</AdminTenantFrame>;
}
