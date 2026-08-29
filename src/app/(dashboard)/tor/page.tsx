"use client";

import { useState, useActionState } from "react";
import { Button, Card, TextField, Label, Input, Alert, Chip } from "@heroui/react";
import { FiFileText, FiAlertOctagon, FiSave, FiDownload, FiCheck, FiClock, FiPlus } from "react-icons/fi";
import { saveTorDraft } from "@/app/actions/procurement";

type TorData = {
  requestId: string;
  projectTitle: string;
  objective: string;
  scope: string;
  specifications: string;
  deliverables: string;
  inspectionCriteria: string;
  isLockInRisk: boolean;
};

const initialTor: TorData = {
  requestId: "req_demo_001",
  projectTitle: "จัดซื้อเครื่องคอมพิวเตอร์ประมวลผลประสิทธิภาพสูงสำหรับห้องปฏิบัติการ AI",
  objective: "เพื่อใช้ในการจัดการเรียนการสอนและพัฒนางานวิจัยด้านปัญญาประดิษฐ์ สาขาวิทยาการคอมพิวเตอร์และเทคโนโลยีสารสนเทศ",
  scope: "จัดหาเครื่องคอมพิวเตอร์ Workstation จำนวน 15 เครื่อง พร้อมติดตั้งระบบปฏิบัติการ Ubuntu LTS และ Driver การ์ดจอ GPU พร้อมเชื่อมต่อระบบเครือข่ายความเร็วสูง",
  specifications: "1. หน่วยประมวลผล (CPU) ไม่น้อยกว่า 16 Cores 32 Threads\n2. หน่วยความจำหลัก (RAM) ชนิด DDR5 ไม่น้อยกว่า 64 GB\n3. หน่วยประมวลผลกราฟิก (GPU) มี VRAM ไม่น้อยกว่า 16 GB\n4. อุปกรณ์จัดเก็บข้อมูลชนิด NVMe M.2 ขนาดไม่น้อยกว่า 1 TB\n5. รับประกันสินค้าแบบ Onsite Service ไม่น้อยกว่า 3 ปี",
  deliverables: "ส่งมอบพัสดุครบถ้วนตามรายการ พร้อมเอกสารคู่มือการใช้งานและใบรับประกันสินค้าภายใน 45 วัน นับถัดจากวันลงนามในสัญญา",
  inspectionCriteria: "คณะกรรมการตรวจรับพัสดุจะดำเนินการทดสอบเปิดเครื่อง ทดสอบการประมวลผล AI Benchmark ต่อเนื่อง 1 ชั่วโมง และตรวจสอบเอกสารการรับประกันให้ถูกต้องครบถ้วน",
  isLockInRisk: false,
};

const versionHistory = [
  { version: 1, date: "28 ส.ค. 2569 10:30", author: "สมชาย ใจดี", status: "ร่างเบื้องต้น" },
  { version: 2, date: "29 ส.ค. 2569 08:45", author: "สมชาย ใจดี", status: "ปรับแก้ตามคำแนะนำ AI" },
];

