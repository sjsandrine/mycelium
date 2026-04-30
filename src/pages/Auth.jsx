import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Auth() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await signIn(email)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh bg-neutral-950 px-6 text-center">
        <div className="text-5xl mb-6">✉️</div>
        <h2 className="text-xl font-bold text-white mb-2">Vérifie tes emails</h2>
        <p className="text-neutral-400 text-sm">
          Un lien de connexion a été envoyé à{' '}
          <span className="text-violet-400">{email}</span>
        </p>
        <button
          onClick={() => setSent(false)}
          className="mt-8 text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          Utiliser un autre email
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-neutral-950 px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">🍄</div>
          <h1 className="text-3xl font-bold text-white mb-2">Mycelium</h1>
          <p className="text-neutral-400 text-sm">Connexion sans mot de passe</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ton@email.com"
            required
            autoComplete="email"
            className="w-full px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500 transition-colors"
          />
          {error && (
            <p className="text-red-400 text-sm px-1">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Envoi en cours…' : 'Envoyer le lien magique'}
          </button>
        </form>
      </div>
    </div>
  )
}
