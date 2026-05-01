import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

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

function PencilIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

// ─── Modal config coût indulgence (première utilisation) ─────────────────────

function ConfigCoutModal({ profil, onConfirm }) {
  const [cout, setCout]     = useState('')
  const [saving, setSaving] = useState(false)

  const handleConfirm = async () => {
    const c = Number(cout)
    if (!c || c <= 0) return
    setSaving(true)
    await onConfirm(c)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-6">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 w-full max-w-lg">
        <p className="text-white font-semibold mb-1">Définis le coût de ton indulgence</p>
        <p className="text-sm text-neutral-500 mb-5">🎯 {profil.quete_nom} — {profil.quete_unite}</p>
        <div className="flex flex-col gap-3">
          <div className="relative">
            <input
              type="number" min="1" step="1"
              value={cout}
              onChange={e => setCout(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
              placeholder={`Points par ${profil.quete_unite}…`}
              autoFocus
              className="w-full px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-600 focus:outline-none focus:border-violet-500 transition-colors pr-14"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 text-sm pointer-events-none">pts</span>
          </div>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!cout || Number(cout) <= 0 || saving}
            className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Sauvegarde…' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal ajout récompense ───────────────────────────────────────────────────

function RecompenseModal({ onClose, onAdd }) {
  const [nom, setNom]       = useState('')
  const [cout, setCout]     = useState('')
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
          <button onClick={onClose} className="text-neutral-500 hover:text-white text-xl leading-none transition-colors">✕</button>
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
              type="number" min="1" step="1"
              value={cout}
              onChange={e => setCout(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Coût en points…"
              className="w-full px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-600 focus:outline-none focus:border-violet-500 transition-colors pr-12"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 text-sm pointer-events-none">pts</span>
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

  const [loading,          setLoading]          = useState(true)
  const [profil,           setProfil]           = useState(null)
  const [journalPts,       setJournalPts]       = useState(0)
  const [catalogue,        setCatalogue]        = useState([])   // table recompenses
  const [achetes,          setAchetes]          = useState([])   // recompenses_achetees type='recompense'
  const [indulgences,      setIndulgences]      = useState([])   // recompenses_achetees type='indulgence'
  const [queteCochee,      setQueteCochee]      = useState(false)
  const [queteValeur,      setQueteValeur]      = useState(null) // total du jour dans journal
  // Catalogue
  const [showModal,        setShowModal]        = useState(false)
  const [using,            setUsing]            = useState(null)
  const [confirmed,        setConfirmed]        = useState(null)
  const [pendingDel,       setPendingDel]       = useState(null)
  // Indulgence
  const [showCoutModal,    setShowCoutModal]    = useState(false)
  const [editingCout,      setEditingCout]      = useState(false)
  const [coutInput,        setCoutInput]        = useState('')
  const [quantite,         setQuantite]         = useState('')
  const [savingIndulgence, setSavingIndulgence] = useState(false)
  const [indulgConfirmed,  setIndulgConfirmed]  = useState(false)

  const confirmTimer  = useRef(null)
  const deleteTimer   = useRef(null)
  const indulgTimer   = useRef(null)

  useEffect(() => {
    if (!session) return
    const uid   = session.user.id
    const today = todayISO()

    Promise.all([
      supabase.from('user_profile')
        .select('quete_active, quete_nom, quete_unite, quete_cout_unite')
        .eq('user_id', uid).maybeSingle(),
      supabase.from('journal').select('pts_gagnes_jour').eq('user_id', uid),
      supabase.from('recompenses').select('*').eq('user_id', uid).order('created_at'),
      supabase.from('recompenses_achetees').select('*').eq('user_id', uid),
      supabase.from('journal')
        .select('quete_cochee, quete_valeur')
        .eq('user_id', uid).eq('date', today).maybeSingle(),
    ]).then(([profRes, journalRes, recRes, achtRes, todayRes]) => {
      const p = profRes.data ?? null
      setProfil(p)
      setJournalPts((journalRes.data ?? []).reduce((s, r) => s + (r.pts_gagnes_jour ?? 0), 0))
      setCatalogue(recRes.error ? [] : (recRes.data ?? []))

      const allAchetes = achtRes.error ? [] : (achtRes.data ?? [])
      // Séparer les achats de récompenses et les indulgences
      setAchetes(allAchetes.filter(r => !r.type || r.type === 'recompense'))
      setIndulgences(allAchetes.filter(r => r.type === 'indulgence'))

      setQueteCochee(todayRes.data?.quete_cochee ?? false)
      setQueteValeur(todayRes.data?.quete_valeur ?? null)

      if (p?.quete_active && !(p?.quete_cout_unite > 0)) setShowCoutModal(true)
      setLoading(false)
    })
  }, [session])

  // ptsDisponible = gains totaux − achats de récompenses seulement
  // L'indulgence est déjà déduite dans pts_gagnes_jour par Aujourd'hui
  const ptsDisponible = Math.max(
    0,
    journalPts - achetes.reduce((s, r) => s + (r.cout_paye ?? 0), 0)
  )

  // ── Catalogue récompenses ────────────────────────────────────────────────────

  const handleUtiliser = useCallback(async (rec) => {
    if (!session || using) return
    setUsing(rec.id)
    const { data, error } = await supabase
      .from('recompenses_achetees')
      .insert({ user_id: session.user.id, nom: rec.nom, cout_paye: rec.cout_points, type: 'recompense' })
      .select()
      .single()
    setUsing(null)
    if (error) return
    setAchetes(prev => [...prev, data])
    setConfirmed(rec.id)
    clearTimeout(confirmTimer.current)
    confirmTimer.current = setTimeout(() => setConfirmed(null), 2200)
  }, [session, using])

  const handleSupprimer = useCallback(async (recId) => {
    if (pendingDel !== recId) {
      setPendingDel(recId)
      clearTimeout(deleteTimer.current)
      deleteTimer.current = setTimeout(() => setPendingDel(null), 3000)
      return
    }
    clearTimeout(deleteTimer.current)
    setPendingDel(null)
    const { error } = await supabase
      .from('recompenses').delete()
      .eq('id', recId).eq('user_id', session.user.id)
    if (!error) setCatalogue(prev => prev.filter(r => r.id !== recId))
  }, [session, pendingDel])

  const handleAjouter = useCallback(async ({ nom, cout_points }) => {
    if (!session) return
    const { data, error } = await supabase
      .from('recompenses')
      .insert({ user_id: session.user.id, nom, cout_points })
      .select().single()
    if (!error && data) setCatalogue(prev => [...prev, data])
  }, [session])

  // ── Indulgence ───────────────────────────────────────────────────────────────

  const handleConfigurerCout = useCallback(async (cout) => {
    if (!session) return
    const { error } = await supabase
      .from('user_profile').update({ quete_cout_unite: cout }).eq('user_id', session.user.id)
    if (!error) {
      setProfil(prev => ({ ...prev, quete_cout_unite: cout }))
      setShowCoutModal(false)
    }
  }, [session])

  const handleSauvegarderCout = useCallback(async () => {
    const c = Number(coutInput)
    if (!c || c <= 0 || !session) return
    const { error } = await supabase
      .from('user_profile').update({ quete_cout_unite: c }).eq('user_id', session.user.id)
    if (!error) {
      setProfil(prev => ({ ...prev, quete_cout_unite: c }))
      setEditingCout(false)
    }
  }, [session, coutInput])

  const handleUtiliserIndulgence = useCallback(async () => {
    if (!session || savingIndulgence) return
    const q         = Number(quantite)
    const coutUnite = profil?.quete_cout_unite ?? 0
    if (!q || q <= 0 || !coutUnite) return

    // Additivité : on s'ajoute à la valeur existante du jour
    const newTotal  = (queteValeur ?? 0) + q
    const cout_paye = coutUnite * q

    setSavingIndulgence(true)

    // 1. Historique dans recompenses_achetees (type='indulgence')
    const { data: achtData, error: achtErr } = await supabase
      .from('recompenses_achetees')
      .insert({
        user_id:   session.user.id,
        nom:       profil.quete_nom,
        cout_paye,
        type:      'indulgence',
        quantite:  q,
        unite:     profil.quete_unite,
      })
      .select()
      .single()

    // 2. Mise à jour additive de quete_valeur dans le journal
    await supabase.from('journal').upsert(
      { user_id: session.user.id, date: todayISO(), quete_valeur: newTotal },
      { onConflict: 'user_id,date' }
    )

    setSavingIndulgence(false)

    // 3. Mises à jour locales
    if (!achtErr && achtData) setIndulgences(prev => [...prev, achtData])
    // Mise à jour optimiste du solde (Aujourd'hui déduira officiellement au prochain save)
    setJournalPts(prev => Math.max(0, prev - cout_paye))
    setQueteValeur(newTotal)
    setQuantite('')
    setIndulgConfirmed(true)
    clearTimeout(indulgTimer.current)
    indulgTimer.current = setTimeout(() => setIndulgConfirmed(false), 2000)
  }, [session, savingIndulgence, quantite, profil, queteValeur])

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const coutUnite = profil?.quete_cout_unite ?? 0

  // Indulgence du jour (depuis le state local mis à jour)
  const todayStr          = todayISO()
  const todayIndulgences  = indulgences.filter(r => r.created_at?.startsWith(todayStr))
  const todayQuantiteUsed = todayIndulgences.reduce((s, r) => s + Number(r.quantite ?? 0), 0)

  return (
    <div className="flex flex-col gap-4 p-4 pb-6">

      {showModal && <RecompenseModal onClose={() => setShowModal(false)} onAdd={handleAjouter} />}
      {showCoutModal && profil?.quete_active && (
        <ConfigCoutModal profil={profil} onConfirm={handleConfigurerCout} />
      )}

      {/* ── Section 1 : Solde actuel ──────────────────────────────────── */}
      <Card className="text-center py-7">
        <p className="text-xs text-neutral-500 uppercase tracking-wider font-medium mb-3">Points disponibles</p>
        <p className="text-6xl font-bold text-violet-400 leading-none tabular-nums">{ptsDisponible}</p>
        <p className="text-sm text-neutral-500 mt-3">points à dépenser</p>
      </Card>

      {/* ── Section 2 : Mes récompenses ──────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-neutral-500 uppercase tracking-wider font-medium">Mes récompenses</p>
          {catalogue.length < 5 && (
            <button type="button" onClick={() => setShowModal(true)}
              className="text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors">
              + Ajouter
            </button>
          )}
        </div>

        {catalogue.length === 0 ? (
          <div className="flex flex-col items-center py-6 gap-4">
            <p className="text-sm text-neutral-500">Aucune récompense définie</p>
            <button type="button" onClick={() => setShowModal(true)}
              className="px-5 py-2.5 rounded-xl border border-dashed border-neutral-700 text-neutral-400 hover:border-violet-500 hover:text-violet-400 text-sm transition-colors">
              + Créer ma première récompense
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {catalogue.map(rec => {
              const peuUtiliser  = ptsDisponible >= rec.cout_points
              const isUsing      = using === rec.id
              const isConfirmed  = confirmed === rec.id
              const isPendingDel = pendingDel === rec.id
              return (
                <div key={rec.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    isConfirmed  ? 'border-green-600 bg-green-500/10' :
                    isPendingDel ? 'border-red-700 bg-red-500/10' :
                                   'border-neutral-700 bg-neutral-800/30'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${
                      isConfirmed ? 'text-green-400' : isPendingDel ? 'text-red-400' : 'text-white'
                    }`}>
                      {isConfirmed ? '✓ Utilisée !' : rec.nom}
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5">{rec.cout_points} pts</p>
                  </div>
                  {!isPendingDel && (
                    <button type="button" onClick={() => handleUtiliser(rec)}
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
                  <button type="button" onClick={() => handleSupprimer(rec.id)}
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
            {catalogue.length >= 5 && (
              <p className="text-xs text-neutral-600 text-center mt-1">Maximum 5 récompenses atteint</p>
            )}
          </div>
        )}
      </Card>

      {/* ── Section 3 : Indulgence ───────────────────────────────────── */}
      {profil?.quete_active && coutUnite > 0 && (
        <Card>
          <p className="text-xs text-neutral-500 uppercase tracking-wider font-medium mb-3">Indulgence</p>
          <p className="text-sm text-white font-medium mb-4">🎯 {profil.quete_nom}</p>

          {/* Coût par unité + crayon au survol */}
          {!editingCout ? (
            <div className="group flex items-center gap-2 mb-4">
              <p className="text-xs text-neutral-500">{coutUnite} pts / {profil.quete_unite}</p>
              <button type="button"
                onClick={() => { setEditingCout(true); setCoutInput(String(coutUnite)) }}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-600 hover:text-neutral-400 flex items-center"
                aria-label="Modifier le coût"
              >
                <PencilIcon />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <div className="relative">
                <input type="number" min="1" step="1"
                  value={coutInput}
                  onChange={e => setCoutInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSauvegarderCout(); if (e.key === 'Escape') setEditingCout(false) }}
                  autoFocus
                  className="w-24 px-3 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors pr-9"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 text-xs pointer-events-none">pts</span>
              </div>
              <span className="text-xs text-neutral-500">/ {profil.quete_unite}</span>
              <button type="button" onClick={handleSauvegarderCout}
                disabled={!coutInput || Number(coutInput) <= 0}
                className="text-xs text-violet-400 hover:text-violet-300 disabled:opacity-40 font-medium transition-colors">
                Sauvegarder
              </button>
              <button type="button" onClick={() => setEditingCout(false)}
                className="text-xs text-neutral-500 hover:text-neutral-400 transition-colors">
                Annuler
              </button>
            </div>
          )}

          {/* Zone saisie quantité (désactivée si résistance) */}
          <div className={queteCochee ? 'opacity-40 pointer-events-none select-none' : ''}>
            <div className="flex items-center gap-3">
              <input type="number" min="0" step="1"
                value={quantite}
                onChange={e => setQuantite(e.target.value)}
                placeholder={`Quantité (${profil.quete_unite})…`}
                disabled={queteCochee}
                className="flex-1 px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-40"
              />
              <button type="button" onClick={handleUtiliserIndulgence}
                disabled={
                  queteCochee ||
                  !quantite ||
                  Number(quantite) <= 0 ||
                  savingIndulgence ||
                  ptsDisponible < coutUnite * Number(quantite)
                }
                className="shrink-0 px-4 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold disabled:opacity-40 transition-colors"
              >
                {savingIndulgence ? '…' : 'Utiliser'}
              </button>
            </div>

            {/* Coût calculé en temps réel */}
            {Number(quantite) > 0 && (
              <p className="text-xs text-red-400 mt-2">−{coutUnite * Number(quantite)} pts</p>
            )}

            {/* Confirmation */}
            {indulgConfirmed && (
              <p className="text-xs text-green-400 mt-2">✓ Indulgence enregistrée</p>
            )}

            {/* Total déjà utilisé aujourd'hui (depuis recompenses_achetees chargées) */}
            {!indulgConfirmed && todayQuantiteUsed > 0 && (
              <p className="text-xs text-neutral-600 mt-2">
                Déjà utilisé aujourd'hui : {todayQuantiteUsed} {profil.quete_unite}
                {' '}(−{coutUnite * todayQuantiteUsed} pts)
              </p>
            )}
          </div>

          {/* Résistance active */}
          {queteCochee && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-base">🛡️</span>
              <p className="text-xs text-green-400/80">Résistance active — indulgence bloquée aujourd'hui</p>
            </div>
          )}
        </Card>
      )}

    </div>
  )
}
