import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { supabase } from './lib/supabase'
import BottomNav from './components/BottomNav'
import Header from './components/Header'
import Auth from './pages/Auth'
import Onboarding from './pages/Onboarding'
import Aujourdhui from './pages/Aujourdhui'
import Progression from './pages/Progression'
import Recompenses from './pages/Recompenses'
import Niveaux from './pages/Niveaux'
import Historique from './pages/Historique'

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-dvh bg-neutral-950">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function MainApp() {
  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-dvh bg-neutral-950 text-white max-w-lg mx-auto relative">
        <Header />
        <main className="flex-1 overflow-y-auto pb-20">
          <Routes>
            <Route path="/" element={<Aujourdhui />} />
            <Route path="/progression" element={<Progression />} />
            <Route path="/recompenses" element={<Recompenses />} />
            <Route path="/niveaux" element={<Niveaux />} />
            <Route path="/historique" element={<Historique />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}

function AppContent() {
  const { session, loading: authLoading } = useAuth()
  const [onboardingDone, setOnboardingDone] = useState(null)

  const checkProfile = useCallback(async () => {
    if (!session) { setOnboardingDone(null); return }
    const { data, error } = await supabase
      .from('user_profile')
      .select('onboarding_complete')
      .eq('user_id', session.user.id)
      .maybeSingle()
    if (error) console.error('[App] erreur lecture profil', error)
    setOnboardingDone(data?.onboarding_complete ?? false)
  }, [session])

  useEffect(() => {
    checkProfile()
  }, [checkProfile])

  if (authLoading || (session && onboardingDone === null)) return <Spinner />
  if (!session) return <Auth />
  if (!onboardingDone) return <Onboarding onComplete={checkProfile} />
  return <MainApp />
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
