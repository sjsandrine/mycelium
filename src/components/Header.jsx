import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function Header() {
  const { session, signOut } = useAuth()

  const resetOnboarding = async () => {
    if (!session) return
    const uid = session.user.id
    await supabase.from('habitudes_cochees').delete().eq('user_id', uid)
    await supabase.from('habitudes').delete().eq('user_id', uid)
    await supabase.from('journal').delete().eq('user_id', uid)
    await supabase.from('user_profile').delete().eq('user_id', uid)
    window.location.reload()
  }

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-neutral-900 border-b border-neutral-800 shrink-0">
      <span className="text-xs text-neutral-500 truncate max-w-[160px]">
        {session?.user?.email}
      </span>
      <div className="flex items-center gap-3 ml-4 shrink-0">
        <button
          onClick={resetOnboarding}
          className="text-xs text-orange-500 hover:text-orange-400 transition-colors"
        >
          [reset]
        </button>
        <button
          onClick={signOut}
          className="text-xs text-neutral-500 hover:text-red-400 transition-colors"
        >
          Déconnexion
        </button>
      </div>
    </header>
  )
}
