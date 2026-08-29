import { prisma } from "@/lib/prisma";
import { getKnowledgeAccess } from "@/lib/knowledge/access";
import { redirect } from "next/navigation";
import { KnowledgeManager } from "@/components/admin/knowledge/knowledge-manager";

export const dynamic = "force-dynamic";

export default async function KnowledgeBasePage() {
  const access = await getKnowledgeAccess();
  if (!access) redirect("/dashboard");

  const [categories, documents] = await Promise.all([
    prisma.knowledgeCategory.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { documents: true } } },
    }),
    prisma.regulationDocument.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { id: true, name: true } },
        _count: { select: { chunks: true } },
      },
    }),
  ]);

  return (
    <KnowledgeManager
      categories={categories.map((category) => ({
        id: category.id,
        name: category.name,
        description: category.description,
        isActive: category.isActive,
        documentCount: category._count.documents,
      }))}
      documents={documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        issueNo: doc.issueNo,
        status: doc.status,
        documentType: doc.documentType,
        originalName: doc.originalName,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        dimensions: doc.dimensions,
        chunkCount: doc._count.chunks,
        processingNote: doc.processingNote,
        categoryName: doc.category?.name ?? null,
        categoryId: doc.category?.id ?? null,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
      }))}
    />
  );
}
