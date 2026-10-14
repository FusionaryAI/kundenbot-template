"use client";

import { useParams } from "next/navigation";
import { AdminTenantFrame } from "@/components/app/AdminTenant";
import IntegrationsEditor from "@/components/IntegrationsEditor";
import { resolveVertical } from "@/lib/verticals/registry";

export default function AdminIntegrationsPage() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <AdminTenantFrame slug={slug}>
      {(tenant) => <IntegrationsEditor tenantId={tenant.id} verticalId={resolveVertical(tenant).id} />}
    </AdminTenantFrame>
  );
}
