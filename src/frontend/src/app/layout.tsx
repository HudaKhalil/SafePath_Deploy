import './globals.css'
import Navbar from '../components/Navbar'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import BottonNav from '../components/BottomNav'
import Footer from '../components/Footer'

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
  title: 'Safety Routing System',
  description: 'Find safer routes with intelligent routing, community insights, and real-time hazard awareness.',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'SafePath Safety Routing System',
    description: 'Find safer routes with intelligent routing, community insights, and real-time hazard awareness.',
    images: ['/logo.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
      <html lang="en">
        <body className="bg-primary-light text-text-primary min-h-screen flex flex-col" tabIndex={-1}>
          <Navbar />
          <main className="flex-1 flex flex-col items-center justify-center w-full px-2 sm:px-4 md:px-8" role="main" aria-label="Main content">
            {children}
          </main>
          <Footer />
          <BottomNav />
        </body>
      </html>
    )
}