import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "IS ProTrack | ระบบบริหารการจัดซื้อจัดจ้าง",
  description: "ระบบติดตามและบริหารการจัดซื้อจัดจ้างอัจฉริยะ คณะสหวิทยาการ มหาวิทยาลัยขอนแก่น",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body><Providers>{children}</Providers></body></html>;
}
