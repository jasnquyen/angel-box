import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import RouteSearchControls from "./components/RouteSearchControls";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Angel Box Dashboard",
  description: "Safety-first camera coverage dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0f1724] text-[#0b1220]`}>
        {/* Top header */}
        <header className="bg-[#0f233a] text-white">
          <div className="max-w-full mx-auto flex items-center gap-6 px-6 py-4">
            <div className="flex items-center gap-4">
              <div className="bg-[#ffc94d] rounded-lg p-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L3 6v6c0 5 3.6 9.7 9 10 5.4-.3 9-5 9-10V6l-9-4z" fill="#0f233a"/></svg>
              </div>
              <div>
                <div className="font-bold text-lg">Angel Walk</div>
                <div className="text-xs text-slate-300">Atlanta Police Department</div>
              </div>
            </div>
            <RouteSearchControls />
            <div className="flex items-center gap-4 text-sm text-slate-300">
              <span className="flex items-center gap-2"><span className="h-2 w-2 bg-green-400 rounded-full"/> AI Monitoring Active</span>
              <span>1,247 Cameras Online</span>
              <span className="text-amber-400">2 Active Incidents Nearby</span>
            </div>
          </div>
        </header>

        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
