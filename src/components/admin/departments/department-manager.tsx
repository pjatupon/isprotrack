"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Chip, Alert, TextField, Label, Input, Modal, Popover, Tooltip, useOverlayState } from "@heroui/react";
import {
  FiPlus,
  FiCheck,
  FiEdit2,
  FiTrash2,
  FiUsers,
  FiFolder,
  FiAlertTriangle,
  FiRefreshCw,
  FiSearch,
  FiChevronRight,
} from "react-icons/fi";
import {
  saveDepartment,
  deleteDepartment,
  setDepartmentUsers,
} from "@/app/admin/departments/actions";

export type DepartmentView = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  childrenCount: number;
  memberCount: number;
  createdAt: string;
};

export type UserView = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  departmentId: string | null;
};

type TreeNode = DepartmentView & { children: TreeNode[] };

const ROLE_LABELS: Record<string, string> = {
  REQUESTER: "ผู้ขอจัดซื้อ",
  STAFF: "เจ้าหน้าที่พัสดุ",
  APPROVER: "ผู้อนุมัติ",
  ADMIN: "ผู้ดูแลระบบ",
};

function buildTree(nodes: DepartmentView[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  nodes.forEach((node) => map.set(node.id, { ...node, children: [] }));
  const roots: TreeNode[] = [];
  map.forEach((node) => {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function collectSubtreeIds(rootId: string, nodes: DepartmentView[]): Set<string> {
  const result = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (node.parentId && result.has(node.parentId) && !result.has(node.id)) {
        result.add(node.id);
        changed = true;
      }
    }
  }
  return result;
}

function flattenOptions(
  nodes: TreeNode[],
  depth = 0,
  result: { id: string; label: string }[] = [],
): { id: string; label: string }[] {
  for (const node of nodes) {
    result.push({ id: node.id, label: `${"　".repeat(depth)}${depth > 0 ? "└ " : ""}${node.name}` });
    flattenOptions(node.children, depth + 1, result);
  }
  return result;
}

function ActionTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger className="inline-flex">{children}</Tooltip.Trigger>
      <Tooltip.Content className="z-50 rounded-lg bg-slate-800 px-2 py-1 text-[0.65rem] font-medium text-white">
        {label}
      </Tooltip.Content>
    </Tooltip.Root>
  );
}

function DeleteDepartmentButton({
  name,
  disabled,
  onConfirm,
}: {
  name: string;
  disabled: boolean;
  onConfirm: () => void;
}) {
  const popover = useOverlayState();

  return (
    <Popover.Root
      isOpen={popover.isOpen}
      onOpenChange={(open) => {
        if (open && disabled) return;
        popover.setOpen(open);
      }}
    >
      <Popover.Trigger
        aria-label={`ลบหน่วยงาน "${name}"`}
        className={`inline-flex h-7 w-7 min-w-0 items-center justify-center rounded-lg border border-red-200 p-1.5 text-red-600 transition ${
          disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:bg-red-50"
        }`}
      >
        <ActionTooltip label="ลบหน่วยงาน">
          <span className="inline-flex items-center justify-center">
            <FiTrash2 size={12} />
          </span>
        </ActionTooltip>
      </Popover.Trigger>

      <Popover.Content
        placement="bottom end"
        className="z-50 max-w-72 rounded-xl border border-stone-200 bg-white p-4 shadow-xl"
      >
        <Popover.Dialog className="outline-none">
          <Popover.Heading className="flex items-center gap-1.5 text-sm font-bold text-red-600">
            <FiAlertTriangle size={14} />
            ยืนยันการลบหน่วยงาน
          </Popover.Heading>
          <p className="mt-2 text-xs leading-relaxed text-stone-600 [overflow-wrap:anywhere]">
            ต้องการลบหน่วยงาน{" "}
            <span className="font-semibold text-stone-800">&quot;{name}&quot;</span>{" "}
            หรือไม่? สมาชิกในหน่วยงานนี้จะถูกปลดออก และไม่สามารถกู้คืนได้
          </p>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              onPress={popover.close}
              className="border border-stone-300 text-xs"
            >
              ยกเลิก
            </Button>
            <Button
              size="sm"
              onPress={() => {
                popover.close();
                onConfirm();
              }}
              className="bg-red-600 text-xs font-semibold text-white hover:bg-red-700"
            >
              ลบหน่วยงาน
            </Button>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover.Root>
  );
}

