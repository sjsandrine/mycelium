import { useAuth } from '../context/AuthContext'

export default function Header() {
  const { session, signOut } = useAuth()

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-neutral-900 border-b border-neutral-800 shrink-0">
      <span className="text-xs text-neutral-500 truncate max-w-[220px]">
        {session?.user?.email}
      </span>
      <button
        onClick={signOut}
        className="text-xs text-neutral-500 hover:text-red-400 transition-colors ml-4 shrink-0"
      >
        Déconnexion
      </button>
    </header>
  )
}
