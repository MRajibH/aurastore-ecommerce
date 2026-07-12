import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";
import Navbar from "@/components/Navbar";
import CartDrawer from "@/components/CartDrawer";
import Footer from "@/components/Footer";
import ConsentBanner from "@/components/ConsentBanner";
import FacebookPixel from "@/components/FacebookPixel";
import { validateSession } from "@/lib/auth/session";
import { getThemeSkin } from "@/lib/theme";
import { SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION, SITE_URL, SITE_TWITTER } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["electronics", "wireless earbuds", "smart home", "accessories", "online shopping", SITE_NAME],
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} | ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: SITE_TWITTER,
    title: `${SITE_NAME} | ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#7c5cf6",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Safely validate session on server-side for all routes
  const sessionResult = await validateSession();
  const user = sessionResult ? sessionResult.user : null;

  // Active storefront skin (global, admin-controlled). Applied to <html> so the
  // whole tree re-themes via CSS variables. Independent of light/dark mode.
  const skin = getThemeSkin();

  return (
    <html
      lang="en"
      data-skin={skin}
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Set the theme before paint to avoid a flash of the wrong theme. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('aura_theme');if(!t){t=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();`,
          }}
        />
        <FacebookPixel />
        <CartProvider>
          <Navbar user={user} />
          <main style={{ flex: 1 }}>
            {children}
          </main>
          <Footer />
          <CartDrawer />
        </CartProvider>
        <ConsentBanner />
      </body>
    </html>
  );
}
