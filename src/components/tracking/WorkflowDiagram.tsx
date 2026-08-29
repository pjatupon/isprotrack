"use client";

import { Chip, Modal, useOverlayState } from "@heroui/react";
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  MarkerType,
  type Node,
  ReactFlow,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useState } from "react";
import { FiAlertCircle, FiCheck, FiClock, FiRefreshCw } from "react-icons/fi";

type StepStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REVISION_NEEDED";

type WorkflowStepData = {
  label: string;
  description: string;
  status: StepStatus;
  assignee?: string;
  sla?: string;
  auditLog?: { action: string; timestamp: string }[];
};

export type WorkflowStepNode = Node<WorkflowStepData, "workflowStep">;

const steps: WorkflowStepData[] = [
  { label: "บอกความต้องการ", description: "ผู้ใช้ระบุความต้องการจัดซื้อ", status: "COMPLETED", assignee: "สมชาย ใจดี", sla: "1 วัน", auditLog: [{ action: "สร้างคำขอ", timestamp: "28 ส.ค. 2569 09:15" }] },
  { label: "AI แยกข้อมูล", description: "ระบบแยกข้อมูลความต้องการอัตโนมัติ", status: "COMPLETED", assignee: "AI System", sla: "30 นาที", auditLog: [{ action: "วิเคราะห์ข้อมูลเสร็จสิ้น", timestamp: "28 ส.ค. 2569 09:17" }] },
  { label: "RAG ค้นระเบียบ", description: "ค้นหาระเบียบพัสดุที่เกี่ยวข้อง", status: "IN_PROGRESS", assignee: "AI System", sla: "1 ชั่วโมง", auditLog: [{ action: "กำลังค้นหาระเบียบ", timestamp: "28 ส.ค. 2569 09:20" }] },
  { label: "คำแนะนำ", description: "AI สรุปคำแนะนำตามระเบียบ", status: "PENDING", sla: "2 ชั่วโมง" },
  { label: "แนบใบเสนอราคา", description: "ผู้ใช้แนบใบเสนอราคาจากผู้ขาย", status: "PENDING", assignee: "สมชาย ใจดี", sla: "2 วัน" },
  { label: "ตรวจความครบถ้วน", description: "ตรวจสอบเอกสารและร่าง TOR เบื้องต้น", status: "PENDING", sla: "1 วัน" },
  { label: "เจ้าหน้าที่ตรวจทาน", description: "เจ้าหน้าที่พัสดุตรวจสอบร่าง TOR", status: "PENDING", assignee: "อนงค์ พัสดุ", sla: "3 วัน" },
  { label: "สร้างคำขอ", description: "สร้างคำขอจัดซื้อจัดจ้างในระบบ", status: "PENDING", sla: "1 วัน" },
  { label: "ติดตามสถานะ", description: "ติดตามสถานะการอนุมัติ", status: "PENDING", sla: "ต่อเนื่อง" },
];

const statusConfig: Record<StepStatus, { color: "warning" | "accent" | "success" | "danger"; icon: typeof FiClock; label: string }> = {
  PENDING: { color: "warning", icon: FiClock, label: "รอดำเนินการ" },
  IN_PROGRESS: { color: "accent", icon: FiRefreshCw, label: "กำลังดำเนินการ" },
  COMPLETED: { color: "success", icon: FiCheck, label: "เสร็จสิ้น" },
  REVISION_NEEDED: { color: "danger", icon: FiAlertCircle, label: "ต้องแก้ไข" },
};

const initialNodes: WorkflowStepNode[] = steps.map((data, i) => ({
  id: `step-${i + 1}`,
  type: "workflowStep",
  position: { x: 220 * (i % 3), y: 180 * Math.floor(i / 3) },
  data,
}));

const initialEdges: Edge[] = steps.slice(0, -1).map((_, i) => ({
  id: `e${i}-${i + 1}`,
  source: `step-${i + 1}`,
  target: `step-${i + 2}`,
  type: "smoothstep",
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
  style: { stroke: "#b95817", strokeWidth: 2 },
}));

