import Link from "next/link";
import { Card, Chip } from "@heroui/react";
import { FiFileText, FiArrowRight } from "react-icons/fi";
import { prisma } from "@/lib/prisma";
import { normalizePlaceholders } from "@/lib/ai/form-router";
import { FORM_CATEGORIES } from "@/lib/ai/form-template-defs";

export const dynamic = "force-dynamic";

export default async function FormsPage() {
  const templates = await prisma.formTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { budgetMin: "asc" }],
  });

  const grouped = FORM_CATEGORIES.map((category) => ({
    category,
    items: templates.filter((template) => template.category === category),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold tracking-widest text-[#b95817]">DOCX FORM LIBRARY</p>
        <h1 className="text-2xl font-bold tracking-tight text-[#272522]">แบบฟอร์มเอกสาร</h1>
        <p className="text-sm text-stone-500">
          เลือกแบบฟอร์มที่ต้องการ กรอกข้อมูลแล้วระบบจะเติมลงในไฟล์ .docx ให้ดาวน์โหลด
        </p>
      </div>

      {grouped.length === 0 ? (
        <Card className="border border-stone-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-stone-100 text-stone-400 mb-3">
            <FiFileText size={28} />
          </div>
          <h3 className="text-base font-bold text-[#272522]">ยังไม่มีแบบฟอร์มที่เปิดใช้งาน</h3>
          <p className="text-xs text-stone-500 mt-1">กรุณาติดต่อเจ้าหน้าที่พัสดุเพื่อเพิ่มแบบฟอร์ม</p>
        </Card>
      ) : (
        grouped.map((group) => (
          <div key={group.category} className="space-y-3">
            <div className="flex items-center gap-2">
              <Chip color="accent" size="sm" variant="soft">{group.category}</Chip>
              <span className="text-xs text-stone-400">{group.items.length} แบบฟอร์ม</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((template) => {
                const defs = normalizePlaceholders(template.placeholders);
                return (
                  <Card
                    key={template.id}
                    className="border border-stone-200 bg-white p-4 shadow-sm transition hover:border-orange-200 hover:shadow-md"
                  >
                    <Card.Content className="px-0">
                      <div className="flex items-start gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-orange-50 text-[#b95817]">
                          <FiFileText size={17} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#272522]">{template.fileName}</p>
                          <p className="mt-0.5 line-clamp-2 text-[0.7rem] text-stone-500">
                            {template.description || `วงเงิน: ${template.budgetMax === null ? `≥ ${template.budgetMin.toLocaleString()} บาท` : `${template.budgetMin.toLocaleString()} – ${template.budgetMax.toLocaleString()} บาท`}`}
                          </p>
                          <p className="mt-1 text-[0.65rem] text-stone-400">
                            ช่องกรอก {defs.length} รายการ
                          </p>
                        </div>
                      </div>
                      <Link
                        href={`/forms/${template.id}`}
                        className="mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-[#e87722] py-2 text-xs font-semibold text-white transition hover:bg-[#c85f13]"
                      >
                        กรอกแบบฟอร์ม <FiArrowRight size={13} />
                      </Link>
                    </Card.Content>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
