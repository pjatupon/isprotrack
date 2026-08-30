import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TOR_PREFILL_STORAGE_KEY,
  consumeTorPrefill,
  saveTorPrefill,
} from "../src/lib/ai/consult-handoff";

function mockSessionStorage() {
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>).window = {
    sessionStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
  };
  return store;
}

test("saveTorPrefill + consumeTorPrefill เก็บและอ่านค่าได้ และล้างข้อมูลหลังอ่าน", () => {
  const store = mockSessionStorage();
  saveTorPrefill({ objective: "จัดซื้อเครื่องพิมพ์", scope: "พิมพ์เอกสาร" });

  assert.ok(store.has(TOR_PREFILL_STORAGE_KEY));

  const payload = consumeTorPrefill();
  assert.equal(payload?.objective, "จัดซื้อเครื่องพิมพ์");
  assert.equal(payload?.scope, "พิมพ์เอกสาร");
  assert.equal(payload?.quantity, "");
  assert.equal(payload?.budget, "");
  assert.equal(payload?.usageDate, "");
  assert.equal(payload?.procurementType, "");
  assert.equal(payload?.procurementMethod, "");
  assert.equal(payload?.aiSummary, "");

  // หลัง consume แล้วควรถูกลบออก
  assert.equal(store.has(TOR_PREFILL_STORAGE_KEY), false);
  assert.equal(consumeTorPrefill(), null);
});

test("saveTorPrefill เก็บข้อมูลความต้องการครบถ้วนและอ่านกลับได้", () => {
  mockSessionStorage();
  saveTorPrefill({
    objective: "จัดซื้อเครื่องพิมพ์",
    scope: "พิมพ์เอกสาร",
    quantity: "2 เครื่อง",
    budget: "50000",
    usageDate: "2026-12-01",
    procurementType: "ซื้อพัสดุ",
    procurementMethod: "เฉพาะเจาะจง",
    aiSummary: "ควรจัดซื้อโดยวิธีเฉพาะเจาะจง วงเงินไม่เกิน 500,000 บาท",
  });

  const payload = consumeTorPrefill();
  assert.equal(payload?.objective, "จัดซื้อเครื่องพิมพ์");
  assert.equal(payload?.quantity, "2 เครื่อง");
  assert.equal(payload?.budget, "50000");
  assert.equal(payload?.usageDate, "2026-12-01");
  assert.equal(payload?.procurementType, "ซื้อพัสดุ");
  assert.equal(payload?.procurementMethod, "เฉพาะเจาะจง");
  assert.ok(payload?.aiSummary?.includes("วิธีเฉพาะเจาะจง"));
});

test("consumeTorPrefill คืนค่า null เมื่อไม่มีข้อมูล", () => {
  const store = mockSessionStorage();
  assert.equal(consumeTorPrefill(), null);
  assert.equal(store.has(TOR_PREFILL_STORAGE_KEY), false);
});

test("consumeTorPrefill คืนค่า null และไม่ crash เมื่อ JSON ผิดรูปแบบ", () => {
  const store = mockSessionStorage();
  store.set(TOR_PREFILL_STORAGE_KEY, "{invalid json");
  assert.equal(consumeTorPrefill(), null);
});

test("saveTorPrefill ทำงานได้เมื่อไม่มี window (SSR)", () => {
  delete (globalThis as Record<string, unknown>).window;
  assert.doesNotThrow(() => saveTorPrefill({ objective: "A", scope: "B" }));
  assert.equal(consumeTorPrefill(), null);
});
