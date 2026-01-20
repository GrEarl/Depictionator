import "./globals.css";
import "leaflet/dist/leaflet.css";
import { getLocaleFromCookies } from "@/lib/locale";

export const metadata = {
  title: "Depictionator",
  description: "Worldbuilding atlas for game development teams"
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1
};

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocaleFromCookies();
  return (
    <html lang={locale} data-locale={locale}>
      <body>
        {children}
      </body>
    </html>
  );
}
