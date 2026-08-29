"use client";

import { useState, useTransition } from "react";
import { Button, Card, Chip, Table, Alert } from "@heroui/react";
import { FiUser, FiEye, FiCheck, FiXCircle } from "react-icons/fi";
import { WorkflowDiagram } from "@/components/tracking/WorkflowDiagram";
import { updateRequestStatus } from "@/app/actions/procurement";

type RequestItem = {
  id: string;
  title: string;
  budget: number;
  requester: string;
  department: string;
  createdAt: string;
  currentStep: string;
  status: "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "REJECTED";
  assignee: string;
  slaDaysLeft: number;
};

const mockRequests: RequestItem[] = [
  {
    id: "REQ-2026-0801",
    title: "จัดซื้อเครื่องคอมพิวเตอร์ Workstation ห้องแล็บ AI (15 เครื่อง)",
    budget: 650000,
    requester: "อ.ดร.สมชาย ใจดี",
    department: "สาขาวิชาวิทยาการคอมพิวเตอร์",
    createdAt: "25 ส.ค. 2569",
    currentStep: "เจ้าหน้าที่ตรวจทานร่าง TOR",
    status: "IN_REVIEW",
    assignee: "คุณอนงค์ รักพัสดุ (งานพัสดุ)",
    slaDaysLeft: 2,
  },
  {
    id: "REQ-2026-0802",
    title: "จัดจ้างปรับปรุงระบบเครือข่ายไร้สาย อาคารเรียนรวม 1",
    budget: 280000,
    requester: "ผศ.มานพ เทคโนโลยี",
    department: "สาขาวิชาเทคโนโลยีสารสนเทศ",
    createdAt: "27 ส.ค. 2569",
    currentStep: "แนบใบเสนอราคาและตรวจความครบถ้วน",
    status: "SUBMITTED",
    assignee: "AI System & ผู้ขอจัดซื้อ",
    slaDaysLeft: 4,
  },
  {
    id: "REQ-2026-0795",
    title: "จัดซื้อชุดอุปกรณ์ทดลอง IoT และ Smart Sensor",
    budget: 120000,
    requester: "ดร.วิภา สหวิทยาการ",
    department: "สาขาวิชาวิทยาศาสตร์ประยุกต์",
    createdAt: "20 ส.ค. 2569",
    currentStep: "อนุมัติคำขอจัดซื้อแล้ว",
    status: "APPROVED",
    assignee: "คณบดีคณะสหวิทยาการ",
    slaDaysLeft: 0,
  },
];

