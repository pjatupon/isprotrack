import { test } from "node:test";
import assert from "node:assert/strict";
import PizZip from "pizzip";
import { buildSimpleTemplateDocx } from "../src/lib/docx";
import {
  extractDocxText,
  applyPlaceholdersToDocx,
  validateFormPlaceholderFields,
  type FormPlaceholderField,
} from "../src/lib/ai/form-docx";
import { buildFilledDocx } from "../src/lib/ai/form-router";

function makeField(partial: Partial<FormPlaceholderField>): FormPlaceholderField {
  return {
    key: "field",
    label: "ช่อง",
    type: "text",
    required: false,
    matchText: "",
    anchor: "replace",
    ...partial,
  };
}

function readDocumentXml(buffer: Buffer): string {
  const zip = new PizZip(buffer);
  const document = zip.file("word/document.xml");
  assert.ok(document, "document.xml should exist");
  return document.asText();
}

test("extractDocxText reads paragraph text from a generated docx", () => {
  const buffer = buildSimpleTemplateDocx([
    "แบบฟอร์มขอเบิกพัสดุ",
    "ชื่อผู้ขอ: __________________",
    "หน่วยงาน: __________________",
  ]);
  const text = extractDocxText(buffer);
  assert.ok(text.includes("แบบฟอร์มขอเบิกพัสดุ"));
  assert.ok(text.includes("ชื่อผู้ขอ:"));
  assert.ok(text.includes("หน่วยงาน:"));
});

test("applyPlaceholdersToDocx replaces underscore blanks and appends after labels", () => {
  const buffer = buildSimpleTemplateDocx([
    "ชื่อผู้ขอ: __________________",
    "หน่วยงาน: ______________",
  ]);
  const fields = [
    makeField({ key: "requesterName", matchText: "__________________", anchor: "replace" }),
    makeField({ key: "department", matchText: "หน่วยงาน:", anchor: "after" }),
  ];
  const { buffer: result, applied } = applyPlaceholdersToDocx(buffer, fields);

  assert.equal(applied.requesterName, 1);
  assert.equal(applied.department, 1);

  const documentXml = readDocumentXml(result);
  assert.ok(documentXml.includes("{requesterName}"), "should embed {requesterName}");
  assert.ok(documentXml.includes("หน่วยงาน: {department}"), "should append after label");
});

test("applyPlaceholdersToDocx replaces all occurrences within separate paragraphs", () => {
  const buffer = buildSimpleTemplateDocx([
    "ผู้ขอ: ______________",
    "ผู้ตรวจ: ______________",
  ]);
  const fields = [makeField({ key: "name", matchText: "______________", anchor: "replace" })];
  const { applied } = applyPlaceholdersToDocx(buffer, fields);
  assert.equal(applied.name, 2);
});

test("applyPlaceholdersToDocx keeps the docx a valid zip after editing", () => {
  const buffer = buildSimpleTemplateDocx(["ชื่อผู้ขอ: ______________"]);
  const fields = [makeField({ key: "requesterName", matchText: "______________", anchor: "replace" })];
  const { buffer: result } = applyPlaceholdersToDocx(buffer, fields);
  const zip = new PizZip(result);
  assert.ok(zip.file("word/document.xml"), "docx should remain a valid package");
});

test("filled docx replaces placeholders with user values", () => {
  const buffer = buildSimpleTemplateDocx([
    "ชื่อผู้ขอ: {requesterName}",
    "หน่วยงาน: {department}",
  ]);
  const filled = buildFilledDocx(buffer, { requesterName: "นายสมชาย", department: "งานพัสดุ" });
  const text = extractDocxText(filled);
  assert.ok(text.includes("นายสมชาย"));
  assert.ok(text.includes("งานพัสดุ"));
});

test("validateFormPlaceholderFields validates keys and defaults", () => {
  const fields = validateFormPlaceholderFields([
    { key: "requesterName", label: "ชื่อผู้ขอ", type: "text", required: true, matchText: "___", anchor: "replace" },
    { key: "budget", label: "วงเงิน", type: "number", required: false, matchText: "___", anchor: "after" },
  ]);
  assert.equal(fields.length, 2);
  assert.equal(fields[0].type, "text");
  assert.equal(fields[1].type, "number");
  assert.equal(fields[1].anchor, "after");

  assert.throws(
    () => validateFormPlaceholderFields([{ key: "bad key!" }]),
    /ไม่ถูกต้อง/,
  );
  assert.throws(
    () => validateFormPlaceholderFields([{ key: "x" }, { key: "x" }]),
    /ซ้ำ/,
  );
});
