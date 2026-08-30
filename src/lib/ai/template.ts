/** แทนที่ตัวแปร {{xxx}} ใน template ด้วยค่าที่ให้มา (pure function สำหรับทดสอบได้) */
export function renderPromptTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : value;
  });
}
