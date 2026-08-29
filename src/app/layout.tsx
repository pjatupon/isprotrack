import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const prompt = Prompt({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["thai", "latin"],
  variable: "--font-prompt",
  display: "swap",
});

export const metadata: Metadata = {
  title: "IS ProTrack | ระบบบริหารการจัดซื้อจัดจ้าง",
  description: "ระบบติดตามและบริหารการจัดซื้อจัดจ้างอัจฉริยะ คณะสหวิทยาการ มหาวิทยาลัยขอนแก่น",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={prompt.variable}>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
