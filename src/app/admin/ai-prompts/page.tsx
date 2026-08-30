import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listAiPromptStates } from "@/lib/ai/prompts";
import { AiPromptsForm } from "./AiPromptsForm";

export const dynamic = "force-dynamic";

export default async function AiPromptsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "ADMIN") {
    redirect("/admin");
  }

  const prompts = await listAiPromptStates();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col justify-between gap-3 pb-2 border-b border-slate-200/80 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <span className="text-[0.7rem] font-black tracking-widest text-[#8B0000] uppercase">
            AI PROMPT ENGINE
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800">
            ปรับแต่ง Prompt AI
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            แก้ไขบทบาทและข้อความสั่งของ AI สำหรับทุกฟังก์ชัน (Consult, Quotation, TOR) โดยไม่ต้องแก้โค้ด
          </p>
        </div>
      </div>

      <AiPromptsForm prompts={prompts} />
    </div>
  );
}
