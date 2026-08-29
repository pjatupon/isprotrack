import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { auth } from "../src/lib/auth";
import type { ProcurementStatus } from "../src/generated/prisma/enums";

const DEMO_PASSWORD = "Ismart123!";

const DEMO_USERS = [
  {
    name: "ผู้ดูแลระบบ Demo",
    email: "admin@kku.ac.th",
    role: "ADMIN",
    department: "คณะสหวิทยาการ",
  },
  {
    name: "เจ้าหน้าที่พัสดุ Demo",
    email: "staff@kku.ac.th",
    role: "STAFF",
    department: "งานพัสดุ คณะสหวิทยาการ",
  },
  {
    name: "ผู้อนุมัติ Demo",
    email: "approver@kku.ac.th",
    role: "APPROVER",
    department: "สำนักงานคณบดี คณะสหวิทยาการ",
  },
  {
    name: "ผู้ขอจัดซื้อ Demo",
    email: "requester@kku.ac.th",
    role: "REQUESTER",
    department: "สาขาเทคโนโลยีสารสนเทศ",
  },
] as const;

async function seedUsers() {
  console.log("🌱 Seeding users...");

  for (const demo of DEMO_USERS) {
    const existing = await prisma.user.findUnique({
      where: { email: demo.email },
    });

    if (existing) {
      await prisma.user.update({
        where: { email: demo.email },
        data: {
          role: demo.role,
          department: demo.department,
          emailVerified: true,
        },
      });
      console.log(`  • ${demo.email} — updated role to ${demo.role}`);
      continue;
    }

    await auth.api.signUpEmail({
      body: {
        name: demo.name,
        email: demo.email,
        password: DEMO_PASSWORD,
        department: demo.department,
      },
    });

    await prisma.user.update({
      where: { email: demo.email },
      data: {
        role: demo.role,
        emailVerified: true,
      },
    });

    console.log(`  • ${demo.email} — created (${demo.role})`);
  }

  return prisma.user.findMany({ orderBy: { role: "asc" } });
}

async function seedRegulations() {
  console.log("🌱 Seeding regulation documents...");

  const staff = await prisma.user.findUniqueOrThrow({
    where: { email: "staff@kku.ac.th" },
  });

  const regulations = [
    {
      title: "ระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560",
      issueNo: "ระเบียบ 2560",
      effectiveFrom: new Date("2017-01-01"),
      sections: [
        "ข้อ 2 ระเบียบนี้เรียกว่า ระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 และให้ใช้บังคับตั้งแต่วันที่ 23 สิงหาคม พ.ศ. 2560 เป็นต้นไป",
        "ข้อ 9 การจัดซื้อจัดจ้างวงเงินเกิน 500,000 บาท ต้องดำเนินการด้วยวิธีประกาศเชิญชวนทั่วไป หรือวิธีคัดเลือก หรือวิธีเฉพาะเจาะจง ตามหลักเกณฑ์ที่กำหนดไว้ในระเบียบนี้",
        "ข้อ 12 หัวหน้าหน่วยงานของรัฐมีอำนาจในการจัดซื้อจัดจ้าง และสามารถมอบอำนาจให้รองหัวหน้าหน่วยงานหรือผู้ดำรงตำแหน่งอื่นดำเนินการแทนได้ตามความเหมาะสม",
      ],
      status: "ACTIVE",
    },
    {
      title: "พระราชบัญญัติการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560",
      issueNo: "พ.ร.บ. 2560",
      effectiveFrom: new Date("2017-02-22"),
      sections: [
        "มาตรา 4 ในพระราชบัญญัตินี้ พัสดุ หมายความว่า สิ่งของ งานบริการ งานก่อสร้าง งานจ้างที่ปรึกษา และงานจ้างออกแบบหรือควบคุมงานก่อสร้าง",
        "มาตรา 8 การจัดซื้อจัดจ้างต้องเป็นไปอย่างคุ้มค่า โปร่งใส มีประสิทธิภาพและประสิทธิผล และต้องไม่เลือกปฏิบัติต่อผู้ยื่นข้อเสนอ",
      ],
      status: "ACTIVE",
    },
    {
      title: "ประกาศคณะกรรมการราคากลางและขึ้นทะเบียนผู้ประกอบการ เรื่องหลักเกณฑ์การคำนวณราคากลาง",
      issueNo: "ประกาศ ราคากลาง",
      effectiveFrom: new Date("2020-03-15"),
      sections: [
        "การคำนวณราคากลางงานก่อสร้าง ให้ใช้สูตรราคากลางที่คณะกรรมการกำหนด โดยให้อ้างอิงจากบัญชีราคามาตรฐานค่าก่อสร้างของกระทรวงพาณิชย์",
        "การจัดทำราคากลางต้องลงนามรับรองโดยผู้มีอำนาจ และแนบรายละเอียดการคำนวณไว้ในเอกสารประกอบการจัดซื้อจัดจ้าง",
      ],
      status: "SUPERSEDED",
    },
  ];

  const category = await prisma.knowledgeCategory.upsert({
    where: { name: "ระเบียบพัสดุ" },
    update: { description: "ระเบียบ กฎหมาย และประกาศที่เกี่ยวข้องกับการจัดซื้อจัดจ้างภาครัฐ" },
    create: { name: "ระเบียบพัสดุ", description: "ระเบียบ กฎหมาย และประกาศที่เกี่ยวข้องกับการจัดซื้อจัดจ้างภาครัฐ" },
  });

  for (const reg of regulations) {
    const existing = await prisma.regulationDocument.findFirst({
      where: { title: reg.title },
    });

    if (existing) {
      if (!existing.categoryId) {
        await prisma.regulationDocument.update({
          where: { id: existing.id },
          data: { categoryId: category.id, documentType: "REGULATION" },
        });
      }
      console.log(`  • ${reg.title} — already exists, skipping`);
      continue;
    }

    const doc = await prisma.regulationDocument.create({
      data: {
        title: reg.title,
        issueNo: reg.issueNo,
        effectiveFrom: reg.effectiveFrom,
        status: reg.status as "ACTIVE" | "SUPERSEDED",
        categoryId: category.id,
        documentType: "REGULATION",
      },
    });

    const chunks = reg.sections.map((section, i) => ({
      documentId: doc.id,
      content: section,
      embedding: null,
      section: `ข้อ/หมวดที่ ${i + 1}`,
      page: Math.floor(i / 3) + 1,
      checksum: `seed_${doc.id}_${i}`,
      reviewedBy: staff.id,
      reviewedAt: new Date(),
    }));

    if (chunks.length > 0) {
      await prisma.regulationChunk.createMany({ data: chunks });
    }

    console.log(`  • ${reg.title} — created with ${chunks.length} chunks`);
  }
}