function DepartmentFormModal({
  isOpen,
  onClose,
  department,
  creatingFor,
  departments,
  isMutating,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  department: DepartmentView | null;
  creatingFor: DepartmentView | null;
  departments: DepartmentView[];
  isMutating: boolean;
  onSubmit: (formData: FormData) => void;
}) {
  const tree = useMemo(() => buildTree(departments), [departments]);
  const options = useMemo(() => flattenOptions(tree), [tree]);

  const disabledSubtree = useMemo(() => {
    if (!department) return new Set<string>();
    return collectSubtreeIds(department.id, departments);
  }, [department, departments]);

  const defaultParentId =
    department?.parentId ?? creatingFor?.id ?? "";

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container size="md">
          <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading className="flex items-center gap-2 text-slate-800">
              <FiFolder className="text-[#8B0000]" />
              {department ? "แก้ไขหน่วยงาน" : creatingFor ? `เพิ่มหน่วยงานย่อยใน "${creatingFor.name}"` : "เพิ่มหน่วยงานใหม่"}
            </Modal.Heading>
          </Modal.Header>
          <form
            action={(formData: FormData) => {
              if (department) formData.set("id", department.id);
              if (!formData.get("parentId")) {
                formData.set("parentId", defaultParentId);
              }
              onSubmit(formData);
            }}
          >
            <Modal.Body>
              <div className="space-y-4">
                <TextField isRequired name="name">
                  <Label className="text-xs font-bold text-slate-700">ชื่อหน่วยงาน</Label>
                  <Input
                    placeholder="เช่น งานพัสดุ, สาขาวิชาเทคโนโลยีสารสนเทศ"
                    defaultValue={department?.name ?? ""}
                  />
                </TextField>

                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField name="code">
                    <Label className="text-xs font-bold text-slate-700">รหัสหน่วยงาน</Label>
                    <Input
                      placeholder="เช่น PHD (ไม่บังคับ)"
                      defaultValue={department?.code ?? ""}
                    />
                  </TextField>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">หน่วยงานแม่</label>
                    <select
                      name="parentId"
                      key={`${department?.id ?? "new"}-parent`}
                      defaultValue={defaultParentId}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#8B0000] focus:outline-none"
                    >
                      <option value="">— ไม่มี (หน่วยงานระดับบนสุด) —</option>
                      {options.map((option) => {
                        const isDisabled = disabledSubtree.has(option.id);
                        return (
                          <option key={option.id} value={option.id} disabled={isDisabled}>
                            {option.label}
                          </option>
                        );
                      })}
                    </select>
                    {department && disabledSubtree.size > 0 && (
                      <p className="text-[0.68rem] text-slate-400">
                        ไม่สามารถเลือกหน่วยงานตนเองและหน่วยงานย่อยเป็นหน่วยงานแม่ได้
                      </p>
                    )}
                  </div>
                </div>

                <TextField name="description">
                  <Label className="text-xs font-bold text-slate-700">คำอธิบาย</Label>
                  <Input
                    placeholder="รายละเอียด/หน้าที่ของหน่วยงาน (ไม่บังคับ)"
                    defaultValue={department?.description ?? ""}
                  />
                </TextField>

                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField name="sortOrder">
                    <Label className="text-xs font-bold text-slate-700">ลำดับการแสดง</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      defaultValue={String(department?.sortOrder ?? 0)}
                    />
                  </TextField>

                  <label className="flex items-end gap-2 pb-1 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      name="isActive"
                      defaultChecked={department?.isActive ?? true}
                      className="h-4 w-4 rounded border-slate-300 text-[#8B0000] focus:ring-[#8B0000]"
                    />
                    ใช้งานอยู่ (Active)
                  </label>
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button
                type="button"
                variant="secondary"
                className="border border-slate-300 text-xs"
                onPress={onClose}
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                isDisabled={isMutating}
                className="bg-[#8B0000] font-semibold text-white hover:bg-[#6e0000] text-xs"
              >
                {isMutating ? (
                  <>
                    <FiRefreshCw className="animate-spin" /> กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <FiCheck /> {department ? "บันทึกการแก้ไข" : "สร้างหน่วยงาน"}
                  </>
                )}
              </Button>
            </Modal.Footer>
          </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function UsersModal({
  department,
  users,
  isMutating,
  onClose,
  onSubmit,
}: {
  department: DepartmentView | null;
  users: UserView[];
  isMutating: boolean;
  onClose: () => void;
  onSubmit: (userIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() =>
    new Set(
      department ? users.filter((u) => u.departmentId === department.id).map((u) => u.id) : [],
    ),
  );
  const [query, setQuery] = useState("");
  const [dirty, setDirty] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (ROLE_LABELS[u.role] ?? "").toLowerCase().includes(q),
    );
  }, [users, query]);

  const toggle = (id: string) => {
    setDirty(true);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <Modal isOpen={!!department} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading className="flex items-center gap-2 text-slate-800">
              <FiUsers className="text-[#8B0000]" />
              จัดการสมาชิก: {department?.name}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            {department && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">
                    ทำเครื่องหมายผู้ใช้ที่ต้องการให้สังกัดหน่วยงานนี้ (ปัจจุบัน {selected.size} คน)
                  </p>
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      aria-label="ค้นหาผู้ใช้"
                      placeholder="ค้นหาชื่อ / อีเมล / บทบาท..."
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      className="pl-9 w-56 rounded-full bg-slate-50 text-xs"
                    />
                  </div>
                </div>

                <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-50">
                      <tr className="border-b border-slate-200">
                        <th className="p-2.5 w-10"></th>
                        <th className="p-2.5 font-bold text-slate-600">ผู้ใช้</th>
                        <th className="p-2.5 font-bold text-slate-600">บทบาท</th>
                        <th className="p-2.5 font-bold text-slate-600">หน่วยงานปัจจุบัน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((user) => {
                        const isChecked = selected.has(user.id);
                        const otherDept =
                          user.departmentId && user.departmentId !== department.id;
                        return (
                          <tr
                            key={user.id}
                            className={`border-b border-slate-100 transition ${
                              isChecked ? "bg-red-50/40" : "hover:bg-slate-50"
                            }`}
                          >
                            <td className="p-2.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggle(user.id)}
                                className="h-4 w-4 rounded border-slate-300 text-[#8B0000] focus:ring-[#8B0000]"
                              />
                            </td>
                            <td className="p-2.5">
                              <p className="font-semibold text-slate-800">{user.name}</p>
                              <p className="text-[0.68rem] text-slate-400">{user.email}</p>
                            </td>
                            <td className="p-2.5">
                              <Chip size="sm" variant="soft" color={user.role === "ADMIN" ? "danger" : "default"}>
                                {ROLE_LABELS[user.role] ?? user.role}
                              </Chip>
                            </td>
                            <td className="p-2.5 text-slate-500">
                              {user.departmentId === department.id ? (
                                <span className="font-medium text-[#8B0000]">สังกัดหน่วยงานนี้</span>
                              ) : otherDept ? (
                                <span className="inline-flex items-center gap-1">
                                  <FiChevronRight className="h-3 w-3 text-slate-300" />
                                  {user.department}
                                </span>
                              ) : (
                                <span className="text-slate-300">— ไม่มีหน่วยงาน —</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-slate-400">
                            ไม่พบผู้ใช้ที่ตรงกับคำค้นหา
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button
              type="button"
              variant="secondary"
              className="border border-slate-300 text-xs"
              onPress={onClose}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              isDisabled={isMutating || !dirty}
              onPress={() => onSubmit([...selected])}
              className="bg-[#8B0000] font-semibold text-white hover:bg-[#6e0000] text-xs"
            >
              {isMutating ? (
                <>
                  <FiRefreshCw className="animate-spin" /> กำลังบันทึก...
                </>
              ) : (
                <>
                  <FiCheck /> บันทึกสมาชิก ({selected.size} คน)
                </>
              )}
            </Button>
          </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function DepartmentRow({
  node,
  depth,
  isMutating,
  onCreateChild,
  onEdit,
  onManageUsers,
  onDelete,
}: {
  node: TreeNode;
  depth: number;
  isMutating: boolean;
  onCreateChild: (department: DepartmentView) => void;
  onEdit: (department: DepartmentView) => void;
  onManageUsers: (department: DepartmentView) => void;
  onDelete: (departmentId: string) => void;
}) {
  return (
    <React.Fragment>
      <tr className="border-b border-slate-100 hover:bg-slate-50 transition">
        <td className="p-2.5">
          <div className="flex items-start gap-2" style={{ paddingLeft: depth * 24 }}>
            <FiFolder
              className={`mt-0.5 shrink-0 ${node.isActive ? "text-[#8B0000]" : "text-slate-300"}`}
              size={14}
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="font-semibold text-slate-800">{node.name}</p>
                {!node.isActive && (
                  <Chip size="sm" variant="soft" color="default">
                    ปิดใช้งาน
                  </Chip>
                )}
              </div>
              {node.description && (
                <p className="mt-0.5 text-[0.68rem] text-slate-400 leading-snug max-w-[320px] truncate">
                  {node.description}
                </p>
              )}
            </div>
          </div>
        </td>
        <td className="p-2.5">
          {node.code ? (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-bold text-slate-600">
              {node.code}
            </span>
          ) : (
            <span className="text-slate-300">—</span>
          )}
        </td>
        <td className="p-2.5 text-slate-600">
          <span className="inline-flex items-center gap-1">
            <FiUsers className="h-3 w-3 text-slate-400" />
            {node.memberCount}
          </span>
        </td>
        <td className="p-2.5 text-slate-600">
          {node.childrenCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              <FiFolder className="h-3 w-3 text-slate-400" />
              {node.childrenCount}
            </span>
          ) : (
            <span className="text-slate-300">—</span>
          )}
        </td>
        <td className="p-2.5">
          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
            <ActionTooltip label="เพิ่มหน่วยงานย่อย">
              <Button
                size="sm"
                variant="secondary"
                isDisabled={isMutating}
                onPress={() => onCreateChild(node)}
                className="border border-slate-300 p-1.5 min-w-0 h-7 w-7"
                aria-label={`เพิ่มหน่วยงานย่อยใน "${node.name}"`}
              >
                <FiPlus size={12} />
              </Button>
            </ActionTooltip>
            <ActionTooltip label="จัดการสมาชิก">
              <Button
                size="sm"
                variant="secondary"
                isDisabled={isMutating}
                onPress={() => onManageUsers(node)}
                className="border border-slate-300 p-1.5 min-w-0 h-7 w-7"
                aria-label={`จัดการสมาชิกของ "${node.name}"`}
              >
                <FiUsers size={12} />
              </Button>
            </ActionTooltip>
            <ActionTooltip label="แก้ไขหน่วยงาน">
              <Button
                size="sm"
                variant="secondary"
                isDisabled={isMutating}
                onPress={() => onEdit(node)}
                className="border border-slate-300 p-1.5 min-w-0 h-7 w-7"
                aria-label={`แก้ไขหน่วยงาน "${node.name}"`}
              >
                <FiEdit2 size={12} />
              </Button>
            </ActionTooltip>
            <DeleteDepartmentButton
              name={node.name}
              disabled={isMutating}
              onConfirm={() => onDelete(node.id)}
            />
          </div>
        </td>
      </tr>
      {node.children.map((child) => (
        <DepartmentRow
          key={child.id}
          node={child}
          depth={depth + 1}
          isMutating={isMutating}
          onCreateChild={onCreateChild}
          onEdit={onEdit}
          onManageUsers={onManageUsers}
          onDelete={onDelete}
        />
      ))}
    </React.Fragment>
  );
}

export function DepartmentManager({
  departments,
  users,
}: {
  departments: DepartmentView[];
  users: UserView[];
}) {
  const router = useRouter();
  const [isMutating, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<DepartmentView | null>(null);
  const [creatingFor, setCreatingFor] = useState<DepartmentView | null>(null);
  const [managingUsers, setManagingUsers] = useState<DepartmentView | null>(null);

  const tree = useMemo(() => buildTree(departments), [departments]);

  const runMutation = (action: () => Promise<{ success: boolean; message?: string; error?: string }>) => {
    startTransition(async () => {
      const result = await action();
      setFeedback(
        result.success
          ? { success: true, message: result.message ?? "ดำเนินการเรียบร้อย" }
          : { success: false, message: result.error ?? "เกิดข้อผิดพลาด" },
      );
      router.refresh();
    });
  };

  const openCreate = () => {
    setEditingDepartment(null);
    setCreatingFor(null);
    setFormOpen(true);
  };

  const openCreateChild = (parent: DepartmentView) => {
    setEditingDepartment(null);
    setCreatingFor(parent);
    setFormOpen(true);
  };

  const openEdit = (department: DepartmentView) => {
    setEditingDepartment(department);
    setCreatingFor(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingDepartment(null);
    setCreatingFor(null);
  };

  const submitDepartment = (formData: FormData) => {
    runMutation(() => saveDepartment(null, formData).then((result) => {
      if (result.success) closeForm();
      return result;
    }));
  };

  const submitUsers = (departmentId: string, userIds: string[]) => {
    runMutation(() =>
      setDepartmentUsers(departmentId, userIds).then((result) => {
        if (result.success) setManagingUsers(null);
        return result;
      }),
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2 border-b border-slate-200/80">
        <div className="space-y-1">
          <span className="text-[0.7rem] font-black tracking-widest text-[#8B0000] uppercase">
            ORGANIZATIONAL UNITS
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800">
            จัดการหน่วยงาน
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            บริหารจัดการโครงสร้างหน่วยงานของคณะสหวิทยาการ มข. รองรับหน่วยงานแม่-ลูก พร้อมกำหนดผู้ใช้ในแต่ละหน่วยงาน
          </p>
        </div>
        <Button
          onPress={openCreate}
          className="bg-[#8B0000] font-semibold text-white hover:bg-[#6e0000] text-xs"
        >
          <FiPlus /> เพิ่มหน่วยงาน
        </Button>
      </div>

      {/* Feedback */}
      {feedback && (
        <Alert status={feedback.success ? "success" : "danger"} className="rounded-2xl">
          <Alert.Description className="text-xs font-semibold flex items-center gap-1.5">
            {feedback.success ? <FiCheck /> : <FiAlertTriangle />} {feedback.message}
          </Alert.Description>
        </Alert>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border border-slate-200/80 bg-white p-4 rounded-xl shadow-none">
          <Card.Title className="text-2xl font-extrabold text-slate-800">{departments.length}</Card.Title>
          <Card.Description className="text-xs text-slate-500">หน่วยงานทั้งหมด</Card.Description>
        </Card>
        <Card className="border border-slate-200/80 bg-white p-4 rounded-xl shadow-none">
          <Card.Title className="text-2xl font-extrabold text-slate-800">
            {departments.filter((d) => !d.parentId).length}
          </Card.Title>
          <Card.Description className="text-xs text-slate-500">หน่วยงานระดับบนสุด</Card.Description>
        </Card>
        <Card className="border border-slate-200/80 bg-white p-4 rounded-xl shadow-none">
          <Card.Title className="text-2xl font-extrabold text-slate-800">
            {users.filter((u) => u.departmentId).length}/{users.length}
          </Card.Title>
          <Card.Description className="text-xs text-slate-500">ผู้ใช้ที่ถูกกำหนดหน่วยงานแล้ว</Card.Description>
        </Card>
      </div>

      {/* Tree Table */}
      <Card className="border border-slate-200/80 bg-white p-5 shadow-xs rounded-xl">
        <Card.Header className="px-0 pt-0">
          <Card.Title className="text-base font-bold text-slate-800">โครงสร้างหน่วยงาน</Card.Title>
          <Card.Description className="text-xs text-slate-500">
            แสดงลำดับชั้นหน่วยงานแม่-ลูก ใช้ปุ่ม <FiPlus className="inline" size={10} /> เพื่อสร้างหน่วยงานย่อย
          </Card.Description>
        </Card.Header>

        <Card.Content className="px-0 pt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="p-2.5 font-bold text-slate-600">หน่วยงาน</th>
                <th className="p-2.5 font-bold text-slate-600">รหัส</th>
                <th className="p-2.5 font-bold text-slate-600">สมาชิก</th>
                <th className="p-2.5 font-bold text-slate-600">หน่วยงานย่อย</th>
                <th className="p-2.5 font-bold text-slate-600 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {tree.map((node) => (
                <DepartmentRow
                  key={node.id}
                  node={node}
                  depth={0}
                  isMutating={isMutating}
                  onCreateChild={openCreateChild}
                  onEdit={openEdit}
                  onManageUsers={setManagingUsers}
                  onDelete={(id) => runMutation(() => deleteDepartment(id))}
                />
              ))}
              {tree.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400">
                    ยังไม่มีหน่วยงานในระบบ — กด &quot;เพิ่มหน่วยงาน&quot; เพื่อสร้างหน่วยงานแรก
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card.Content>
      </Card>

      <DepartmentFormModal
        isOpen={formOpen}
        onClose={closeForm}
        department={editingDepartment}
        creatingFor={creatingFor}
        departments={departments}
        isMutating={isMutating}
        onSubmit={submitDepartment}
      />

      <UsersModal
        key={managingUsers?.id ?? "none"}
        department={managingUsers}
        users={users}
        isMutating={isMutating}
        onClose={() => setManagingUsers(null)}
        onSubmit={(userIds) => {
          if (managingUsers) submitUsers(managingUsers.id, userIds);
        }}
      />
    </div>
  );
}
