// PATH: app/page.jsx
import Image from "next/image";
import Link from "next/link";

function Section({ className = "", ...props }) {
  return <section className={`relative ${className}`} {...props} />;
}

export default function Home() {
  return (
    <main className="min-h-screen bg-primary-dark text-text-primary">
      {/* HERO */}
      <Section className="overflow-hidden">
        {/* decorative gradient blob */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-144 w-xl -translate-x-1/2 rounded-full blur-3xl opacity-30"
          style={{
            background:
              "radial-gradient(55% 55% at 50% 50%, rgba(6,214,160,0.6) 0%, rgba(6,214,160,0.0) 65%)",
          }}
        />

        <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-28 animate-fadeIn">
          <div className="grid items-center gap-8 sm:gap-10 lg:gap-14 lg:grid-cols-12">
            {/* Artwork card */}
            <div className="lg:col-span-7 order-1">
              <div className="rounded-2xl p-[6px] sm:p-2 bg-white/90 shadow-lg ring-1 ring-white/30">
                <div className="relative h-56 sm:h-72 md:h-96 lg:h-[30rem] rounded-xl overflow-hidden bg-transparent">
                  <Image
                    src="/app-hero.png"
                    alt="SafePath — your guide to a safer journey"
                    fill
                    priority
                    const { isLoggedIn } = useAuth();
                    const router = useRouter();

                    function handleGatedAction(href) {
                      if (isLoggedIn) {
                        router.push(href);
                      } else {
                        router.push('/auth/login');
                      }
                    }

                    return (
                      <main className="min-h-screen bg-linear-to-br from-primary-light to-primary-dark flex flex-col items-center justify-center">
                        <section className="w-full max-w-xl mx-auto px-4 py-10 text-center">
                          <img src="/logo.png" alt="SafePath Logo" className="mx-auto mb-6 w-20 h-20 md:w-24 md:h-24" />
                          <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4 drop-shadow-lg" tabIndex={0} aria-label="SafePath">SafePath</h1>
                          <p className="text-base md:text-xl text-white/80 mb-8 max-w-md mx-auto" tabIndex={0} aria-label="App description">Navigate your city safely with real-time crime and hazard data, route scoring, and community support.</p>
                          <div className="flex flex-col gap-4 md:flex-row md:gap-6 justify-center" role="group" aria-label="Homepage actions">
                            <button
                              className="bg-accent hover:bg-accent/90 text-black px-6 py-3 rounded-lg font-bold text-lg shadow-md transition-colors min-w-11 min-h-11 focus:outline-none focus:ring-2 focus:ring-accent"
                              onClick={() => handleGatedAction('/suggested-routes')}
                              aria-label={isLoggedIn ? "Find Safe Route" : "Login to Find Safe Route"}
                            >
                              Find Safe Route
                            </button>
                            <button
                              className="bg-primary-dark hover:bg-primary-light text-white px-6 py-3 rounded-lg font-bold text-lg shadow-md transition-colors min-w-11 min-h-11 focus:outline-none focus:ring-2 focus:ring-primary-light"
                              onClick={() => handleGatedAction('/report-hazards')}
                              aria-label={isLoggedIn ? "Report Hazard" : "Login to Report Hazard"}
                            >
                              Report Hazard
                            </button>
                            <button
                              className="bg-secondary hover:bg-secondary/90 text-white px-6 py-3 rounded-lg font-bold text-lg shadow-md transition-colors min-w-11 min-h-11 focus:outline-none focus:ring-2 focus:ring-secondary"
                              onClick={() => handleGatedAction('/findBuddy')}
                              aria-label={isLoggedIn ? "Find Buddy" : "Login to Find Buddy"}
                            >
                              Find Buddy
                            </button>
                          </div>
                          {!isLoggedIn && (
                            <div className="mt-8 text-white/80 text-sm" aria-live="polite">
                              <span>Login or sign up to access all features.</span>
                              <div className="flex gap-4 justify-center mt-2">
                                <Link href="/auth/login" className="underline hover:text-accent">Login</Link>
                                <Link href="/auth/signup" className="underline hover:text-accent">Sign Up</Link>
                              </div>
                            </div>
                          )}
                        </section>
                      </main>
                    );
