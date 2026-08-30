import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildDocxFromSections, downloadDocxHeader } from "@/lib/docx";

type TorExportBody = {
  title?: string;
  objective?: string;
  scope?: string;
  specifications?: string;
  deliverables?: string;
  inspectionCriteria?: string;
};

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" }, { status: 401 });
  }

  let body: TorExportBody;
  try {
    body = (await request.json()) as TorExportBody;
  } catch {
    return NextResponse.json({ error: "รูปแบบคำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim() || "ร่างข้อกำหนดและขอบเขตงาน (TOR)";
  const objective = String(body.objective ?? "").trim();
  const scope = String(body.scope ?? "").trim();
  const specifications = String(body.specifications ?? "").trim();
  const deliverables = String(body.deliverables ?? "").trim();
  const inspectionCriteria = String(body.inspectionCriteria ?? "").trim();

  if (!objective || !scope || !specifications) {
    return NextResponse.json(
      { error: "กรุณากรอกอย่างน้อยวัตถุประสงค์ ขอบเขต และคุณลักษณะเฉพาะ" },
      { status: 400 },
    );
  }

  try {
    const docx = buildDocxFromSections(
      [
        { heading: "1. วัตถุประสงค์", body: objective },
        { heading: "2. ขอบเขตของงาน (Scope of Work)", body: scope },
        { heading: "3. คุณลักษณะเฉพาะ (Specifications)", body: specifications },
        { heading: "4. กำหนดเวลาและสถานที่ส่งมอบ", body: deliverables },
        { heading: "5. หลักเกณฑ์การตรวจรับพัสดุ", body: inspectionCriteria },
      ],
      { title },
    );

    const safeName = title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
    const fileName = `${safeName}.docx`;

    return new NextResponse(new Uint8Array(docx), {
      status: 200,
      headers: downloadDocxHeader(fileName),
    });
  } catch (error) {
    console.error("tor/export error:", error);
    const message = error instanceof Error ? error.message : "ไม่สามารถสร้างไฟล์ .docx ได้";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
