'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authService } from '../lib/services'


export default function Navbar() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      if (authService.isLoggedIn()) {
        const profileResponse = await authService.getProfile()
        if (profileResponse.success) {
          setIsLoggedIn(true)
          setUser(profileResponse.data.user)
        } else {
          // Token might be invalid
          authService.logout()
          setIsLoggedIn(false)
          setUser(null)
        }
      } else {
        setIsLoggedIn(false)
        setUser(null)
      }
    } catch (error) {
      // Only log unexpected errors, not normal auth-related errors
      const isExpectedAuthError = 
        error.message === 'Access token required' ||
        error.message === 'User not found' ||
        error.message?.includes('401') ||
        error.message?.includes('Invalid or expired token');
      
      if (!isExpectedAuthError) {
        console.error('Auth check failed:', error?.message ?? error, error?.data ?? error)
      }
      authService.logout()
      setIsLoggedIn(false)
      setUser(null)
    }
  }



  const handleLogout = () => {
    authService.logout()
    setIsLoggedIn(false)
    setUser(null)
    router.push('/')
  }


  return (
    <header className="bg-primary-dark/95 backdrop-blur-md text-white sticky top-0 shadow-lg z-1001 border-b border-white/10">
      <div className="container mx-auto px-6 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-4" aria-label="SafePath Home">
          <div className="w-14 h-14 flex items-center justify-center">
            <img 
              src="/logo.png" 
              alt="SafePath Logo" 
              className="w-14 h-14 object-contain"
            />
          </div>
          <div className="text-white font-bold text-3xl tracking-tight">SafePath</div>
        </Link>

        <nav className="hidden md:flex gap-10 items-center font-bold text-lg" aria-label="Main navigation">
          <Link href="/" className="nav-link">Home</Link>
          <Link href="/suggested-routes" className="nav-link">Suggested Routes</Link>
          <Link href="/report-hazards" className="nav-link">Report Hazards</Link>
          <Link href="/findBuddy" className="nav-link">Find Buddy</Link>
          {isLoggedIn ? (
            <div className="flex items-center gap-6">
              <span className="text-text-secondary text-base">Welcome, {user?.name || 'User'}</span>
              <Link href="/profile" className="nav-link">Profile</Link>
              <button 
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-base transition-colors min-w-11 min-h-11"
                aria-label="Logout"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <Link href="/auth/login" className="nav-link">Login</Link>
              <Link href="/auth/signup" className="bg-accent hover:bg-accent/90 text-black px-5 py-2 rounded font-semibold transition-colors min-w-11 min-h-11">Sign Up</Link>
            </div>
          )}
        </nav>

        <div className="md:hidden">
          <button 
            onClick={() => setOpen(!open)} 
            className="p-3 rounded-lg glass-effect text-accent hover:bg-white/20 transition-colors min-w-11 min-h-11"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden glass-effect mx-4 mb-4 rounded-lg">
          <nav className="flex flex-col gap-6 p-5 text-lg" aria-label="Mobile navigation">
            <Link href="/" onClick={() => setOpen(false)} className="nav-link">Home</Link>
            <Link href="/suggested-routes" onClick={() => setOpen(false)} className="nav-link">Suggested Routes</Link>
            <Link href="/report-hazards" onClick={() => setOpen(false)} className="nav-link">Report Hazards</Link>
            <Link href="/findBuddy" onClick={() => setOpen(false)} className="nav-link">Find Buddy</Link>
            {isLoggedIn ? (
              <div className="border-t border-white/20 pt-4 space-y-2">
                <div className="text-text-secondary">Welcome, {user?.name || 'User'}</div>
                <Link href="/profile" onClick={() => setOpen(false)} className="nav-link">Profile</Link>
                <button 
                  onClick={() => {
                    setOpen(false);
                    handleLogout();
                  }}
                  className="block w-full text-left bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-base transition-colors min-w-11 min-h-11"
                  aria-label="Logout"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="border-t border-white/20 pt-4 space-y-2">
                <Link href="/auth/login" onClick={() => setOpen(false)} className="nav-link">Login</Link>
                <Link href="/auth/signup" onClick={() => setOpen(false)} className="block bg-accent hover:bg-accent/90 text-black px-5 py-2 rounded font-semibold transition-colors text-center min-w-11 min-h-11">Sign Up</Link>
              </div>
            )}
          </nav>
        </div>
      )}

      <style jsx>{`
        .nav-link {
          font-size: 1.15rem;
          font-weight: 500;
          color: #e0e0e0;
          padding: 0.75rem 1.25rem;
          border-radius: 0.5rem;
          transition: color 0.2s, background 0.2s;
          min-width: 44px;
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .nav-link:hover, .nav-link:focus {
          color: #06d6a0;
          background: rgba(6,214,160,0.08);
          outline: none;
        }
      `}</style>
    </header>
  )
}