export default function RequestsTrackingPage() {
  const [selectedRequest, setSelectedRequest] = useState<RequestItem>(mockRequests[0]);
  const [requestsList, setRequestsList] = useState<RequestItem[]>(mockRequests);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleApprove = (id: string) => {
    startTransition(async () => {
      const res = await updateRequestStatus(id, "APPROVED");
      if (res.success) {
        setRequestsList((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: "APPROVED", currentStep: "อนุมัติคำขอจัดซื้อแล้ว" } : r))
        );
        setSelectedRequest((prev) => (prev.id === id ? { ...prev, status: "APPROVED", currentStep: "อนุมัติคำขอจัดซื้อแล้ว" } : prev));
        setActionMessage(`อนุมัติคำขอ ${id} เรียบร้อยแล้ว`);
      } else {
        alert(res.error);
      }
    });
  };

  const handleReject = (id: string) => {
    startTransition(async () => {
      const res = await updateRequestStatus(id, "REJECTED");
      if (res.success) {
        setRequestsList((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: "REJECTED", currentStep: "ส่งกลับแก้ไข/ไม่อนุมัติ" } : r))
        );
        setSelectedRequest((prev) => (prev.id === id ? { ...prev, status: "REJECTED", currentStep: "ส่งกลับแก้ไข/ไม่อนุมัติ" } : prev));
        setActionMessage(`ส่งกลับแก้ไขคำขอ ${id} แล้ว`);
      } else {
        alert(res.error);
      }
    });
  };

  const getStatusChip = (st: RequestItem["status"]) => {
    switch (st) {
      case "APPROVED":
        return <Chip color="success" size="sm" variant="soft">อนุมัติแล้ว</Chip>;
      case "IN_REVIEW":
        return <Chip color="accent" size="sm" variant="soft">กำลังตรวจทาน</Chip>;
      case "SUBMITTED":
        return <Chip color="warning" size="sm" variant="soft">ยื่นคำขอแล้ว</Chip>;
      case "REJECTED":
        return <Chip color="danger" size="sm" variant="soft">ต้องแก้ไข</Chip>;
      default:
        return <Chip color="default" size="sm" variant="soft">ร่าง</Chip>;
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold tracking-widest text-[#b95817]">REQUEST TRACKING & SLA</p>
          <h1 className="text-2xl font-bold tracking-tight text-[#272522]">ติดตามสถานะคำขอจัดซื้อจัดจ้าง</h1>
          <p className="text-sm text-stone-500">ติดตามสถานะความคืบหน้าแบบ Real-time พร้อมผัง Workflow และการควบคุม SLA</p>
        </div>
      </div>

      {actionMessage && (
        <Alert status="success" className="rounded-2xl">
          <Alert.Description className="text-xs font-semibold">{actionMessage}</Alert.Description>
        </Alert>
      )}

      {/* Requests Table */}
      <Card className="border border-stone-200 bg-white p-5 shadow-sm">
        <Card.Header className="px-0 pt-0">
          <Card.Title className="text-base font-bold text-[#272522]">รายการคำขอทั้งหมดในระบบ</Card.Title>
        </Card.Header>
        <Card.Content className="px-0 pt-3 overflow-x-auto">
          <Table className="w-full text-left text-xs">
            <Table.Header>
              <Table.Column className="p-3 font-bold text-stone-600">รหัสคำขอ</Table.Column>
              <Table.Column className="p-3 font-bold text-stone-600">ชื่อโครงการ</Table.Column>
              <Table.Column className="p-3 font-bold text-stone-600">งบประมาณ</Table.Column>
              <Table.Column className="p-3 font-bold text-stone-600">ผู้ขอจัดซื้อ</Table.Column>
              <Table.Column className="p-3 font-bold text-stone-600">สถานะ</Table.Column>
              <Table.Column className="p-3 font-bold text-stone-600 text-center">การจัดการ</Table.Column>
            </Table.Header>
            <Table.Body>
              {requestsList.map((r) => (
                <Table.Row
                  key={r.id}
                  className={`border-t border-stone-100 cursor-pointer transition ${
                    selectedRequest.id === r.id ? "bg-orange-50/50" : "hover:bg-stone-50"
                  }`}
                >
                  <Table.Cell className="p-3 font-bold text-[#b95817]">{r.id}</Table.Cell>
                  <Table.Cell className="p-3 font-medium text-stone-800">{r.title}</Table.Cell>
                  <Table.Cell className="p-3 font-semibold">{r.budget.toLocaleString()} บาท</Table.Cell>
                  <Table.Cell className="p-3 text-stone-600">{r.requester}</Table.Cell>
                  <Table.Cell className="p-3">{getStatusChip(r.status)}</Table.Cell>
                  <Table.Cell className="p-3 text-center">
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => setSelectedRequest(r)}
                      className="border border-stone-300 text-xs"
                    >
                      <FiEye /> เลือกดู
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Card.Content>
      </Card>

      {/* Selected Request Detail Panel & Interactive Workflow Diagram */}
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        {/* Detail & SLA Timeline */}
        <Card className="border border-stone-200 bg-white p-5 shadow-sm space-y-4">
          <Card.Header className="px-0 pt-0">
            <p className="text-xs font-bold text-[#b95817]">{selectedRequest.id}</p>
            <Card.Title className="text-base font-bold text-[#272522]">
              {selectedRequest.title}
            </Card.Title>
            <Card.Description className="text-xs text-stone-500">
              ยื่นเมื่อ: {selectedRequest.createdAt} | {selectedRequest.department}
            </Card.Description>
          </Card.Header>

          <Card.Content className="px-0 space-y-4 text-xs">
            <div className="rounded-2xl bg-stone-50 p-4 border border-stone-200 space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-stone-500">สถานะปัจจุบัน:</span>
                {getStatusChip(selectedRequest.status)}
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">ขั้นตอนปัจจุบัน:</span>
                <span className="font-semibold text-stone-800">{selectedRequest.currentStep}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">ผู้รับผิดชอบงาน:</span>
                <span className="font-semibold text-stone-800 flex items-center gap-1">
                  <FiUser className="text-[#b95817]" /> {selectedRequest.assignee}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">SLA ที่เหลือ:</span>
                <span className={`font-bold ${selectedRequest.slaDaysLeft <= 2 ? "text-amber-600" : "text-emerald-600"}`}>
                  {selectedRequest.slaDaysLeft > 0 ? `${selectedRequest.slaDaysLeft} วันทำการ` : "เสร็จสิ้นตามกำหนด"}
                </span>
              </div>
            </div>

            {/* Actions for Staff */}
            <div className="border-t border-stone-200 pt-4 space-y-2">
              <p className="font-bold text-stone-700">การดำเนินการของเจ้าหน้าที่พัสดุ / กรรมการ:</p>
              <div className="flex gap-2">
                <Button
                  onPress={() => handleApprove(selectedRequest.id)}
                  isDisabled={isPending || selectedRequest.status === "APPROVED"}
                  className="flex-1 bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
                >
                  <FiCheck /> ตรวจผ่าน / อนุมัติ
                </Button>
                <Button
                  onPress={() => handleReject(selectedRequest.id)}
                  isDisabled={isPending || selectedRequest.status === "REJECTED"}
                  className="flex-1 bg-rose-600 text-white font-semibold hover:bg-rose-700"
                >
                  <FiXCircle /> ส่งกลับแก้ไข
                </Button>
              </div>
            </div>
          </Card.Content>
        </Card>

        {/* Interactive Diagram */}
        <Card className="border border-stone-200 bg-white p-5 shadow-sm space-y-4">
          <Card.Header className="px-0 pt-0">
            <Card.Title className="text-base font-bold text-[#272522]">
              ผังกระบวนการดำเนินงาน (Interactive Workflow)
            </Card.Title>
            <Card.Description className="text-xs text-stone-500">
              คลิกที่ขั้นตอนเพื่อดูรายละเอียด SLA และ Audit Log
            </Card.Description>
          </Card.Header>
          <Card.Content className="px-0">
            <WorkflowDiagram />
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}
