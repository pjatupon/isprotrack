"use client";

import { useActionState, useState, useTransition } from "react";
import {
  Button,
  Card,
  Chip,
  Alert,
  Tooltip,
  Modal,
  useOverlayState,
} from "@heroui/react";
import {
  FiSave,
  FiRotateCcw,
  FiInfo,
  FiCheckCircle,
  FiAlertTriangle,
  FiTerminal,
  FiCpu,
  FiRefreshCw,
  FiCheck,
  FiX,
} from "react-icons/fi";
import { saveAiPromptsAction, resetAiPromptAction } from "./actions";
import type { PromptState } from "@/lib/ai/prompts";

type SaveState = { success?: boolean; message?: string; error?: string } | null;

const PLACEHOLDER_HINT: Record<string, string> = {
  "{{context}}": "เนื้อหาที่ค้นคืนจากคลังความรู้ระเบียบในระบบ (RAG)",
  "{{query}}": "คำถามของผู้ใช้",
  "{{quotation}}": "ข้อมูลใบเสนอราคาที่สกัดได้ (JSON)",
  "{{objective}}": "วัตถุประสงค์/บริบทการจัดซื้อ",
  "{{projectTitle}}": "ชื่อโครงการ/รายการจัดหา",
  "{{scope}}": "ขอบเขตงานที่ผู้ใช้ระบุ",
  "{{budget}}": "วงเงินงบประมาณ",
  "{{procurementType}}": "ประเภทการจัดหา",
  "{{torText}}": "เนื้อหาร่าง TOR ทั้งหมด",
};

function PlaceholderHint({ placeholders }: { placeholders: string[] }) {
  if (placeholders.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 text-[0.65rem] font-bold text-stone-500">
        <FiTerminal size={11} /> ตัวแปรที่ใช้ได้:
      </span>
      {placeholders.map((ph) => (
        <Tooltip.Root key={ph}>
          <Tooltip.Trigger className="inline-flex">
            <code className="rounded bg-stone-100 px-1.5 py-0.5 text-[0.6rem] font-semibold text-[#b95817] cursor-help">
              {ph}
            </code>
          </Tooltip.Trigger>
          <Tooltip.Content className="z-50 rounded-lg bg-slate-800 px-2 py-1 text-[0.65rem] font-medium text-white max-w-[260px]">
            {PLACEHOLDER_HINT[ph] ?? "ตัวแปร template"}
          </Tooltip.Content>
        </Tooltip.Root>
      ))}
    </div>
  );
}

function PromptEditor({
  prompt,
  value,
  isSaving,
  onChange,
  onReset,
  onAssist,
}: {
  prompt: PromptState;
  value: string;
  isSaving: boolean;
  onChange: (value: string) => void;
  onReset: () => void;
  onAssist: () => void;
}) {
  const isCustomized = value !== prompt.default;
  return (
    <Card className="border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-[#272522]">{prompt.name}</h3>
            {isCustomized ? (
              <Chip size="sm" variant="soft" color="warning" className="text-[0.6rem]">
                ถูกปรับแต่งแล้ว
              </Chip>
            ) : (
              <Chip size="sm" variant="soft" color="default" className="text-[0.6rem]">
                ค่าเริ่มต้น
              </Chip>
            )}
          </div>
          <p className="mt-0.5 text-[0.7rem] text-stone-500">{prompt.description}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Tooltip.Root>
            <Tooltip.Trigger className="inline-flex">
              <Button
                type="button"
                size="sm"
                onPress={onAssist}
                className="bg-[#e87722] font-semibold text-white hover:bg-[#c85f13] text-[0.65rem] min-h-7 h-7 px-2"
              >
                <FiCpu size={13} /> AI ช่วยเขียน
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content className="z-50 rounded-lg bg-slate-800 px-2 py-1 text-[0.65rem] font-medium text-white">
              ให้ AI ช่วยเขียน / ปรับแต่ง Prompt นี้
            </Tooltip.Content>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger className="inline-flex">
              <Button
                type="button"
                isIconOnly
                size="sm"
                variant="outline"
                onPress={onReset}
                className="border-stone-300 text-stone-500 shrink-0"
                aria-label="รีเซ็ต Prompt เป็นค่าเริ่มต้น"
              >
                <FiRotateCcw size={13} />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content className="z-50 rounded-lg bg-slate-800 px-2 py-1 text-[0.65rem] font-medium text-white">
              รีเซ็ตเป็นค่าเริ่มต้น
            </Tooltip.Content>
          </Tooltip.Root>
        </div>
      </div>

      <div className="mt-3">
        <textarea
          name={prompt.key}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={Math.min(Math.max(value.split("\n").length + 2, 5), 16)}
          disabled={isSaving}
          className="w-full rounded-xl border border-stone-200 p-3 font-mono text-[0.7rem] leading-relaxed text-stone-700 focus:border-[#e87722] focus:outline-none disabled:opacity-60"
        />
        <PlaceholderHint placeholders={prompt.placeholders} />
      </div>
    </Card>
  );
}

