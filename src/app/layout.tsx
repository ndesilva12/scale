import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Scale - Visual Group Ratings",
  description: "A visual tool for plotting and rating group items on customizable metrics",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/icons/favicon-32x32.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Scale",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "Scale - Visual Group Ratings",
    description: "A visual tool for plotting and rating group items on customizable metrics",
    type: "website",
    siteName: "Scale",
    images: [
      {
        url: "/scale1.png",
        width: 512,
        height: 512,
        alt: "Scale Logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Scale - Visual Group Ratings",
    description: "A visual tool for plotting and rating group items on customizable metrics",
    images: ["/scale1.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111827" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="mobile-web-app-capable" content="yes" />
        </head>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
        >
          <ServiceWorkerRegistration />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
