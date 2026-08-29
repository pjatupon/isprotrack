"use client";

import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { LuArrowLeft, LuCircleOff, LuHouse } from "react-icons/lu";

export default function NotFound() {
  const router = useRouter();

  return (
    <section className="not-found-page">
      <div className="not-found-panel">
        <div className="not-found-mark">
          <span>404</span>
          <span aria-hidden="true" />
          <LuCircleOff aria-hidden="true" size={54} strokeWidth={2.25} />
        </div>
        <p className="not-found-kicker">IS KKU SMART OFFICE</p>
        <h1>ไม่พบหน้าที่คุณต้องการ</h1>
        <p className="not-found-copy">
          ลิงก์อาจไม่ถูกต้อง หน้านี้อาจถูกย้าย หรือคุณอาจไม่มีรายการนี้ในระบบแล้ว
        </p>
        <div className="not-found-actions">
          <Button onPress={() => router.push("/")}>
            <LuHouse aria-hidden="true" size={18} />
            กลับหน้าแรก
          </Button>
          <Button onPress={() => router.back()} variant="outline">
            <LuArrowLeft aria-hidden="true" size={18} />
            ย้อนกลับ
          </Button>
        </div>
      </div>
    </section>
  );
}