export default function TorPage() {
  const [torData, setTorData] = useState<TorData>(initialTor);
  const [state, formAction, isPending] = useActionState(saveTorDraft, null);

  // Simple Lock-in detection heuristic
  const checkLockInRisk = (spec: string) => {
    const brandKeywords = ["apple", "intel", "dell", "hp", "lenovo", "asus", "nvidia", "macbook", "core i9-14900k"];
    const found = brandKeywords.filter((k) => spec.toLowerCase().includes(k));
    return found.length > 0;
  };

  const handleSpecChange = (val: string) => {
    const isRisk = checkLockInRisk(val);
    setTorData((prev) => ({
      ...prev,
      specifications: val,
      isLockInRisk: isRisk,
    }));
  };

  const handleExportText = () => {
    const fullText = `ร่างข้อกำหนดและขอบเขตงาน (TOR)
โครงการ: ${torData.projectTitle}
รหัสคำขอ: ${torData.requestId}

1. วัตถุประสงค์:
${torData.objective}

2. ขอบเขตของงาน:
${torData.scope}

3. คุณลักษณะเฉพาะ (Specifications):
${torData.specifications}

4. กำหนดเวลาและสถานที่ส่งมอบ:
${torData.deliverables}

5. หลักเกณฑ์การตรวจรับ:
${torData.inspectionCriteria}
`;
    const blob = new Blob([fullText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `TOR_${torData.requestId}.txt`;
    link.click();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold tracking-widest text-[#b95817]">TOR GENERATOR</p>
          <h1 className="text-2xl font-bold tracking-tight text-[#272522]">ระบบช่วยร่างข้อกำหนดพัสดุ (TOR)</h1>
          <p className="text-sm text-stone-500">สร้างร่าง TOR มาตรฐาน ตรวจสอบข้อความเสี่ยงล็อกสเปก และจัดเก็บประวัติ Version</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onPress={handleExportText} className="border border-stone-300 bg-white text-xs font-semibold text-[#272522] hover:bg-stone-50">
            <FiDownload /> ส่งออกเอกสาร (Export)
          </Button>
        </div>
      </div>

      {/* Lock-in Risk Alert */}
      {torData.isLockInRisk && (
        <Alert status="danger" className="rounded-2xl">
          <Alert.Title className="text-xs font-bold flex items-center gap-1.5">
            <FiAlertOctagon size={16} /> ตรวจพบข้อความที่อาจเข้าข่ายล็อกสเปก (Lock-in Risk Detected)
          </Alert.Title>
          <Alert.Description className="text-xs block mt-1">
            ในส่วนคุณลักษณะเฉพาะ มีการระบุชื่อยี่ห้อ รุ่น หรือสเปกที่เป็นการเจาะจงผู้ผลิตรายใดรายหนึ่งตามระเบียบ พ.ร.บ. จัดซื้อจัดจ้างฯ พ.ศ. 2560 มาตรา 9 ห้ามกำหนดคุณลักษณะเฉพาะให้ใกล้เคียงหรือตรงกับยี่ห้อใดยี่ห้อหนึ่ง เว้นแต่มีเหตุผลความจำเป็น
          </Alert.Description>
        </Alert>
      )}

      {state?.error && (
        <Alert status="danger" className="rounded-2xl">
          <Alert.Description className="text-xs">{state.error}</Alert.Description>
        </Alert>
      )}

      {state?.success && (
        <Alert status="success" className="rounded-2xl">
          <Alert.Description className="text-xs font-semibold flex items-center gap-1.5">
            <FiCheck /> {state.message}
          </Alert.Description>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Left: TOR Editor Form */}
        <Card className="border border-stone-200 bg-white p-6 shadow-sm">
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="requestId" value={torData.requestId} />
            <input type="hidden" name="isLockInRisk" value={String(torData.isLockInRisk)} />

            <TextField isRequired name="projectTitle">
              <Label className="text-xs font-bold">ชื่อโครงการ / รายการจัดหา</Label>
              <Input
                value={torData.projectTitle}
                onChange={(e) => setTorData({ ...torData, projectTitle: e.target.value })}
              />
            </TextField>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700">1. วัตถุประสงค์</label>
              <textarea
                name="objective"
                rows={2}
                value={torData.objective}
                onChange={(e) => setTorData({ ...torData, objective: e.target.value })}
                className="w-full rounded-xl border border-stone-200 p-3 text-xs focus:border-[#e87722] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700">2. ขอบเขตของงาน (Scope of Work)</label>
              <textarea
                name="scope"
                rows={3}
                value={torData.scope}
                onChange={(e) => setTorData({ ...torData, scope: e.target.value })}
                className="w-full rounded-xl border border-stone-200 p-3 text-xs focus:border-[#e87722] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-700">3. คุณลักษณะเฉพาะ (Specifications)</label>
                {torData.isLockInRisk ? (
                  <Chip color="danger" size="sm" variant="soft">
                    เสี่ยงล็อกสเปก
                  </Chip>
                ) : (
                  <Chip color="success" size="sm" variant="soft">
                    สเปกเป็นกลาง
                  </Chip>
                )}
              </div>
              <textarea
                name="specifications"
                rows={6}
                value={torData.specifications}
                onChange={(e) => handleSpecChange(e.target.value)}
                className={`w-full rounded-xl border p-3 text-xs focus:outline-none ${
                  torData.isLockInRisk
                    ? "border-red-400 bg-red-50/20 focus:border-red-500"
                    : "border-stone-200 focus:border-[#e87722]"
                }`}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700">4. กำหนดเวลาส่งมอบงาน</label>
              <textarea
                name="deliverables"
                rows={2}
                value={torData.deliverables}
                onChange={(e) => setTorData({ ...torData, deliverables: e.target.value })}
                className="w-full rounded-xl border border-stone-200 p-3 text-xs focus:border-[#e87722] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700">5. หลักเกณฑ์การตรวจรับ</label>
              <textarea
                name="inspectionCriteria"
                rows={3}
                value={torData.inspectionCriteria}
                onChange={(e) => setTorData({ ...torData, inspectionCriteria: e.target.value })}
                className="w-full rounded-xl border border-stone-200 p-3 text-xs focus:border-[#e87722] focus:outline-none"
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                isDisabled={isPending}
                className="bg-[#e87722] font-semibold text-white hover:bg-[#c85f13]"
              >
                <FiSave /> {isPending ? "กำลังบันทึกฉบับใหม่..." : "บันทึกร่าง TOR (สร้าง Version ใหม่)"}
              </Button>
            </div>
          </form>
        </Card>

        {/* Right: Version History & Standard Reference */}
        <div className="space-y-6">
          <Card className="border border-stone-200 bg-white p-5 shadow-sm">
            <Card.Header className="px-0 pt-0 flex justify-between items-center">
              <Card.Title className="text-base font-bold text-[#272522] flex items-center gap-2">
                <FiClock className="text-[#b95817]" /> ประวัติ Version
              </Card.Title>
              <Chip color="accent" size="sm" variant="soft">
                ปัจจุบัน: v2
              </Chip>
            </Card.Header>

            <Card.Content className="px-0 pt-3 space-y-3">
              {versionHistory.map((vh) => (
                <div key={vh.version} className="flex items-start justify-between rounded-xl bg-stone-50 p-3 border border-stone-200/80">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-[#272522]">Version {vh.version}</p>
                    <p className="text-[0.7rem] text-stone-500">{vh.status}</p>
                    <p className="text-[0.65rem] text-stone-400">{vh.date} โดย {vh.author}</p>
                  </div>
                  <Button size="sm" variant="secondary" className="text-xs border border-stone-300">
                    ดูฉบับนี้
                  </Button>
                </div>
              ))}
            </Card.Content>
          </Card>

          {/* Quick Clauses Template Box */}
          <Card className="border border-stone-200 bg-white p-5 shadow-sm space-y-3">
            <Card.Title className="text-xs font-bold text-[#b95817] flex items-center gap-1.5">
              <FiFileText /> ข้อความมาตรฐานแนะนำ (Standard Clauses)
            </Card.Title>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() =>
                  setTorData((p) => ({
                    ...p,
                    deliverables: p.deliverables + "\n• ต้องแนบใบรับรองมาตรฐาน ISO 9001 ของโรงงานผู้ผลิต",
                  }))
                }
                className="w-full text-left rounded-xl border border-stone-200 p-2 text-xs hover:bg-stone-50 transition text-stone-700 flex items-center justify-between"
              >
                <span>+ ข้อกำหนดมาตรฐาน ISO</span>
                <FiPlus size={14} className="text-[#b95817]" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setTorData((p) => ({
                    ...p,
                    inspectionCriteria: p.inspectionCriteria + "\n• ผู้ขายต้องจัดฝึกอบรมการใช้งานระบบแก่บุคลากรอย่างน้อย 1 ครั้ง",
                  }))
                }
                className="w-full text-left rounded-xl border border-stone-200 p-2 text-xs hover:bg-stone-50 transition text-stone-700 flex items-center justify-between"
              >
                <span>+ ข้อกำหนดการฝึกอบรมการใช้งาน</span>
                <FiPlus size={14} className="text-[#b95817]" />
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
