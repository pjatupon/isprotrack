import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizePlaceholders, placeholderKeys } from "@/lib/ai/form-router";
import { FormTemplateManager } from "@/components/admin/form-templates/form-template-manager";

export const dynamic = "force-dynamic";

export default async function AdminFormTemplatesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "ADMIN") redirect("/admin");

  const templates = await prisma.formTemplate.findMany({
    orderBy: [{ category: "asc" }, { budgetMin: "asc" }],
  });

  return (
    <FormTemplateManager
      templates={templates.map((template) => ({
        id: template.id,
        fileName: template.fileName,
        category: template.category,
        budgetMin: template.budgetMin,
        budgetMax: template.budgetMax,
        filePath: template.filePath,
        placeholders: placeholderKeys(template.placeholders),
        placeholderDefs: normalizePlaceholders(template.placeholders),
        description: template.description,
        isActive: template.isActive,
        createdAt: template.createdAt.toISOString(),
      }))}
    />
  );
}
