"use client";

import { useState, useActionState, useTransition } from "react";
import { Button, Card, TextField, Label, Input, Table, Chip, Alert } from "@heroui/react";
import { FiBookOpen, FiPlus, FiCheck, FiLayers, FiFileText, FiRefreshCw } from "react-icons/fi";
import { createRegulationDocument, toggleRegulationStatus } from "@/app/actions/procurement";
import type { RegulationStatus } from "@prisma/client";

type RegDoc = {
  id: string;
  title: string;
  issueNo: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: RegulationStatus;
  chunkCount: number;
};

const mockDocs: RegDoc[] = [
  {
    id: "doc_01",
    title: "พระราชบัญญัติการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560",
    issueNo: "พ.ร.บ. 2560",
    effectiveFrom: "23 ส.ค. 2560",
    effectiveTo: null,
    status: "ACTIVE",
    chunkCount: 142,
  },
  {
    id: "doc_02",
    title: "ระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560",
    issueNo: "ระเบียบ กค. 2560",
    effectiveFrom: "23 ส.ค. 2560",
    effectiveTo: null,
    status: "ACTIVE",
    chunkCount: 218,
  },
  {
    id: "doc_03",
    title: "ข้อบังคับมหาวิทยาลัยขอนแก่น ว่าด้วยการพัสดุ พ.ศ. 2561",
    issueNo: "มข. 2561",
    effectiveFrom: "1 ม.ค. 2561",
    effectiveTo: null,
    status: "ACTIVE",
    chunkCount: 65,
  },
  {
    id: "doc_04",
    title: "เกณฑ์ราคากลางและคุณลักษณะพื้นฐานครุภัณฑ์คอมพิวเตอร์ ประจำปี 2568",
    issueNo: "ICT 2568",
    effectiveFrom: "1 ม.ค. 2568",
    effectiveTo: "31 ธ.ค. 2568",
    status: "SUPERSEDED",
    chunkCount: 48,
  },
];

