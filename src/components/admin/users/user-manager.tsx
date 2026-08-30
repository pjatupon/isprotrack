"use client";

import React, { useState, useActionState, useTransition } from "react";
import { Button, Card, Chip, Alert, TextField, Label, Input, Modal, Popover, Tooltip, useOverlayState } from "@heroui/react";
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiMail,
  FiUser,
  FiShield,
  FiAlertTriangle,
  FiCheckCircle,
  FiXCircle,
} from "react-icons/fi";
import { createUser, updateUser, deleteUser } from "@/app/admin/users/actions";
import { ROLE_LABELS, USER_ROLES } from "@/lib/rbac";
import type { UserRole as SchemaUserRole } from "@/generated/prisma/enums";

export type UserManagerView = {
  id: string;
  name: string;
  email: string;
  role: SchemaUserRole;
  department: string | null;
  emailVerified: boolean;
  image: string | null;
  requestCount: number;
  sessionCount: number;
  createdAt: string;
};

const ROLE_COLORS: Record<SchemaUserRole, "default" | "success" | "warning" | "danger" | "accent"> = {
  ADMIN: "danger",
  STAFF: "accent",
  APPROVER: "success",
  REQUESTER: "default",
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
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

function DeleteUserButton({
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
        aria-label={`ลบผู้ใช้ "${name}"`}
        className={`inline-flex h-7 w-7 min-w-0 items-center justify-center rounded-lg border border-red-200 p-1.5 text-red-600 transition ${
          disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:bg-red-50"
        }`}
      >
        <Tooltip.Root>
          <Tooltip.Trigger className="inline-flex">
            <span className="inline-flex items-center justify-center">
              <FiTrash2 size={12} />
            </span>
          </Tooltip.Trigger>
          <Tooltip.Content className="z-50 rounded-lg bg-slate-800 px-2 py-1 text-[0.65rem] font-medium text-white">
            ลบผู้ใช้
          </Tooltip.Content>
        </Tooltip.Root>
      </Popover.Trigger>

      <Popover.Content
        placement="bottom end"
        className="z-50 max-w-72 rounded-xl border border-stone-200 bg-white p-4 shadow-xl"
      >
        <Popover.Dialog className="outline-none">
          <Popover.Heading className="flex items-center gap-1.5 text-sm font-bold text-red-600">
            <FiAlertTriangle size={14} />
            ยืนยันการลบผู้ใช้
          </Popover.Heading>
          <p className="mt-2 text-xs leading-relaxed text-stone-600 [overflow-wrap:anywhere]">
            ต้องการลบผู้ใช้{" "}
            <span className="font-semibold text-stone-800 line-clamp-2">&quot;{name}&quot;</span>{" "}
            แบบถาวรหรือไม่? บัญชี ข้อมูลคำขอ และประวัติทั้งหมดจะถูกลบ ไม่สามารถกู้คืนได้
          </p>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button size="sm" variant="secondary" onPress={popover.close} className="border border-stone-300 text-xs">
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
              ลบถาวร
            </Button>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover.Root>
  );
}

type CreateState = { success?: boolean; message?: string; error?: string } | null;

export function UserManager({ users }: { users: UserManagerView[] }) {
  const [createState, createAction, isCreatePending] = useActionState<CreateState, FormData>(
    createUser,
    null,
  );
  const [editingUser, setEditingUser] = useState<UserManagerView | null>(null);
  const [isMutating, startTransition] = useTransition();
  const createModal = useOverlayState();
  const editModal = useOverlayState();

  const runMutation = (action: () => Promise<{ success: boolean; error?: string }>) => {
    startTransition(async () => {
      const result = await action();
      if (!result.success && result.error) alert(result.error);
    });
  };

  const openEdit = (user: UserManagerView) => {
    setEditingUser(user);
    editModal.open();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2 border-b border-slate-200/80">
        <div className="space-y-1">
          <span className="text-[0.7rem] font-black tracking-widest text-[#8B0000] uppercase">
            USER MANAGEMENT
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800">
            จัดการข้อมูลผู้ใช้
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            เพิ่ม แก้ไข และลบผู้ใช้ พร้อมกำหนดบทบาทและหน่วยงาน
          </p>
        </div>
        <Button
          onPress={createModal.open}
          className="bg-[#8B0000] font-semibold text-white hover:bg-[#6e0000] text-xs"
        >
          <FiPlus /> เพิ่มผู้ใช้
        </Button>
      </div>

      {createState?.error && (
        <Alert status="danger" className="rounded-2xl">
          <Alert.Description className="text-xs">{createState.error}</Alert.Description>
        </Alert>
      )}
      {createState?.success && (
        <Alert status="success" className="rounded-2xl">
          <Alert.Description className="text-xs font-semibold">{createState.message}</Alert.Description>
        </Alert>
      )}

      {/* Users table */}
      <Card className="border border-slate-200/80 bg-white p-5 shadow-xs rounded-xl">
        <Card.Header className="px-0 pt-0">
          <Card.Title className="text-base font-bold text-slate-800">
            รายชื่อผู้ใช้ทั้งหมด ({users.length})
          </Card.Title>
          <Card.Description className="text-xs text-slate-500">
            บทบาทและสิทธิ์ของผู้ใช้สามารถปรับได้จากหน้า &quot;จัดการ RBAC&quot;
          </Card.Description>
        </Card.Header>
        <Card.Content className="px-0 pt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="p-2.5 font-bold text-slate-600">ผู้ใช้</th>
                <th className="p-2.5 font-bold text-slate-600">อีเมล</th>
                <th className="p-2.5 font-bold text-slate-600">บทบาท</th>
                <th className="p-2.5 font-bold text-slate-600">หน่วยงาน</th>
                <th className="p-2.5 font-bold text-slate-600">สถานะ</th>
                <th className="p-2.5 font-bold text-slate-600">คำขอ</th>
                <th className="p-2.5 font-bold text-slate-600">สร้างเมื่อ</th>
                <th className="p-2.5 font-bold text-slate-600 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                  <td className="p-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-red-50 text-xs font-bold text-[#8B0000]">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="font-semibold text-slate-800">{user.name}</span>
                    </div>
                  </td>
                  <td className="p-2.5 text-slate-600">{user.email}</td>
                  <td className="p-2.5">
                    <Chip size="sm" variant="soft" color={ROLE_COLORS[user.role]}>
                      {ROLE_LABELS[user.role]}
                    </Chip>
                  </td>
                  <td className="p-2.5 text-slate-500 max-w-[180px] truncate">
                    {user.department || "—"}
                  </td>
                  <td className="p-2.5">
                    {user.emailVerified ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                        <FiCheckCircle size={13} /> ยืนยันแล้ว
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                        <FiXCircle size={13} /> ยังไม่ยืนยัน
                      </span>
                    )}
                  </td>
                  <td className="p-2.5 text-slate-600">{user.requestCount}</td>
                  <td className="p-2.5 text-slate-500 whitespace-nowrap">{formatDate(user.createdAt)}</td>
                  <td className="p-2.5">
                    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                      <ActionTooltip label="แก้ไขผู้ใช้">
                        <Button
                          size="sm"
                          variant="secondary"
                          isDisabled={isMutating}
                          onPress={() => openEdit(user)}
                          className="border border-slate-300 p-1.5 min-w-0 h-7 w-7"
                          aria-label="แก้ไขผู้ใช้"
                        >
                          <FiEdit2 size={12} />
                        </Button>
                      </ActionTooltip>
                      <DeleteUserButton
                        name={user.name}
                        disabled={isMutating}
                        onConfirm={() => runMutation(() => deleteUser(user.id))}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-400">
                    ยังไม่มีผู้ใช้ในระบบ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card.Content>
      </Card>

      {/* Create user modal */}
      <Modal state={createModal}>
        <Modal.Backdrop>
          <Modal.Container size="md">
            <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2 text-slate-800">
                <FiUser className="text-[#8B0000]" /> เพิ่มผู้ใช้ใหม่
              </Modal.Heading>
            </Modal.Header>
            <form action={createAction}>
              <Modal.Body>
                <div className="space-y-4">
                  <TextField isRequired name="name">
                    <Label className="text-xs font-bold text-slate-700">ชื่อ-นามสกุล</Label>
                    <Input placeholder="เช่น นายสมชาย ใจดี" />
                  </TextField>
                  <TextField isRequired name="email" type="email">
                    <Label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <FiMail /> อีเมล
                    </Label>
                    <Input placeholder="user@kku.ac.th" />
                  </TextField>
                  <TextField isRequired name="password" type="password">
                    <Label className="text-xs font-bold text-slate-700">รหัสผ่านเริ่มต้น</Label>
                    <Input placeholder="อย่างน้อย 8 ตัวอักษร" />
                  </TextField>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <FiShield /> บทบาท
                    </label>
                    <select
                      name="role"
                      defaultValue="REQUESTER"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#8B0000] focus:outline-none"
                    >
                      {USER_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">หน่วยงาน</label>
                    <Input name="department" placeholder="เช่น สาขาเทคโนโลยีสารสนเทศ" />
                  </div>
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button type="button" variant="secondary" className="border border-slate-300 text-xs" onPress={createModal.close}>
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  isDisabled={isCreatePending}
                  className="bg-[#8B0000] font-semibold text-white hover:bg-[#6e0000] text-xs"
                >
                  <FiPlus /> {isCreatePending ? "กำลังสร้าง..." : "สร้างผู้ใช้"}
                </Button>
              </Modal.Footer>
            </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Edit user modal */}
      <Modal state={editModal}>
        <Modal.Backdrop>
          <Modal.Container size="md">
            <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2 text-slate-800">
                <FiEdit2 className="text-[#8B0000]" /> แก้ไขผู้ใช้
              </Modal.Heading>
            </Modal.Header>
            {editingUser && (
              <form
                action={async (formData) => {
                  const result = await updateUser(editingUser.id, formData);
                  if (!result.success && result.error) alert(result.error);
                  if (result.success) editModal.close();
                }}
              >
                <Modal.Body>
                  <div className="space-y-4">
                    <TextField
                      isRequired
                      name="name"
                      key={`${editingUser.id}-name`}
                      defaultValue={editingUser.name}
                    >
                      <Label className="text-xs font-bold text-slate-700">ชื่อ-นามสกุล</Label>
                      <Input />
                    </TextField>
                    <TextField
                      isRequired
                      name="email"
                      type="email"
                      key={`${editingUser.id}-email`}
                      defaultValue={editingUser.email}
                    >
                      <Label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        <FiMail /> อีเมล
                      </Label>
                      <Input />
                    </TextField>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        <FiShield /> บทบาท
                      </label>
                      <select
                        key={`${editingUser.id}-role`}
                        name="role"
                        defaultValue={editingUser.role}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#8B0000] focus:outline-none"
                      >
                        {USER_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">หน่วยงาน</label>
                      <Input
                        key={`${editingUser.id}-dept`}
                        name="department"
                        defaultValue={editingUser.department ?? ""}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        key={`${editingUser.id}-verified`}
                        type="checkbox"
                        name="emailVerified"
                        defaultChecked={editingUser.emailVerified}
                        className="h-4 w-4 rounded border-slate-300 text-[#8B0000] focus:ring-[#8B0000]"
                      />
                      ยืนยันอีเมลแล้ว (Email Verified)
                    </label>
                  </div>
                </Modal.Body>
                <Modal.Footer>
                  <Button type="button" variant="secondary" className="border border-slate-300 text-xs" onPress={editModal.close}>
                    ยกเลิก
                  </Button>
                  <Button type="submit" isDisabled={isMutating} className="bg-[#8B0000] font-semibold text-white hover:bg-[#6e0000] text-xs">
                    <FiCheckCircle /> บันทึกการแก้ไข
                  </Button>
                </Modal.Footer>
              </form>
            )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
