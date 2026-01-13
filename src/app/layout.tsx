import "./globals.css";

export const metadata = {
  title: "Depictionator",
  description: "Worldbuilding atlas for game development teams"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        {children}
      </body>
    </html>
  );
}

