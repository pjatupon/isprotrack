"use client";

import { useActionState, useState, useTransition } from "react";
import { Button, Card, TextField, Label, Input, Alert, Chip } from "@heroui/react";
import { FiSave, FiCpu, FiLink, FiKey, FiCheckCircle, FiAlertTriangle } from "react-icons/fi";
import { saveAiSettingsAction, testAiConnectionAction } from "./actions";

type AiSettingsFormProps = {
  initialBaseUrl: string;
  initialApiKey: string;
  initialModel: string;
};

type SaveState = { success?: boolean; message?: string; error?: string } | null;

export function AiSettingsForm({
  initialBaseUrl,
  initialApiKey,
  initialModel,
}: AiSettingsFormProps) {
  const [state, formAction, isPending] = useActionState<SaveState, FormData>(
    saveAiSettingsAction,
    null,
  );
  const [testResult, setTestResult] = useState<
    { success: boolean; message?: string; error?: string; answer?: string } | null
  >(null);
  const [isTesting, startTransition] = useTransition();

  const runTest = () => {
    startTransition(async () => {
      const result = await testAiConnectionAction();
      setTestResult(result);
    });
  };

  return (
    <div className="space-y-6">
      <form action={formAction}>
        <Card className="border border-stone-200 bg-white p-6 shadow-sm space-y-5">
          <Card.Header className="px-0 pt-0">
            <Card.Title className="text-base font-bold text-[#272522] flex items-center gap-2">
              <FiCpu className="text-[#b95817]" /> ข้อมูลการเชื่อมต่อ AI
            </Card.Title>
            <Card.Description className="text-xs text-stone-500">
              ค่าเหล่านี้จะถูกบันทึกลงฐานข้อมูลและใช้โดยระบบ AI ทั้งหมด (Consult, OCR, Knowledge Base)
            </Card.Description>
          </Card.Header>

          <Card.Content className="px-0 space-y-4">
            {state?.error && (
              <Alert status="danger" className="rounded-2xl">
                <Alert.Description className="text-xs">{state.error}</Alert.Description>
              </Alert>
            )}
            {state?.success && (
              <Alert status="success" className="rounded-2xl">
                <Alert.Description className="text-xs font-semibold">
                  <FiCheckCircle className="inline mr-1" /> {state.message}
                </Alert.Description>
              </Alert>
            )}

            <TextField name="baseUrl" defaultValue={initialBaseUrl}>
              <Label className="text-xs font-bold flex items-center gap-1">
                <FiLink /> Base URL
              </Label>
              <Input
                type="url"
                placeholder="https://gen.ai.kku.ac.th/api/v1"
              />
            </TextField>

            <TextField name="apiKey" defaultValue="">
              <Label className="text-xs font-bold flex items-center gap-1">
                <FiKey /> API Key
              </Label>
              <Input
                type="password"
                placeholder={initialApiKey ? `ค่าเดิม: ${initialApiKey}` : "กรอก API Key ของ KKU GenAI"}
              />
              <p className="text-xs text-stone-400">
                {initialApiKey ? "เว้นว่างไว้เพื่อคงค่าเดิม" : "ได้จาก https://gen.ai.kku.ac.th"}
              </p>
            </TextField>

            <TextField name="model" defaultValue={initialModel}>
              <Label className="text-xs font-bold">Model (แชท/OCR/Vision)</Label>
              <Input placeholder="gemini-2.5-flash-lite" />
              <p className="text-xs text-stone-400">
                ระบบสร้าง embedding จากข้อความในเครื่องโดยอัตโนมัติ ไม่ต้องตั้งค่าเพิ่ม
              </p>
            </TextField>

            <div className="flex items-center gap-2 pt-1">
              <Chip color="accent" size="sm" variant="soft">
                Base URL: {initialBaseUrl}
              </Chip>
              <Chip color="accent" size="sm" variant="soft">
                Model: {initialModel}
              </Chip>
            </div>
          </Card.Content>
        </Card>

        <div className="mt-4 flex items-center gap-3">
          <Button
            type="submit"
            isDisabled={isPending}
            className="bg-[#e87722] font-semibold text-white hover:bg-[#c85f13]"
          >
            <FiSave /> {isPending ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
          </Button>

          <Button
            type="button"
            onPress={runTest}
            isDisabled={isTesting}
            variant="outline"
            className="border-stone-300 text-xs font-semibold text-[#272522]"
          >
            <FiCpu /> {isTesting ? "กำลังทดสอบ..." : "ทดสอบการเชื่อมต่อ"}
          </Button>
        </div>
      </form>

      {testResult && (
        <Alert
          status={testResult.success ? "success" : "danger"}
          className="rounded-2xl"
        >
          <Alert.Title className="text-xs font-bold flex items-center gap-1.5">
            {testResult.success ? <FiCheckCircle /> : <FiAlertTriangle />}
            {testResult.success ? "การทดสอบสำเร็จ" : "การทดสอบล้มเหลว"}
          </Alert.Title>
          <Alert.Description className="text-xs block mt-1">
            {testResult.message}
            {testResult.answer ? ` — คำตอบจาก AI: "${testResult.answer}"` : ""}
          </Alert.Description>
        </Alert>
      )}
    </div>
  );
}
