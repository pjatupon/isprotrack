import PizZip from "pizzip";

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function paragraph(text: string, options: { bold?: boolean; size?: string } = {}): string {
  const runs = text.split("\n").map(
    (line) =>
      `<w:r><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:eastAsia="TH Sarabun New" w:hAnsi="TH Sarabun New"/><w:b w:val="${options.bold ? "true" : "false"}"/><w:sz w:val="${options.size ?? "28"}"/><w:szCs w:val="${options.size ?? "28"}"/></w:rPr><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r>`,
  );
  return `<w:p><w:pPr><w:spacing w:before="80" w:after="80" w:line="360" w:lineRule="auto"/></w:pPr>${runs.join("")}</w:p>`;
}

function heading(text: string, level = 1): string {
  const size = level === 1 ? "36" : "32";
  return paragraph(text, { bold: true, size });
}

export interface DocxSection {
  heading?: string;
  body: string;
}

export function buildDocxFromSections(
  sections: DocxSection[],
  options: { title?: string } = {},
): Buffer {
  const bodyParts: string[] = [];

  if (options.title) {
    bodyParts.push(heading(options.title));
  }

  for (const section of sections) {
    if (section.heading) bodyParts.push(heading(section.heading));
    if (section.body) bodyParts.push(paragraph(section.body));
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyParts.join("")}
  </w:body>
</w:document>`;

  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.file(
    "word/document.xml",
    documentXml,
  );
  zip.file(
    "word/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:eastAsia="TH Sarabun New" w:hAnsi="TH Sarabun New"/><w:sz w:val="28"/></w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
</w:styles>`,
  );

  return Buffer.from(zip.generate({ type: "nodebuffer" }));
}

export function downloadDocxHeader(filename: string): Record<string, string> {
  return {
    "Content-Type":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Cache-Control": "no-store",
  };
}

export function buildSimpleTemplateDocx(lines: string[]): Buffer {
  const bodyParts = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => paragraph(line, { size: "28" }))
    .join("");

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyParts}
  </w:body>
</w:document>`;

  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.file("word/document.xml", documentXml);
  zip.file(
    "word/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:eastAsia="TH Sarabun New" w:hAnsi="TH Sarabun New"/><w:sz w:val="28"/></w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
</w:styles>`,
  );

  return Buffer.from(zip.generate({ type: "nodebuffer" }));
}
