import { test } from "node:test";
import assert from "node:assert/strict";
import { renderPromptTemplate } from "../src/lib/ai/template";
import { extractJsonObject, parseAiJson, truncate } from "../src/lib/ai/json";

test("renderPromptTemplate แทนที่ตัวแปร {{xxx}} ที่รู้จัก", () => {
  const template = "คำถาม: {{query}}\nบริบท: {{context}}";
  const result = renderPromptTemplate(template, {
    query: "วิธีจัดซื้อคอมพิวเตอร์",
    context: "ระเบียบกระทรวงการคลัง พ.ศ. 2560",
  });
  assert.ok(result.includes("วิธีจัดซื้อคอมพิวเตอร์"));
  assert.ok(result.includes("ระเบียบกระทรวงการคลัง พ.ศ. 2560"));
});

test("renderPromptTemplate ไม่แทนที่ตัวแปรที่ไม่รู้จัก และคงเดิมไว้", () => {
  const template = "{{query}} ยังไม่ตั้งค่า {{missing}}";
  const result = renderPromptTemplate(template, { query: "A" });
  assert.equal(result, "A ยังไม่ตั้งค่า {{missing}}");
});

test("extractJsonObject สกัด JSON ออกจากข้อความที่แทรกคำอธิบาย", () => {
  const text = "นี่คือคำตอบ\n```json\n{\"a\": 1}\n```\nจบ";
  assert.equal(extractJsonObject(text), "{\"a\": 1}");
});

test("extractJsonObject ขว้าง error เมื่อไม่มี JSON", () => {
  assert.throws(() => extractJsonObject("ไม่มี JSON ในข้อความนี้"));
});

test("parseAiJson แปลงข้อความเป็น JSON object", () => {
  const parsed = parseAiJson<{ ok: boolean }>("ตอบ: {\"ok\": true}");
  assert.equal(parsed.ok, true);
});

test("truncate ตัดข้อความยาวเกินที่กำหนด", () => {
  assert.equal(truncate("abcdef", 4), "abcd…");
  assert.equal(truncate("abc", 5), "abc");
});