function StepNode({ data }: NodeProps<WorkflowStepNode>) {
  const { color, icon: Icon } = statusConfig[data.status];
  return (
    <div className="w-52 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-bold tracking-wider text-stone-400">STEP</span>
        <Chip className="text-xs" color={color} size="sm" variant="soft">{statusConfig[data.status].label}</Chip>
      </div>
      <p className="mb-1 text-sm font-bold text-[#272522]">{data.label}</p>
      <p className="mb-3 text-xs text-stone-500">{data.description}</p>
      <div className="flex items-center gap-2 text-xs text-stone-400">
        <Icon className={`shrink-0 ${color === "success" ? "text-green-600" : color === "accent" ? "text-blue-600" : color === "danger" ? "text-red-500" : "text-amber-500"}`} />
        {data.assignee ?? "—"}
      </div>
    </div>
  );
}

const nodeTypes = { workflowStep: StepNode };

const detailTitles: Record<string, string> = {
  "step-1": "บอกความต้องการ",
  "step-2": "AI แยกข้อมูล",
  "step-3": "RAG ค้นระเบียบ",
  "step-4": "คำแนะนำ",
  "step-5": "แนบใบเสนอราคา",
  "step-6": "ตรวจความครบถ้วนและร่าง TOR",
  "step-7": "เจ้าหน้าที่ตรวจทาน",
  "step-8": "สร้างคำขอ",
  "step-9": "ติดตามสถานะ",
};

export function WorkflowDiagram() {
  const [selectedNode, setSelectedNode] = useState<WorkflowStepNode | null>(null);
  const modalState = useOverlayState();

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node as WorkflowStepNode);
    modalState.open();
  }, [modalState]);

  return (
    <div className="relative">
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs">
        <span className="font-semibold text-stone-500">สถานะ:</span>
        {(Object.entries(statusConfig) as [StepStatus, typeof statusConfig[StepStatus]][]).map(([key, { color, icon: Icon, label }]) => (
          <span className="flex items-center gap-1.5" key={key}>
            <Icon className={`${color === "success" ? "text-green-600" : color === "accent" ? "text-blue-600" : color === "danger" ? "text-red-500" : "text-amber-500"}`} size={14} />
            <span className="text-stone-600">{label}</span>
          </span>
        ))}
      </div>
      <div className="h-[32rem] w-full rounded-2xl border border-stone-200 bg-stone-50" style={{ direction: "ltr" }}>
        <ReactFlow
          edgeTypes={{}}
          edges={initialEdges}
          fitView
          nodeTypes={nodeTypes}
          nodes={initialNodes}
          onNodeClick={onNodeClick}
          panOnDrag
          zoomOnScroll
        >
          <Background color="#d9d7d3" gap={20} variant={BackgroundVariant.Dots} />
          <Controls className="rounded-xl border border-stone-200 bg-white shadow-sm" />
        </ReactFlow>
      </div>

      <Modal state={modalState}>
        <Modal.Backdrop />
        <Modal.Container size="md">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>{selectedNode ? detailTitles[selectedNode.id] : ""}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              {selectedNode && (
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="mb-1 text-xs font-semibold text-stone-500">คำอธิบาย</p>
                    <p>{selectedNode.data.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="mb-1 text-xs font-semibold text-stone-500">สถานะ</p>
                      <Chip className="text-xs" color={statusConfig[selectedNode.data.status].color} size="sm" variant="soft">{statusConfig[selectedNode.data.status].label}</Chip>
                    </div>
                    {selectedNode.data.assignee && (
                      <div>
                        <p className="mb-1 text-xs font-semibold text-stone-500">ผู้รับผิดชอบ</p>
                        <p>{selectedNode.data.assignee}</p>
                      </div>
                    )}
                    {selectedNode.data.sla && (
                      <div>
                        <p className="mb-1 text-xs font-semibold text-stone-500">SLA</p>
                        <p>{selectedNode.data.sla}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold text-stone-500">Audit Log</p>
                    {selectedNode.data.auditLog && selectedNode.data.auditLog.length > 0 ? (
                      <div className="space-y-2">
                        {selectedNode.data.auditLog.map((entry, i) => (
                          <div className="flex items-start gap-3 rounded-xl bg-stone-50 px-3 py-2" key={i}>
                            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#b95817]" />
                            <div><p className="text-xs font-medium">{entry.action}</p><p className="text-[0.7rem] text-stone-400">{entry.timestamp}</p></div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-stone-400">ยังไม่มีรายการ</p>
                    )}
                  </div>
                </div>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Modal.CloseTrigger />
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal>
    </div>
  );
}