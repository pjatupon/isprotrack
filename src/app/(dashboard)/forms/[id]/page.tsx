import Link from "next/link";
import { notFound } from "next/navigation";
import { FiArrowLeft } from "react-icons/fi";
import { prisma } from "@/lib/prisma";
import { normalizePlaceholders } from "@/lib/ai/form-router";
import { FormFiller } from "@/components/forms/form-filler";

export const dynamic = "force-dynamic";

export default async function FormDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const template = await prisma.formTemplate.findUnique({ where: { id } });
  if (!template || !template.isActive) notFound();

  const defs = normalizePlaceholders(template.placeholders);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link
        href="/forms"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-[#b95817]"
      >
        <FiArrowLeft size={13} /> กลับไปเลือกแบบฟอร์ม
      </Link>
      <FormFiller
        template={{
          id: template.id,
          fileName: template.fileName,
          category: template.category,
          description: template.description,
          budgetMin: template.budgetMin,
          budgetMax: template.budgetMax,
        }}
        defs={defs}
      />
    </div>
  );
}
