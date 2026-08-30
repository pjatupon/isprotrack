import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getRbacMatrix } from "@/lib/rbac-store";
import { RbacManager } from "@/components/admin/rbac/rbac-manager";

export const dynamic = "force-dynamic";

export default async function AdminRbacPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "ADMIN") redirect("/admin");

  const matrix = await getRbacMatrix();

  return <RbacManager initialMatrix={matrix} />;
}
