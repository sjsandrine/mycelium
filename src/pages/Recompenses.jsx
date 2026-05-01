import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── Composants UI ────────────────────────────────────────────────────────────

function Card({ children, className = '' }) {
  return (
    <div className={`bg-neutral-900 border border-neutral-800 rounded-2xl p-4 ${className}`}>
      {children}
    </div>
  )
}

// ─── Modal ajout récompense ───────────────────────────────────────────────────

function RecompenseModal({ onClose, onAdd }) {
  const [nom, setNom]     = useState('')
  const [cout, setCout]   = useState('')
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    const c = Number(cout)
    if (!nom.trim() || !c || c <= 0) return
    setSaving(true)
    await onAdd({ nom: nom.trim(), cout_points: c })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-6">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <p className="text-white font-semibold">Nouvelle récompense</p>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white text-xl leading-none transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={nom}
            onChange={e => setNom(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Nom de la récompense…"
            autoFocus
            className="w-full px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-600 focus:outline-none focus:border-violet-500 transition-colors"
          />
          <div className="relative">
            <input
              type="number"
              min="1"
              step="1"
              value={cout}
              onChange={e => setCout(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Coût en points…"
              className="w-full px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-600 focus:outline-none focus:border-violet-500 transition-colors pr-12"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 text-sm pointer-events-none">
              pts
            </span>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!nom.trim() || !cout || Number(cout) <= 0 || saving}
            className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Ajout…' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page Récompenses ─────────────────────────────────────────────────────────

export default function Recompenses() {
  const { session } = useAuth()
  const navigate    = useNavigate()

  const [loading,      setLoading]      = useState(true)
  const [profil,       setProfil]       = useState(null)
  const [journalPts,   setJournalPts]   = useState(0)
  const [recompenses,  setRecompenses]  = useState([])
  const [achetes,      setAchetes]      = useState([])
  const [queteCochee,  setQueteCochee]  = useState(false)
  const [showModal,    setShowModal]    = useState(false)
  const [using,        setUsing]        = useState(null)
  const [confirmed,    setConfirmed]    = useState(null)
  const [pendingDel,   setPendingDel]   = useState(null)

  const confirmTimer = useRef(null)
  const deleteTimer  = useRef(null)

  useEffect(() => {
    if (!session) return
    const uid   = session.user.id
    const today = todayISO()

    Promise.all([
      supabase.from('user_profile').select('quete_active, quete_nom').eq('user_id', uid).maybeSingle(),
      supabase.from('journal').select('pts_gagnes_jour').eq('user_id', uid),
      supabase.from('recompenses').select('*').eq('user_id', uid).order('created_at'),
      supabase.from('recompenses_achetees').select('cout_paye').eq('user_id', uid),
      supabase.from('journal').select('quete_cochee').eq('user_id', uid).eq('date', today).maybeSingle(),
    ]).then(([profRes, journalRes, recRes, achtRes, todayRes]) => {
      setProfil(profRes.data ?? null)
      setJournalPts((journalRes.data ?? []).reduce((s, r) => s + (r.pts_gagnes_jour ?? 0), 0))
      setRecompenses(recRes.error ? [] : (recRes.data ?? []))
      setAchetes(achtRes.error ? [] : (achtRes.data ?? []))
      setQueteCochee(todayRes.data?.quete_cochee ?? false)
      setLoading(false)
    })
  }, [session])

  // Points disponibles recalculés en temps réel
  const ptsDisponible = Math.max(
    0,
    journalPts - achetes.reduce((s, r) => s + (r.cout_paye ?? 0), 0)
  )

  // ── Utiliser une récompense ──────────────────────────────────────────────────
  const handleUtiliser = useCallback(async (rec) => {
    if (!session || using) return
    setUsing(rec.id)
    const { data, error } = await supabase
      .from('recompenses_achetees')
      .insert({ user_id: session.user.id, nom: rec.nom, cout_paye: rec.cout_points })
      .select('cout_paye')
      .single()
    setUsing(null)
    if (error) return
    setAchetes(prev => [...prev, data])
    setConfirmed(rec.id)
    clearTimeout(confirmTimer.current)
    confirmTimer.current = setTimeout(() => setConfirmed(null), 2200)
  }, [session, using])

  // ── Supprimer du catalogue (avec confirmation 2 clics) ───────────────────────
  const handleSupprimer = useCallback(async (recId) => {
    if (pendingDel !== recId) {
      setPendingDel(recId)
      clearTimeout(deleteTimer.current)
      deleteTimer.current = setTimeout(() => setPendingDel(null), 3000)
      return
    }
    // Deuxième clic → suppression effective
    clearTimeout(deleteTimer.current)
    setPendingDel(null)
    const { error } = await supabase
      .from('recompenses')
      .delete()
      .eq('id', recId)
      .eq('user_id', session.user.id)
    if (!error) setRecompenses(prev => prev.filter(r => r.id !== recId))
  }, [session, pendingDel])

  // ── Ajouter au catalogue ─────────────────────────────────────────────────────
  const handleAjouter = useCallback(async ({ nom, cout_points }) => {
    if (!session) return
    const { data, error } = await supabase
      .from('recompenses')
      .insert({ user_id: session.user.id, nom, cout_points })
      .select()
      .single()
    if (!error && data) setRecompenses(prev => [...prev, data])
  }, [session])

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-6">
      {showModal && (
        <RecompenseModal
          onClose={() => setShowModal(false)}
          onAdd={handleAjouter}
        />
      )}

      {/* ── Section 1 : Solde actuel ──────────────────────────────────── */}
      <Card className="text-center py-7">
        <p className="text-xs text-neutral-500 uppercase tracking-wider font-medium mb-3">
          Points disponibles
        </p>
        <p className="text-6xl font-bold text-violet-400 leading-none tabular-nums">
          {ptsDisponible}
        </p>
        <p className="text-sm text-neutral-500 mt-3">points à dépenser</p>
      </Card>

      {/* ── Section 2 : Mes récompenses ──────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-neutral-500 uppercase tracking-wider font-medium">
            Mes récompenses
          </p>
          {recompenses.length < 5 && (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors"
            >
              + Ajouter
            </button>
          )}
        </div>

        {recompenses.length === 0 ? (
          <div className="flex flex-col items-center py-6 gap-4">
            <p className="text-sm text-neutral-500">Aucune récompense définie</p>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="px-5 py-2.5 rounded-xl border border-dashed border-neutral-700 text-neutral-400 hover:border-violet-500 hover:text-violet-400 text-sm transition-colors"
            >
              + Créer ma première récompense
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {recompenses.map(rec => {
              const peuUtiliser  = ptsDisponible >= rec.cout_points
              const isUsing      = using === rec.id
              const isConfirmed  = confirmed === rec.id
              const isPendingDel = pendingDel === rec.id

              return (
                <div
                  key={rec.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    isConfirmed
                      ? 'border-green-600 bg-green-500/10'
                      : isPendingDel
                        ? 'border-red-700 bg-red-500/10'
                        : 'border-neutral-700 bg-neutral-800/30'
                  }`}
                >
                  {/* Infos récompense */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${
                      isConfirmed ? 'text-green-400' : isPendingDel ? 'text-red-400' : 'text-white'
                    }`}>
                      {isConfirmed ? '✓ Utilisée !' : rec.nom}
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5">{rec.cout_points} pts</p>
                  </div>

                  {/* Bouton Utiliser */}
                  {!isPendingDel && (
                    <button
                      type="button"
                      onClick={() => handleUtiliser(rec)}
                      disabled={!peuUtiliser || !!using || isConfirmed}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isConfirmed
                          ? 'bg-green-500/20 text-green-400 cursor-default'
                          : peuUtiliser && !using
                            ? 'bg-violet-600 hover:bg-violet-500 text-white'
                            : 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
                      }`}
                    >
                      {isUsing ? '…' : isConfirmed ? '✓' : 'Utiliser'}
                    </button>
                  )}

                  {/* Bouton suppression (2 clics) */}
                  <button
                    type="button"
                    onClick={() => handleSupprimer(rec.id)}
                    className={`shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isPendingDel
                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                        : 'text-neutral-600 hover:text-red-400 hover:bg-red-400/10'
                    }`}
                  >
                    {isPendingDel ? 'Supprimer ?' : '✕'}
                  </button>
                </div>
              )
            })}

            {recompenses.length >= 5 && (
              <p className="text-xs text-neutral-600 text-center mt-1">
                Maximum 5 récompenses atteint
              </p>
            )}
          </div>
        )}
      </Card>

      {/* ── Section 3 : Rappel indulgence (quête active) ─────────────── */}
      {profil?.quete_active && (
        <button
          type="button"
          onClick={() => navigate('/')}
          className="w-full text-left focus:outline-none"
        >
          {queteCochee ? (
            <Card className="border-green-800/50 bg-green-950/30">
              <div className="flex items-center gap-3">
                <span className="text-2xl shrink-0">🛡️</span>
                <div className="flex-1">
                  <p className="text-green-400 font-semibold text-sm">Résistance active aujourd'hui</p>
                  <p className="text-green-400/60 text-xs mt-0.5">
                    Indulgence bloquée — tu as résisté, bien joué !
                  </p>
                </div>
                <span className="text-neutral-600 text-xs shrink-0">→</span>
              </div>
            </Card>
          ) : (
            <Card className="border-amber-800/50 bg-amber-950/30">
              <div className="flex items-center gap-3">
                <span className="text-2xl shrink-0">🎯</span>
                <div className="flex-1">
                  <p className="text-amber-400 font-semibold text-sm">Indulgence disponible</p>
                  <p className="text-amber-400/60 text-xs mt-0.5">
                    Utilise ton indulgence depuis l'onglet Aujourd'hui
                  </p>
                </div>
                <span className="text-neutral-600 text-xs shrink-0">Aujourd'hui →</span>
              </div>
            </Card>
          )}
        </button>
      )}
    </div>
  )
}
