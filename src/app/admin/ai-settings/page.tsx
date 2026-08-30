import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getAiSettings } from "@/lib/ai/settings";
import { AiSettingsForm } from "./AiSettingsForm";

function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${"•".repeat(6)}${value.slice(-4)}`;
}

export default async function AiSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "ADMIN") {
    redirect("/admin");
  }

  const settings = await getAiSettings();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col justify-between gap-3 pb-2 border-b border-slate-200/80 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <span className="text-[0.7rem] font-black tracking-widest text-[#8B0000] uppercase">
            AI CONFIGURATION
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800">
            ตั้งค่าการใช้งาน AI
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            กำหนด Base URL, API Key และ Model สำหรับระบบประมวลผลด้วย AI ของคณะสหวิทยาการ
          </p>
        </div>
      </div>

      <AiSettingsForm
        initialBaseUrl={settings.baseUrl}
        initialApiKey={maskSecret(settings.apiKey)}
        initialModel={settings.model}
      />
    </div>
  );
}
