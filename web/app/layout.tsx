import "./globals.css";
import "./sx.css";

export const metadata = {
  title: "SmartFactory XAI · Real-time Diagnosis",
  description: "사출성형 24센서 이상탐지 · 진단 · 처방 통합 플랫폼",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