export default function StaffRegulationsPage() {
  const [docsList, setDocsList] = useState<RegDoc[]>(mockDocs);
  const [showAddForm, setShowAddForm] = useState(false);
  const [state, formAction, isCreating] = useActionState(createRegulationDocument, null);
  const [isUpdating, startTransition] = useTransition();

  const handleStatusToggle = (docId: string, currentStatus: RegulationStatus) => {
    const nextStatus: RegulationStatus =
      currentStatus === "ACTIVE" ? "SUPERSEDED" : currentStatus === "SUPERSEDED" ? "ARCHIVED" : "ACTIVE";

    startTransition(async () => {
      const res = await toggleRegulationStatus(docId, nextStatus);
      if (res.success) {
        setDocsList((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, status: nextStatus } : d))
        );
      } else {
        alert(res.error);
      }
    });
  };

  const getStatusChip = (status: RegulationStatus) => {
    switch (status) {
      case "ACTIVE":
        return <Chip color="success" size="sm" variant="soft">ใช้งานอยู่ (Active)</Chip>;
      case "SUPERSEDED":
        return <Chip color="warning" size="sm" variant="soft">มีฉบับใหม่แทน (Superseded)</Chip>;
      case "ARCHIVED":
        return <Chip color="default" size="sm" variant="soft">ยกเลิก/เก็บถาวร (Archived)</Chip>;
      default:
        return <Chip color="default" size="sm" variant="soft">ร่าง</Chip>;
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold tracking-widest text-[#b95817]">REGULATION HUB</p>
          <h1 className="text-2xl font-bold tracking-tight text-[#272522]">จัดการระเบียบพัสดุและฐานความรู้ AI</h1>
          <p className="text-sm text-stone-500">สำหรับเจ้าหน้าที่พัสดุ: อัปโหลดระเบียบใหม่ ระบบจะทำ Semantic Chunking และคำนวณ Embedding อัตโนมัติ</p>
        </div>
        <Button
          onPress={() => setShowAddForm(!showAddForm)}
          className="bg-[#e87722] font-semibold text-white hover:bg-[#c85f13]"
        >
          <FiPlus /> {showAddForm ? "ปิดฟอร์ม" : "เพิ่มระเบียบใหม่"}
        </Button>
      </div>

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

      {/* Add Form */}
      {showAddForm && (
        <Card className="border border-stone-200 bg-white p-6 shadow-sm space-y-4">
          <Card.Header className="px-0 pt-0">
            <Card.Title className="text-base font-bold text-[#272522] flex items-center gap-2">
              <FiBookOpen className="text-[#b95817]" /> เพิ่มระเบียบ/ข้อบังคับใหม่เข้าสู่คลังความรู้ AI
            </Card.Title>
            <Card.Description className="text-xs text-stone-500">
              เมื่อบันทึก ระบบจะสร้าง Embedding Vector ด้วยโมเดล text-embedding-004 เพื่อใช้ในการค้นหา RAG
            </Card.Description>
          </Card.Header>

          <Card.Content className="px-0 pt-2">
            <form action={formAction} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField isRequired name="title">
                  <Label className="text-xs font-bold">ชื่อระเบียบ / ข้อบังคับ / มติ</Label>
                  <Input placeholder="เช่น ประกาศมหาวิทยาลัยขอนแก่น ฉบับที่ 12/2569" />
                </TextField>

                <TextField name="issueNo">
                  <Label className="text-xs font-bold">เลขที่ฉบับ / อ้างอิง</Label>
                  <Input placeholder="เช่น ฉบับที่ 12/2569 หรือ ว 119" />
                </TextField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField isRequired name="effectiveFrom" type="date">
                  <Label className="text-xs font-bold">วันที่มีผลบังคับใช้</Label>
                  <Input defaultValue={new Date().toISOString().split("T")[0]} />
                </TextField>

                <TextField name="effectiveTo" type="date">
                  <Label className="text-xs font-bold">วันสิ้นสุดผลบังคับใช้ (ถ้ามี)</Label>
                  <Input />
                </TextField>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">เนื้อหาระเบียบ (ระบบจะทำการตัดแบ่งย่อยเป็น Chunks อัตโนมัติ)</label>
                <textarea
                  name="content"
                  required
                  rows={6}
                  placeholder="วางข้อความระเบียบ ข้อบังคับ หรือคำสั่งที่ต้องการให้ AI เรียนรู้ที่นี่..."
                  className="w-full rounded-xl border border-stone-200 p-3 text-xs focus:border-[#e87722] focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  isDisabled={isCreating}
                  className="bg-[#e87722] font-semibold text-white hover:bg-[#c85f13]"
                >
                  {isCreating ? (
                    <>
                      <FiRefreshCw className="animate-spin" /> กำลังประมวลผล Chunking & Embedding...
                    </>
                  ) : (
                    <>
                      <FiLayers /> ประมวลผลและนำเข้าสู่ระบบ RAG
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Card.Content>
        </Card>
      )}

      {/* Regulation List Table */}
      <Card className="border border-stone-200 bg-white p-5 shadow-sm">
        <Card.Header className="px-0 pt-0">
          <Card.Title className="text-base font-bold text-[#272522]">ระเบียบและเอกสารอ้างอิงในระบบ</Card.Title>
        </Card.Header>

        <Card.Content className="px-0 pt-3 overflow-x-auto">
          <Table className="w-full text-left text-xs">
            <Table.Header>
              <Table.Column className="p-3 font-bold text-stone-600">ชื่อระเบียบ / ข้อบังคับ</Table.Column>
              <Table.Column className="p-3 font-bold text-stone-600">เลขที่ฉบับ</Table.Column>
              <Table.Column className="p-3 font-bold text-stone-600">วันที่มีผลบังคับใช้</Table.Column>
              <Table.Column className="p-3 font-bold text-stone-600">จำนวน Chunks</Table.Column>
              <Table.Column className="p-3 font-bold text-stone-600">สถานะ</Table.Column>
              <Table.Column className="p-3 font-bold text-stone-600 text-center">สลับสถานะ</Table.Column>
            </Table.Header>

            <Table.Body>
              {docsList.map((doc) => (
                <Table.Row key={doc.id} className="border-t border-stone-100 hover:bg-stone-50 transition">
                  <Table.Cell className="p-3 font-semibold text-stone-800 max-w-sm">
                    <div className="flex items-start gap-2">
                      <FiFileText className="mt-0.5 text-[#b95817] shrink-0" size={14} />
                      <span>{doc.title}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell className="p-3 text-stone-500">{doc.issueNo || "—"}</Table.Cell>
                  <Table.Cell className="p-3 text-stone-600">{doc.effectiveFrom}</Table.Cell>
                  <Table.Cell className="p-3">
                    <span className="rounded-md bg-stone-100 px-2 py-0.5 font-bold text-stone-700">
                      {doc.chunkCount} chunks
                    </span>
                  </Table.Cell>
                  <Table.Cell className="p-3">{getStatusChip(doc.status)}</Table.Cell>
                  <Table.Cell className="p-3 text-center">
                    <Button
                      size="sm"
                      variant="secondary"
                      isDisabled={isUpdating}
                      onPress={() => handleStatusToggle(doc.id, doc.status)}
                      className="border border-stone-300 text-xs"
                    >
                      เปลี่ยนสถานะ
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Card.Content>
      </Card>
    </div>
  );
}