async function seedRequests(users: Awaited<ReturnType<typeof seedUsers>>) {
  console.log("🌱 Seeding procurement requests...");

  const requester = users.find((u) => u.email === "requester@kku.ac.th")!;
  const staff = users.find((u) => u.email === "staff@kku.ac.th")!;
  const approver = users.find((u) => u.email === "approver@kku.ac.th")!;

  const requests: {
    title: string;
    objective: string;
    budget: number;
    budgetSource: string;
    procurementType: string;
    procurementMethod: string;
    status: ProcurementStatus;
    requesterId: string;
  }[] = [
    {
      title: "จัดซื้อคอมพิวเตอร์ตั้งโต๊ะพร้อมจอภาพ สำหรับห้องปฏิบัติการสาขาเทคโนโลยีสารสนเทศ",
      objective: "เพื่อทดแทนเครื่องคอมพิวเตอร์ที่เสื่อมสภาพ จำนวน 20 เครื่อง สำหรับห้องปฏิบัติการคอมพิวเตอร์",
      budget: 480000,
      budgetSource: "งบประมาณแผ่นดิน ประจำปี 2569",
      procurementType: "ซื้อพัสดุ",
      procurementMethod: "เฉพาะเจาะจง",
      status: "SUBMITTED",
      requesterId: requester.id,
    },
    {
      title: "จ้างเหมาปรับปรุงห้องประชุมชั้น 3 อาคารศูนย์ศึกษาและวิจัย",
      objective: "ปรับปรุงระบบไฟฟ้า ฝ้าเพดาน และพื้นห้องประชุม เพื่อรองรับการใช้งานของคณาจารย์และบุคลากร",
      budget: 1250000,
      budgetSource: "เงินรายได้ของคณะ",
      procurementType: "จ้างเหมา",
      procurementMethod: "ประกาศเชิญชวนทั่วไป",
      status: "IN_REVIEW",
      requesterId: requester.id,
    },
    {
      title: "จัดซื้อครุภัณฑ์เครื่องมือวิจัย (เครื่องสเปกโตรโฟโตมิเตอร์)",
      objective: "เพื่อสนับสนุนงานวิจัยด้านวิทยาศาสตร์สิ่งแวดล้อมของสาขาวิชา",
      budget: 950000,
      budgetSource: "งบประมาณวิจัย",
      procurementType: "ซื้อพัสดุ",
      procurementMethod: "เฉพาะเจาะจง",
      status: "APPROVED",
      requesterId: requester.id,
    },
    {
      title: "จัดซื้อวัสดุสำนักงานประจำไตรมาส",
      objective: "จัดซื้อวัสดุสำนักงานสำหรับใช้ในงานธุรการของคณะฯ",
      budget: 85000,
      budgetSource: "งบดำเนินงาน",
      procurementType: "ซื้อพัสดุ",
      procurementMethod: "เฉพาะเจาะจง",
      status: "COMPLETED",
      requesterId: requester.id,
    },
  ];

  const created = [];
  for (const req of requests) {
    const existing = await prisma.procurementRequest.findFirst({
      where: { title: req.title },
    });

    if (existing) {
      console.log(`  • ${req.title} — already exists, skipping`);
      created.push(existing);
      continue;
    }

    const createdReq = await prisma.procurementRequest.create({
      data: {
        ...req,
        budget: req.budget,
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000),
      },
    });
    created.push(createdReq);
    console.log(`  • ${req.title} — created (${req.status})`);
  }

  // Seed a DocumentIntake for the first request (verified quotation)
  const first = created[0];
  if (first) {
    const hasIntake = await prisma.documentIntake.findFirst({
      where: { requestId: first.id },
    });
    if (!hasIntake) {
      await prisma.documentIntake.create({
        data: {
          requestId: first.id,
          vendorName: "บจก. สยามเน็ตเวิร์ก โซลูชั่น",
          taxId: "0105562012345",
          totalAmount: 468000,
          vatAmount: 32800,
          priceValidityDays: 60,
          isVerified: true,
        },
      });
      console.log("  • DocumentIntake (ใบเสนอราคา) — created");
    }
  }

  // Seed a TOR draft for the IN_REVIEW request
  const torRequest = created.find((r) => r.status === "IN_REVIEW");
  if (torRequest) {
    const hasTor = await prisma.torDraft.findFirst({
      where: { requestId: torRequest.id },
    });
    if (!hasTor) {
      await prisma.torDraft.create({
        data: {
          requestId: torRequest.id,
          objective: torRequest.objective,
          scope: "ปรับปรุงห้องประชุมชั้น 3 ประกอบด้วยงานระบบไฟฟ้า งานฝ้าเพดาน งานพื้น และงานทาสี ภายในระยะเวลา 90 วัน",
          specifications:
            "1) งานระบบไฟฟ้าเป็นไปตามมาตรฐาน วสท. 2) ฝ้าเพดานใช้แผ่นยิปซั่มทนความชื้น 3) พื้นใช้กระเบื้องยางมาตรฐาน",
          deliverables: "ส่งมอบงานแล้วเสร็จสมบูรณ์ พร้อมเอกสารการรับประกันงาน 1 ปี",
          inspectionCriteria: "คณะกรรมการตรวจรับพัสดุตรวจสอบตามแบบรูปรายการที่กำหนด",
          version: 1,
          isLockInRisk: false,
        },
      });
      console.log("  • TorDraft — created");
    }
  }

  // Seed audit logs referencing recent user actions
  const auditCount = await prisma.auditLog.count();
  if (auditCount === 0) {
    const now = Date.now();
    const auditEntries = [
      {
        userId: staff.id,
        action: "create_regulation_document",
        prompt: "นำเข้าคลังระเบียบ: ระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้าง",
        output: JSON.stringify({ source: "seed" }),
        timestamp: new Date(now - 3 * 86400000),
      },
      {
        userId: approver.id,
        action: "update_request_status",
        prompt: "อนุมัติคำขอจัดซื้อครุภัณฑ์เครื่องมือวิจัย",
        output: JSON.stringify({ status: "APPROVED", source: "seed" }),
        timestamp: new Date(now - 2 * 86400000),
      },
      {
        userId: staff.id,
        action: "ai_consult",
        prompt: "สอบถามขั้นตอนการจัดซื้อจัดจ้างด้วยวิธีเฉพาะเจาะจง",
        output: JSON.stringify({ model: "gemini-2.5-flash", source: "seed" }),
        modelName: "gemini-2.5-flash",
        timestamp: new Date(now - 86400000),
      },
    ];
    await prisma.auditLog.createMany({ data: auditEntries });
    console.log("  • AuditLog — seeded 3 entries");
  }
}