function AiPromptAssistModal({
  state,
  prompts,
  initialKey,
  onApply,
}: {
  state: ReturnType<typeof useOverlayState>;
  prompts: PromptState[];
  initialKey: string;
  onApply: (key: string, prompt: string) => void;
}) {
  const [selectedKey, setSelectedKey] = useState<string>(initialKey || prompts[0]?.key || "");
  const [mode, setMode] = useState<"adjust" | "write">("adjust");
  const [requirement, setRequirement] = useState("");
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, startGenerate] = useTransition();

  const meta = prompts.find((p) => p.key === selectedKey);

  const runGenerate = () => {
    if (!requirement.trim()) {
      setError("กรุณาพิมพ์ความต้องการก่อนให้ AI ช่วยเขียน");
      return;
    }
    setError(null);
    startGenerate(async () => {
      try {
        const res = await fetch("/api/ai/prompt-assist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: selectedKey, mode, requirement }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "ไม่สามารถให้ AI ช่วยเขียน Prompt ได้");
        }
        const data = await res.json();
        setResult(data.prompt);
      } catch (err) {
        setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      }
    });
  };

  const apply = () => {
    if (!result.trim()) return;
    onApply(selectedKey, result);
    setResult("");
    setRequirement("");
    state.close();
  };

  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container size="lg">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2 text-slate-800">
                <FiCpu className="text-[#8B0000]" /> AI ช่วยเขียน / ปรับแต่ง Prompt
              </Modal.Heading>
            </Modal.Header>

            <Modal.Body>
              <div className="space-y-4">
                {error && (
                  <Alert status="danger" className="rounded-xl">
                    <Alert.Description className="text-xs flex items-center gap-1.5">
                      <FiAlertTriangle /> {error}
                    </Alert.Description>
                  </Alert>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">เลือกหัวข้อ Prompt</label>
                  <select
                    value={selectedKey}
                    onChange={(e) => {
                      setSelectedKey(e.target.value);
                      setResult("");
                    }}
                    className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-700 focus:border-[#e87722] focus:outline-none"
                  >
                    {prompts.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {meta && (
                    <p className="text-[0.65rem] text-stone-400">{meta.description}</p>
                  )}
                  {meta && <PlaceholderHint placeholders={meta.placeholders} />}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={mode === "adjust" ? "primary" : "outline"}
                    onPress={() => {
                      setMode("adjust");
                      setResult("");
                    }}
                    className={
                      mode === "adjust"
                        ? "bg-[#e87722] font-semibold text-white text-xs"
                        : "border-stone-300 text-stone-600 text-xs"
                    }
                  >
                    ปรับจาก Prompt ปัจจุบัน
                  </Button>
                  <Button
                    size="sm"
                    variant={mode === "write" ? "primary" : "outline"}
                    onPress={() => {
                      setMode("write");
                      setResult("");
                    }}
                    className={
                      mode === "write"
                        ? "bg-[#e87722] font-semibold text-white text-xs"
                        : "border-stone-300 text-stone-600 text-xs"
                    }
                  >
                    เขียนใหม่
                  </Button>
                </div>

                <p className="rounded-xl bg-stone-50 border border-stone-200 p-3 text-[0.7rem] text-stone-500">
                  {mode === "adjust"
                    ? "ระบุสิ่งที่อยากให้ปรับ (เช่น ให้ตอบสั้นลง เน้นขั้นตอน workflow พร้อมเอกสารที่ต้องใช้) ระบบจะให้ AI ปรับจาก Prompt ปัจจุบันของหัวข้อที่เลือก"
                    : "พิมพ์คำอธิบายหรือวาง Prompt ที่ต้องการ แล้วให้ AI เขียน/ปรับปรุงเป็นเวอร์ชันที่สมบูรณ์ (ใช้ตัวแปร {{...}} ที่ระบุไว้ข้างต้นได้)"}
                </p>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    {mode === "adjust" ? "ความต้องการที่อยากให้ปรับ" : "ความต้องการ / Prompt ที่อยากให้เขียน"}
                  </label>
                  <textarea
                    value={requirement}
                    onChange={(e) => setRequirement(e.target.value)}
                    rows={4}
                    placeholder={
                      mode === "adjust"
                        ? "เช่น ให้เน้นการอธิบาย workflow ทีละขั้นตอน พร้อมเอกสารที่ต้องใช้ในแต่ละขั้น และแจ้งเมื่อใช้ความรู้จากกระทรวงการคลัง"
                        : "พิมพ์ Prompt ที่ต้องการ หรืออธิบายว่าต้องการให้ Prompt ทำงานแบบไหน (เช่น เป็นผู้ช่วยตรวจใบเสนอราคา ให้ตอบเป็น JSON)"
                    }
                    className="w-full rounded-xl border border-stone-200 p-3 text-xs text-stone-700 focus:border-[#e87722] focus:outline-none"
                  />
                </div>

                <Button
                  onPress={runGenerate}
                  isDisabled={isGenerating}
                  fullWidth
                  className="bg-[#e87722] font-semibold text-white hover:bg-[#c85f13]"
                >
                  <FiCpu /> {isGenerating ? "AI กำลังเขียน Prompt..." : "ให้ AI ช่วยเขียน / ปรับ Prompt"}
                </Button>

                {isGenerating && (
                  <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-500">
                    <FiRefreshCw className="animate-spin" /> กำลังให้ AI วิเคราะห์และเขียน Prompt...
                  </div>
                )}

                {result && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-700">
                        ผลลัพธ์จาก AI (แก้ไขได้ก่อนนำไปใช้):
                      </p>
                      <Chip size="sm" variant="soft" color="success" className="text-[0.6rem]">
                        พร้อมใช้
                      </Chip>
                    </div>
                    <textarea
                      value={result}
                      onChange={(e) => setResult(e.target.value)}
                      rows={Math.min(Math.max(result.split("\n").length + 2, 6), 16)}
                      className="w-full rounded-xl border border-stone-200 p-3 font-mono text-[0.7rem] leading-relaxed text-stone-700 focus:border-[#e87722] focus:outline-none"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button onPress={apply} className="bg-emerald-600 font-semibold text-white hover:bg-emerald-700 text-xs">
                        <FiCheck /> ใช้ผลลัพธ์นี้
                      </Button>
                      <Button
                        onPress={runGenerate}
                        isDisabled={isGenerating}
                        variant="outline"
                        className="border-stone-300 text-stone-600 text-xs"
                      >
                        <FiRefreshCw /> ลองใหม่
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Modal.Body>

            <Modal.Footer>
              <Button
                type="button"
                variant="secondary"
                className="border border-slate-300 text-xs"
                onPress={() => state.close()}
              >
                <FiX /> ปิด
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export function AiPromptsForm({ prompts }: { prompts: PromptState[] }) {
  const [state, formAction, isSaving] = useActionState<SaveState, FormData>(
    saveAiPromptsAction,
    null,
  );
  const [, startTransition] = useTransition();
  const assistant = useOverlayState();
  const [assistKey, setAssistKey] = useState<string>(prompts[0]?.key ?? "");
  const [assistNonce, setAssistNonce] = useState(0);

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(prompts.map((p) => [p.key, p.current])),
  );

  const handleValueChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleOpenAssist = (key: string) => {
    setAssistKey(key);
    setAssistNonce((n) => n + 1);
    assistant.open();
  };

  const handleReset = (key: string) => {
    const meta = prompts.find((p) => p.key === key);
    startTransition(async () => {
      const result = await resetAiPromptAction(key);
      if (result?.success && meta) {
        setValues((prev) => ({ ...prev, [key]: meta.default }));
      }
    });
  };

  const handleApplyAssist = (key: string, prompt: string) => {
    setValues((prev) => ({ ...prev, [key]: prompt }));
  };

  return (
    <>
      <div className="flex items-start gap-2 rounded-2xl border border-orange-200 bg-orange-50/50 p-4 text-[0.7rem] text-[#71320c]">
        <FiInfo className="shrink-0 mt-0.5" />
        <p>
          Prompt ระบบจะอ้างอิงจากคลังความรู้ระเบียบ (RAG) ในระบบก่อน หากบริบทไม่เพียงพอ AI จะใช้ความรู้ระเบียบพัสดุ
          ของกระทรวงการคลังและแจ้งให้ทราบ โดยค่าเหล่านี้ถูกบันทึกลงฐานข้อมูลและมีผลทันทีหลังกดบันทึก
        </p>
      </div>

      <form action={formAction} className="space-y-5">
        {state?.error && (
          <Alert status="danger" className="rounded-2xl">
            <Alert.Description className="text-xs flex items-center gap-1.5">
              <FiAlertTriangle /> {state.error}
            </Alert.Description>
          </Alert>
        )}
        {state?.success && (
          <Alert status="success" className="rounded-2xl">
            <Alert.Description className="text-xs font-semibold flex items-center gap-1.5">
              <FiCheckCircle /> {state.message}
            </Alert.Description>
          </Alert>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          {prompts.map((prompt) => (
            <PromptEditor
              key={prompt.key}
              prompt={prompt}
              value={values[prompt.key] ?? ""}
              isSaving={isSaving}
              onChange={(value) => handleValueChange(prompt.key, value)}
              onReset={() => handleReset(prompt.key)}
              onAssist={() => handleOpenAssist(prompt.key)}
            />
          ))}
        </div>

        <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-lg backdrop-blur">
          <Chip size="sm" variant="soft" color="accent" className="text-[0.65rem]">
            {prompts.length} รายการ
          </Chip>
          <Button
            type="submit"
            isDisabled={isSaving}
            className="bg-[#e87722] font-semibold text-white hover:bg-[#c85f13]"
          >
            <FiSave /> {isSaving ? "กำลังบันทึก..." : "บันทึก Prompt ทั้งหมด"}
          </Button>
        </div>
      </form>

      <AiPromptAssistModal
        key={assistNonce}
        state={assistant}
        prompts={prompts}
        initialKey={assistKey}
        onApply={handleApplyAssist}
      />
    </>
  );
}
