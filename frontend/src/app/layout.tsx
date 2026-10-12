import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Superstore Executive Dashboard",
  description: "Bilingual executive dashboard backed by the local Superstore FastAPI API.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
