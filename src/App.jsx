import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import BottomNav from './components/BottomNav'
import Header from './components/Header'
import Auth from './pages/Auth'
import Aujourdhui from './pages/Aujourdhui'
import Progression from './pages/Progression'
import Recompenses from './pages/Recompenses'
import Niveaux from './pages/Niveaux'
import Historique from './pages/Historique'

function AppContent() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-neutral-950">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <Auth />

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

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
