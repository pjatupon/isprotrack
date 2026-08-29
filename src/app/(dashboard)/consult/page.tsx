"use client";

import { useState, useTransition } from "react";
import { Button, Card, Input, Label, TextField, Chip, Alert, ProgressBar } from "@heroui/react";
import { FiSend, FiFileText, FiCheckCircle, FiHelpCircle, FiArrowRight } from "react-icons/fi";

type Citation = {
  chunkId: string;
  content: string;
  section: string | null;
  documentTitle: string;
  relevanceScore: number;
};

type Step = 1 | 2 | 3 | 4 | 5;

type StepData = {
  objective: string;
  quantity: string;
  budget: string;
  usageDate: string;
  procurementType: string;
  procurementMethod: string;
};

export default function ConsultPage() {
  const [step, setStep] = useState<Step>(1);
  const [formData, setFormData] = useState<StepData>({
    objective: "",
    quantity: "",
    budget: "",
    usageDate: "",
    procurementType: "ซื้อพัสดุ",
    procurementMethod: "เฉพาะเจาะจง",
  });

  const [chatLog, setChatLog] = useState<{ role: "user" | "assistant"; text: string; citations?: Citation[]; confidence?: number }[]>([
    {
      role: "assistant",
      text: "สวัสดีครับ ยินดีต้อนรับสู่ระบบปรึกษาการจัดซื้อจัดจ้างอัจฉริยะ คณะสหวิทยาการ มหาวิทยาลัยขอนแก่น เพื่อแนะนำแนวทางตามระเบียบพัสดุที่ถูกต้อง กรุณาบอก **วัตถุประสงค์ของการจัดซื้อจัดจ้าง** ของท่านครับ",
    },
  ]);

  const [customQuery, setCustomQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleStepSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1 && !formData.objective.trim()) return;
    if (step === 2 && !formData.quantity.trim()) return;
    if (step === 3 && !formData.budget.trim()) return;
    if (step === 4 && !formData.usageDate.trim()) return;

    if (step === 1) {
      setChatLog((prev) => [
        ...prev,
        { role: "user", text: `วัตถุประสงค์: ${formData.objective}` },
        { role: "assistant", text: "รับทราบวัตถุประสงค์ครับ ขั้นต่อไปกรุณาระบุ **จำนวนหรือขอบเขตงาน** ที่ต้องการ (เช่น 10 เครื่อง, 1 ระบบงาน)" },
      ]);
      setStep(2);
    } else if (step === 2) {
      setChatLog((prev) => [
        ...prev,
        { role: "user", text: `จำนวน/ขอบเขต: ${formData.quantity}` },
        { role: "assistant", text: "ต่อไปกรุณาระบุ **วงเงินงบประมาณโดยประมาณ (บาท)** ครับ" },
      ]);
      setStep(3);
    } else if (step === 3) {
      setChatLog((prev) => [
        ...prev,
        { role: "user", text: `งบประมาณ: ${Number(formData.budget).toLocaleString()} บาท` },
        { role: "assistant", text: "สุดท้าย กรุณาระบุ **กำหนดวันที่ต้องการใช้งานพัสดุ/เริ่มโครงการ** ครับ" },
      ]);
      setStep(4);
    } else if (step === 4) {
      // Trigger RAG Analysis
      const summaryQuery = `ต้องการจัดซื้อ/จ้าง: ${formData.objective} จำนวน: ${formData.quantity} วงเงินงบประมาณ: ${formData.budget} บาท กำหนดใช้งาน: ${formData.usageDate} ขอคำแนะนำวิธีจัดซื้อจัดจ้างและเอกสารที่ต้องเตรียมตามระเบียบ พ.ร.บ. จัดซื้อจัดจ้างฯ`;
      
      setChatLog((prev) => [
        ...prev,
        { role: "user", text: `กำหนดใช้งาน: ${formData.usageDate}` },
      ]);
      setStep(5);
      runConsultation(summaryQuery);
    }
  };

  const runConsultation = (query: string) => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/ai/consult", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });

        if (!res.ok) throw new Error("ไม่สามารถเชื่อมต่อระบบ AI ได้");
        const data = await res.json();

        setChatLog((prev) => [
          ...prev,
          {
            role: "assistant",
            text: data.answer,
            citations: data.citations,
            confidence: data.confidenceScore,
          },
        ]);
      } catch (err: unknown) {
        setChatLog((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `เกิดข้อผิดพลาด: ${err instanceof Error ? err.message : "ระบบไม่สามารถตอบกลับได้ชั่วคราว"}`,
          },
        ]);
      }
    });
  };

  const handleCustomSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuery.trim() || isPending) return;
    const q = customQuery.trim();
    setCustomQuery("");
    setChatLog((prev) => [...prev, { role: "user", text: q }]);
    runConsultation(q);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold tracking-widest text-[#b95817]">SMART PROCUREMENT WIZARD</p>
          <h1 className="text-2xl font-bold tracking-tight text-[#272522]">ปรึกษาความต้องการจัดซื้อจัดจ้าง</h1>
          <p className="text-sm text-stone-500">ระบบ AI วิเคราะห์ความต้องการและค้นหาข้อระเบียบที่เกี่ยวข้องแบบอัตโนมัติ</p>
        </div>
        <div className="flex items-center gap-2">
          <Chip color="accent" size="sm" variant="soft">
            ขั้นตอนที่ {Math.min(step, 4)} / 4
          </Chip>
        </div>
      </div>

      <ProgressBar aria-label="ความคืบหน้าการกรอกข้อมูล" className="h-1.5" value={(Math.min(step, 4) / 4) * 100} />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left: Chat Interaction */}
        <Card className="flex flex-col border border-stone-200 bg-white shadow-sm">
          <Card.Header className="border-b border-stone-100 bg-stone-50/50 p-4">
            <Card.Title className="text-base font-bold text-[#272522]">บทสนทนาและคำแนะนำ</Card.Title>
            <Card.Description className="text-xs text-stone-500">
              โต้ตอบกับ AI RAG ที่ผ่านการฝึกด้วยระเบียบพัสดุ มหาวิทยาลัยขอนแก่น
            </Card.Description>
          </Card.Header>

          <Card.Content className="flex-1 space-y-4 overflow-y-auto p-4 max-h-[550px]">
            {chatLog.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[90%] rounded-2xl p-4 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#e87722] text-white"
                      : "border border-stone-200 bg-stone-50 text-stone-800"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {/* Confidence Badge */}
                  {msg.confidence !== undefined && (
                    <div className="mt-3 flex items-center gap-2 border-t border-stone-200 pt-2 text-xs text-stone-600">
                      <span>ความมั่นใจของ AI:</span>
                      <Chip color={msg.confidence > 0.7 ? "success" : "warning"} size="sm" variant="soft">
                        {(msg.confidence * 100).toFixed(0)}%
                      </Chip>
                    </div>
                  )}

                  {/* Citations */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-stone-200 pt-2">
                      <p className="flex items-center gap-1.5 text-xs font-bold text-[#b95817]">
                        <FiFileText size={13} /> แหล่งอ้างอิงระเบียบที่เกี่ยวข้อง:
                      </p>
                      <div className="space-y-1.5">
                        {msg.citations.map((cite, idx) => (
                          <div key={idx} className="rounded-xl border border-stone-200/80 bg-white p-2.5 text-xs text-stone-700 shadow-2xs">
                            <div className="flex items-center justify-between font-semibold text-[#272522]">
                              <span>{cite.documentTitle} {cite.section ? `(${cite.section})` : ""}</span>
                              <span className="text-[0.65rem] text-stone-400">Match: {(cite.relevanceScore * 100).toFixed(0)}%</span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-stone-500">{cite.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isPending && (
              <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">
                <span className="inline-block h-3 w-3 animate-ping rounded-full bg-[#e87722]" />
                <span>AI กำลังวิเคราะห์ระเบียบและประมวลผลคำแนะนำ...</span>
              </div>
            )}
          </Card.Content>

          {/* Custom query input if step 5 */}
          {step === 5 && (
            <div className="border-t border-stone-100 p-3">
              <form onSubmit={handleCustomSend} className="flex gap-2">
                <input
                  type="text"
                  value={customQuery}
                  onChange={(e) => setCustomQuery(e.target.value)}
                  placeholder="พิมพ์คำถามเพิ่มเติมเกี่ยวกับระเบียบ..."
                  className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:border-[#e87722]"
                  disabled={isPending}
                />
                <Button isIconOnly type="submit" isDisabled={isPending || !customQuery.trim()} className="bg-[#e87722] text-white">
                  <FiSend size={16} />
                </Button>
              </form>
            </div>
          )}
        </Card>

        {/* Right: Structured Step Wizard & Action Checklist */}
        <div className="space-y-6">
          {step < 5 ? (
            <Card className="border border-stone-200 bg-white p-5 shadow-sm">
              <Card.Header className="px-0 pt-0">
                <p className="text-xs font-bold text-[#b95817]">ขั้นตอนที่ {step} จาก 4</p>
                <Card.Title className="text-lg font-bold text-[#272522]">
                  {step === 1 && "1. วัตถุประสงค์ความต้องการ"}
                  {step === 2 && "2. จำนวนและขอบเขต"}
                  {step === 3 && "3. ประมาณการงบประมาณ"}
                  {step === 4 && "4. ระยะเวลาการใช้งาน"}
                </Card.Title>
              </Card.Header>

              <Card.Content className="px-0 pt-3">
                <form onSubmit={handleStepSubmit} className="space-y-4">
                  {step === 1 && (
                    <TextField isRequired name="objective">
                      <Label>ต้องการจัดซื้อจัดจ้างอะไร และเพื่ออะไร?</Label>
                      <Input
                        value={formData.objective}
                        onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                        placeholder="เช่น จัดซื้อเครื่องคอมพิวเตอร์พร้อมอุปกรณ์ สำหรับห้องปฏิบัติการ AI"
                      />
                    </TextField>
                  )}

                  {step === 2 && (
                    <TextField isRequired name="quantity">
                      <Label>จำนวน / ปริมาณงาน</Label>
                      <Input
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                        placeholder="เช่น 20 เครื่อง พร้อมติดตั้งระบบเครือข่าย"
                      />
                    </TextField>
                  )}

                  {step === 3 && (
                    <TextField isRequired name="budget" type="number">
                      <Label>วงเงินงบประมาณ (บาท)</Label>
                      <Input
                        value={formData.budget}
                        onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                        placeholder="เช่น 500000"
                        min={1}
                      />
                    </TextField>
                  )}

                  {step === 4 && (
                    <TextField isRequired name="usageDate" type="date">
                      <Label>วันที่ต้องการเริ่มใช้งาน</Label>
                      <Input
                        value={formData.usageDate}
                        onChange={(e) => setFormData({ ...formData, usageDate: e.target.value })}
                      />
                    </TextField>
                  )}

                  <Button type="submit" fullWidth className="bg-[#e87722] font-semibold text-white hover:bg-[#c85f13]">
                    ถัดไป <FiArrowRight />
                  </Button>
                </form>
              </Card.Content>
            </Card>
          ) : (
            <Card className="border border-stone-200 bg-white p-5 shadow-sm space-y-4">
              <Card.Header className="px-0 pt-0">
                <div className="flex items-center gap-2 text-emerald-600 font-bold">
                  <FiCheckCircle size={20} />
                  <span>สรุปคำแนะนำการจัดหา</span>
                </div>
              </Card.Header>

              <Card.Content className="px-0 space-y-4 text-sm">
                <div className="rounded-2xl bg-stone-50 p-4 space-y-2 border border-stone-200">
                  <div className="flex justify-between">
                    <span className="text-stone-500">ประเภทการจัดหา:</span>
                    <span className="font-semibold">{Number(formData.budget) <= 500000 ? "วิธีเฉพาะเจาะจง" : "วิธี e-Bidding (ประกวดราคาอิเล็กทรอนิกส์)"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">วงเงินงบประมาณ:</span>
                    <span className="font-semibold">{Number(formData.budget).toLocaleString()} บาท</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">ผู้มีอำนาจอนุมัติ:</span>
                    <span className="font-semibold">{Number(formData.budget) <= 2000000 ? "คณบดีคณะสหวิทยาการ" : "อธิการบดีมหาวิทยาลัยขอนแก่น"}</span>
                  </div>
                </div>

                <Alert status="accent" className="rounded-2xl">
                  <Alert.Title className="text-xs font-bold">เอกสารขั้นตอนถัดไปที่ต้องเตรียม:</Alert.Title>
                  <Alert.Description className="text-xs">
                    1. ใบเสนอราคาอย่างน้อย 1 รายการ (กรณีเฉพาะเจาะจง)<br />
                    2. ร่างข้อกำหนดและขอบเขตงาน (TOR)<br />
                    3. บันทึกข้อความขออนุมัติจัดซื้อจัดจ้าง
                  </Alert.Description>
                </Alert>

                <div className="pt-2 flex flex-col gap-2">
                  <a
                    href="/quotation"
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#e87722] py-2.5 text-sm font-bold text-white transition hover:bg-[#c85f13]"
                  >
                    ไปหน้าตรวจใบเสนอราคา (Quotation Inspector) <FiArrowRight />
                  </a>
                  <a
                    href="/tor"
                    className="flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white py-2.5 text-sm font-semibold text-[#272522] hover:bg-stone-50"
                  >
                    ไปหน้าร่าง TOR (TOR Generator)
                  </a>
                </div>
              </Card.Content>
            </Card>
          )}

          {/* Guidelines Box */}
          <div className="rounded-2xl border border-stone-200 bg-orange-50/50 p-4 text-xs text-[#71320c]">
            <p className="font-bold flex items-center gap-1.5 mb-1.5">
              <FiHelpCircle /> ข้อพิจารณาตามระเบียบ มข.
            </p>
            <ul className="list-disc list-inside space-y-1 text-stone-600">
              <li>งบประมาณไม่เกิน 500,000 บาท สามารถจัดซื้อโดยวิธีเฉพาะเจาะจงได้</li>
              <li>การซื้อเครื่องคอมพิวเตอร์ต้องอิงตามเกณฑ์ราคากลาง ICT ประจำปี</li>
              <li>การขอจัดซื้อต้องดำเนินการล่วงหน้าอย่างน้อย 15-30 วันทำการ</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
