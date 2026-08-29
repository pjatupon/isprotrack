"use client";

import { Button, Card, Input, Label, TextField } from "@heroui/react";
import { useState, useTransition } from "react";
import { FiArrowRight, FiBriefcase } from "react-icons/fi";
import { authClient } from "@/lib/auth-client";

type Mode = "login" | "register";

function getCallbackURL() {
  const callbackURL = new URLSearchParams(window.location.search).get("callbackURL");
  return callbackURL?.startsWith("/") ? callbackURL : "/dashboard";
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const department = String(formData.get("department") ?? "").trim();

    setError(undefined);

    if (!email || !password || (mode === "register" && !name)) {
      setError("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
      return;
    }

    startTransition(async () => {
      const callbackURL = getCallbackURL();
      const result = mode === "login"
        ? await authClient.signIn.email({ email, password, callbackURL })
        : await authClient.signUp.email({
            name,
            email,
            password,
            department: department || undefined,
            callbackURL,
          });

      if (result.error) {
        setError(result.error.message ?? "ไม่สามารถดำเนินการได้ โปรดลองอีกครั้ง");
      }
    });
  }

  function signInWithGoogle() {
    setError(undefined);
    startTransition(async () => {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: getCallbackURL(),
      });

      if (result.error) {
        setError(result.error.message ?? "ไม่สามารถเชื่อมต่อ Google ได้");
      }
    });
  }

  return (
    <main className="min-h-screen bg-[#272522] px-5 py-8 text-stone-900 sm:grid sm:place-items-center sm:p-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] bg-stone-100 shadow-2xl shadow-black/30 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="relative overflow-hidden bg-[#e87722] p-8 text-[#272522] sm:p-12">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full border-[28px] border-[#f6ba75]/70" />
          <div className="absolute -bottom-24 -left-20 h-56 w-56 rounded-full border-[34px] border-[#b84f12]" />
          <div className="relative flex h-full min-h-64 flex-col justify-between">
            <div className="flex items-center gap-3 font-bold tracking-wide">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#272522] text-lg text-[#f6a45b]">IS</span>
              <span>PROTRACK</span>
            </div>
            <div className="mt-16">
              <p className="mb-4 text-sm font-bold tracking-[0.2em] text-[#71320c]">KHON KAEN UNIVERSITY</p>
              <h1 className="max-w-sm text-3xl font-bold leading-tight sm:text-4xl">ทุกคำขอจัดซื้อ เดินหน้าอย่างโปร่งใส</h1>
              <p className="mt-5 max-w-sm leading-7 text-[#56270b]">ระบบติดตามและบริหารการจัดซื้อจัดจ้างอัจฉริยะ คณะสหวิทยาการ มหาวิทยาลัยขอนแก่น</p>
            </div>
            <div className="mt-12 flex items-center gap-3 text-sm font-medium text-[#65300f]">
              <FiBriefcase aria-hidden="true" />
              Procurement workspace for SIS, KKU
            </div>
          </div>
        </section>

        <section className="p-6 sm:p-10 lg:p-12">
          <Card className="border-0 bg-transparent shadow-none">
            <Card.Header className="px-0 pt-0">
              <div>
                <p className="text-sm font-semibold text-[#b84f12]">SECURE ACCESS</p>
                <Card.Title className="mt-2 text-3xl font-bold tracking-tight text-[#272522]">
                  {mode === "login" ? "เข้าสู่ระบบ" : "สร้างบัญชีผู้ใช้งาน"}
                </Card.Title>
                <Card.Description className="mt-2 text-stone-600">
                  {mode === "login" ? "ยินดีต้อนรับกลับสู่ IS ProTrack" : "ลงทะเบียนเพื่อเริ่มต้นจัดการคำขอของคุณ"}
                </Card.Description>
              </div>
            </Card.Header>

            <Card.Content className="px-0">
              <div className="mb-6 grid grid-cols-2 rounded-xl bg-stone-200 p-1">
                <button
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === "login" ? "bg-white text-[#272522] shadow-sm" : "text-stone-600"}`}
                  onClick={() => { setMode("login"); setError(undefined); }}
                  type="button"
                >
                  เข้าสู่ระบบ
                </button>
                <button
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === "register" ? "bg-white text-[#272522] shadow-sm" : "text-stone-600"}`}
                  onClick={() => { setMode("register"); setError(undefined); }}
                  type="button"
                >
                  ลงทะเบียน
                </button>
              </div>

              <form action={submit} className="space-y-4">
                {mode === "register" && (
                  <TextField isRequired name="name">
                    <Label>ชื่อ-นามสกุล</Label>
                    <Input autoComplete="name" placeholder="เช่น สมชาย ใจดี" />
                  </TextField>
                )}
                <TextField isRequired name="email" type="email">
                  <Label>อีเมล</Label>
                  <Input autoComplete="email" placeholder="name@kku.ac.th" />
                </TextField>
                {mode === "register" && (
                  <TextField name="department">
                    <Label>หน่วยงาน / สาขา</Label>
                    <Input autoComplete="organization" placeholder="คณะสหวิทยาการ" />
                  </TextField>
                )}
                <TextField isRequired name="password" type="password">
                  <Label>รหัสผ่าน</Label>
                  <Input autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} placeholder="อย่างน้อย 8 ตัวอักษร" />
                </TextField>

                {error && <p aria-live="polite" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

                <Button className="mt-2 bg-[#e87722] font-bold text-white hover:bg-[#c85f13]" fullWidth isDisabled={isPending} type="submit">
                  {isPending ? "กำลังดำเนินการ..." : mode === "login" ? "เข้าสู่ระบบ" : "สร้างบัญชี"}
                  {!isPending && <FiArrowRight aria-hidden="true" />}
                </Button>
              </form>

              <div className="my-6 flex items-center gap-3 text-xs text-stone-500 before:h-px before:flex-1 before:bg-stone-200 after:h-px after:flex-1 after:bg-stone-200">หรือ</div>

              <Button className="border border-stone-300 bg-white font-semibold text-[#272522] hover:bg-stone-50" fullWidth isDisabled={isPending} onPress={signInWithGoogle} type="button" variant="secondary">
                <span className="text-base font-bold text-[#4285f4]">G</span>
                ดำเนินการต่อด้วย Google @kku.ac.th
              </Button>
            </Card.Content>
          </Card>
        </section>
      </div>
    </main>
  );
}
