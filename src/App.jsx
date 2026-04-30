import { BrowserRouter, Routes, Route } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import Aujourdhui from './pages/Aujourdhui'
import Progression from './pages/Progression'
import Recompenses from './pages/Recompenses'
import Niveaux from './pages/Niveaux'
import Historique from './pages/Historique'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-dvh bg-neutral-950 text-white max-w-lg mx-auto relative">
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