async function seedKnowledgeCategories() {
  console.log("🌱 Seeding knowledge categories...");

  const categories = [
    { name: "ระเบียบพัสดุ", description: "ระเบียบ กฎหมาย และประกาศที่เกี่ยวข้องกับการจัดซื้อจัดจ้างภาครัฐ" },
    { name: "เอกสารตัวอย่าง", description: "ตัวอย่างเอกสาร/แบบฟอร์มที่ใช้ในกระบวนการจัดซื้อจัดจ้าง" },
    { name: "Workflow", description: "แนวปฏิบัติและขั้นตอนการทำงานของกระบวนการจัดซื้อจัดจ้าง" },
  ];

  for (const category of categories) {
    await prisma.knowledgeCategory.upsert({
      where: { name: category.name },
      update: { description: category.description },
      create: category,
    });
    console.log(`  • ${category.name} — ready`);
  }
}

async function main() {
  console.log("========== IS ProTrack Database Seed ==========");

  const users = await seedUsers();
  await seedKnowledgeCategories();
  await seedRegulations();
  await seedRequests(users);

  console.log("\n✅ Seed completed successfully!");
  console.log("\n🔑 Demo accounts (รหัสผ่านทั้งหมด: Ismart123!):");
  for (const u of users) {
    console.log(`   • ${u.email}  (${u.role})`);
  }
  console.log("\n💡 เข้าสู่ระบบได้ที่ /login หรือ /signin");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
