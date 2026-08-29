import { FiArrowUpRight, FiCheckCircle, FiClock, FiFileText } from "react-icons/fi";

const metrics = [
  { label: "คำขอทั้งหมด", value: "24", icon: FiFileText, tone: "text-blue-600 bg-blue-50" },
  { label: "รอตรวจสอบ", value: "08", icon: FiClock, tone: "text-amber-600 bg-amber-50" },
  { label: "อนุมัติแล้ว", value: "12", icon: FiCheckCircle, tone: "text-emerald-600 bg-emerald-50" },
];

export default function Home() {
  return (
    <main className="min-h-screen px-6 py-8 md:px-12 lg:px-20">
      <div className="mx-auto max-w-7xl">
        <header className="mb-12 flex items-start justify-between">
          <div><p className="mb-3 text-sm font-semibold tracking-widest text-blue-700">IS PROTRACK / KKU</p><h1 className="max-w-2xl text-3xl font-bold tracking-tight md:text-5xl">ระบบติดตามและบริหารการจัดซื้อจัดจ้างอัจฉริยะ</h1><p className="mt-4 text-slate-500">คณะสหวิทยาการ มหาวิทยาลัยขอนแก่น</p></div>
          <div className="hidden rounded-2xl bg-[#10213b] px-5 py-3 text-right text-white sm:block"><span className="block text-xs text-slate-300">วันนี้</span><span className="font-semibold">29 สิงหาคม 2569</span></div>
        </header>
        <section className="grid gap-4 md:grid-cols-3">{metrics.map(({ label, value, icon: Icon, tone }) => <article key={label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className={`mb-8 flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}><Icon size={21} /></div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-4xl font-bold tracking-tight">{value}</p></article>)}</section>
        <section className="mt-8 rounded-3xl bg-[#10213b] p-8 text-white shadow-xl md:p-10"><div className="flex flex-col justify-between gap-8 md:flex-row md:items-center"><div><p className="mb-3 text-sm font-semibold text-cyan-300">SMART PROCUREMENT WORKSPACE</p><h2 className="text-2xl font-bold md:text-3xl">เริ่มต้นคำขอจัดซื้อจัดจ้างใหม่</h2><p className="mt-3 max-w-xl text-slate-300">สร้าง TOR จากข้อมูลที่มี ตรวจสอบเอกสาร และติดตามสถานะการอนุมัติได้ในที่เดียว</p></div><button className="flex w-fit items-center gap-3 rounded-full bg-cyan-300 px-6 py-3 font-semibold text-[#10213b] transition hover:bg-cyan-200">สร้างคำขอใหม่ <FiArrowUpRight /></button></div></section>
      </div>
    </main>
  );
}
