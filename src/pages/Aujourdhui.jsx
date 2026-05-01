import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

// ─── Niveau ───────────────────────────────────────────────────────────────────

const XP_THRESHOLDS = [0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 5800]
const TITLES = {
  guerrier:   ['Recrue','Combattant','Soldat','Guerrier','Champion','Maître','Épique','Légendaire','Mythique','Immortel'],
  magicien:   ['Novice','Apprenti','Praticien','Érudit','Arcaniste','Archimage','Sage','Oracle','Transcendant','Omniscient'],
  commercant: ['Apprenti','Marchand','Négociant','Entrepreneur','Investisseur','Baron','Magnat','Tycoon','Oligarque','Légende'],
}
function getLevelInfo(totalXp) {
  const MAX = XP_THRESHOLDS.length
  let level = 1
  for (let i = 0; i < MAX; i++) {
    if (totalXp >= XP_THRESHOLDS[i]) level = i + 1
    else break
  }
  level = Math.min(level, MAX)
  const isMax = level >= MAX
  const cur = XP_THRESHOLDS[level - 1]
  const nxt = isMax ? cur + 1000 : XP_THRESHOLDS[level]
  return { level, progress: Math.min(((totalXp - cur) / (nxt - cur)) * 100, 100), xpToNext: isMax ? 0 : Math.max(nxt - totalXp, 0), isMax }
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const DIFF_PTS   = { facile: 5, moyen: 10, difficile: 20 }
const DIFF_COLOR = { facile: 'text-green-400', moyen: 'text-yellow-400', difficile: 'text-red-400' }

const MIN_SECTION = {
  guerrier:   'Le minimum du guerrier',
  magicien:   'Rituels essentiels',
  commercant: "L'accord minimum",
}
const MIN_TASKS = [
  { id: 'eau',     label: "Boire de l'eau" },
  { id: 'manger',  label: 'Manger quelque chose' },
  { id: 'quitter', label: 'Quitter la pièce' },
]

// Styles complets pour Tailwind JIT (pas de template literals dynamiques)
const HABIT_STYLES = {
  selfcare: {
    title: 'Selfcare', titleColor: 'text-violet-400',
    cardChecked: 'border-violet-500 bg-violet-500/10',
    dot: 'border-violet-500 bg-violet-500',
  },
  responsabilite: {
    title: 'Responsabilités', titleColor: 'text-amber-400',
    cardChecked: 'border-amber-500 bg-amber-500/10',
    dot: 'border-amber-500 bg-amber-500',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateLong(d) {
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function cycleDay(debut) {
  return (Math.floor((Date.now() - new Date(debut).getTime()) / 86400000) % 28) + 1
}

// Définie hors composant : pas de stale closure dans le timeout de doSave
function computeTotals({ entry, habitsCochees, habitudes, profil }) {
  const mult = entry.journee_difficile ? 2 : 1
  const jminPts = entry.journee_minimum.length * 5 * mult
  let habPts = 0, habXp = 0
  for (const id of habitsCochees) {
    const h = habitudes.find(h => h.id === id)
    if (!h) continue
    const base = DIFF_PTS[h.difficulte] ?? 0
    habPts += base * mult
    if (h.type === 'responsabilite') habXp += base * mult
  }
  const quetePts = entry.quete_cochee ? 20 * mult : 0
  const queteXp  = entry.quete_cochee ? 20 * mult : 0
  const indulgenceCost = (profil?.quete_cout_unite ?? 0) * (Number(entry.quete_valeur) || 0)
  return {
    pts: Math.max(0, jminPts + habPts + quetePts - indulgenceCost),
    xp:  habXp + queteXp,
  }
}

// ─── Composants UI ────────────────────────────────────────────────────────────

function Card({ children, className = '' }) {
  return <div className={`bg-neutral-900 border border-neutral-800 rounded-2xl p-4 ${className}`}>{children}</div>
}
function FieldLabel({ children }) {
  return <p className="text-xs text-neutral-500 uppercase tracking-wider font-medium">{children}</p>
}
function Check({ size = 'md' }) {
  const cls = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'
  return (
    <svg className={`${cls} text-white`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

// ─── Modal ajout habitude ─────────────────────────────────────────────────────

function HabitModal({ type, onClose, onAdd }) {
  const [nom, setNom] = useState('')
  const [diff, setDiff] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    if (!nom.trim() || !diff) return
    setSaving(true)
    await onAdd({ nom: nom.trim(), difficulte: diff, type })
    setSaving(false)
    onClose()
  }

  const DIFF_BTN = {
    facile:    'border-green-400 text-green-400 bg-green-400/10',
    moyen:     'border-yellow-400 text-yellow-400 bg-yellow-400/10',
    difficile: 'border-red-400 text-red-400 bg-red-400/10',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-6">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <p className="text-white font-semibold">
            Nouvelle habitude · {type === 'selfcare' ? 'Selfcare' : 'Responsabilité'}
          </p>
          <button onClick={onClose} className="text-neutral-500 hover:text-white text-xl leading-none transition-colors">✕</button>
        </div>
        <div className="flex flex-col gap-4">
          <input
            type="text"
            value={nom}
            onChange={e => setNom(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Nom de l'habitude…"
            autoFocus
            className="w-full px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-600 focus:outline-none focus:border-violet-500 transition-colors"
          />
          <div className="flex gap-2">
            {['facile', 'moyen', 'difficile'].map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setDiff(d)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-medium capitalize transition-all ${
                  diff === d ? DIFF_BTN[d] : 'border-neutral-700 text-neutral-500 hover:border-neutral-500'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!nom.trim() || !diff || saving}
            className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Ajout…' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Colonne d'habitudes ──────────────────────────────────────────────────────

function HabitColumn({ type, habitudes, habitsCochees, mult, onToggle, onAdd }) {
  const s = HABIT_STYLES[type]
  return (
    <div className="flex flex-col gap-2">
      <p className={`text-xs font-medium uppercase tracking-wider ${s.titleColor}`}>{s.title}</p>
      {habitudes.map(h => {
        const checked = habitsCochees.has(h.id)
        const pts = (DIFF_PTS[h.difficulte] ?? 0) * mult
        const xp  = h.type === 'responsabilite' ? pts : 0
        return (
          <button
            key={h.id}
            type="button"
            onClick={() => onToggle(h)}
            className={`flex flex-col gap-1 p-3 rounded-xl border text-left transition-all ${
              checked ? s.cardChecked : 'border-neutral-700 hover:border-neutral-600 bg-neutral-800/30'
            }`}
          >
            <div className="flex items-start gap-2">
              <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                checked ? s.dot : 'border-neutral-600'
              }`}>
                {checked && <Check size="sm" />}
              </div>
              <span className={`text-xs font-medium leading-tight ${checked ? 'text-white' : 'text-neutral-300'}`}>
                {h.nom}
              </span>
            </div>
            <div className="flex items-center gap-1 pl-6 flex-wrap">
              <span className={`text-xs ${DIFF_COLOR[h.difficulte]}`}>{h.difficulte}</span>
              <span className="text-xs text-neutral-600">·</span>
              <span className="text-xs text-neutral-500">+{pts} pts</span>
              {xp > 0 && (
                <>
                  <span className="text-xs text-neutral-600">·</span>
                  <span className="text-xs text-neutral-500">+{xp} XP</span>
                </>
              )}
            </div>
          </button>
        )
      })}
      {habitudes.length < 10 && (
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center justify-center gap-1 py-2.5 rounded-xl border border-dashed border-neutral-700 text-neutral-500 hover:border-neutral-500 hover:text-neutral-400 transition-colors text-xs"
        >
          <span className="text-sm leading-none">+</span> Ajouter
        </button>
      )}
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

const ENTRY_DEFAULT = {
  sommeil: '', humeur: 5, journee_difficile: false,
  quete_cochee: false, quete_valeur: '',
  tracker4_nom: '', tracker4_valeur: '',
  notes: '', journee_minimum: [],
}

export default function Aujourdhui() {
  const { session } = useAuth()
  const [profil,          setProfil]          = useState(null)
  const [totalXpLifetime, setTotalXpLifetime] = useState(0)
  const [habitudes,       setHabitudes]       = useState([])
  const [habitsCochees,   setHabitsCochees]   = useState(new Set())
  const [entry,           setEntry]           = useState(ENTRY_DEFAULT)
  const [indulgenceInput, setIndulgenceInput] = useState('')
  const [loading,         setLoading]         = useState(true)
  const [showModal,       setShowModal]       = useState(null)

  const saveTimer = useRef(null)
  const stateRef  = useRef({ entry: ENTRY_DEFAULT, habitsCochees: new Set(), habitudes: [], profil: null })

  // Sync stateRef après chaque render (fallback si une mise à jour a été manquée)
  useEffect(() => {
    stateRef.current = { entry, habitsCochees, habitudes, profil }
  }, [entry, habitsCochees, habitudes, profil])

  // ── Chargement initial ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return
    const uid   = session.user.id
    const today = todayISO()
    console.log('[Aujourdhui] chargement uid=', uid, 'date=', today)

    Promise.all([
      supabase.from('user_profile').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('journal').select('*').eq('user_id', uid).eq('date', today).maybeSingle(),
      supabase.from('journal').select('xp_gagnes_jour').eq('user_id', uid),
      supabase.from('habitudes').select('*').eq('user_id', uid).eq('actif', true).order('created_at'),
      supabase.from('habitudes_cochees').select('habitude_id').eq('user_id', uid).eq('date', today),
    ]).then(([profRes, journalRes, xpRes, habRes, cochRes]) => {
      console.log('[Aujourdhui] user_profile     ->', profRes)
      console.log('[Aujourdhui] journal           ->', journalRes)
      console.log('[Aujourdhui] habitudes         ->', habRes)
      console.log('[Aujourdhui] habitudes_cochees ->', cochRes)

      if (profRes.error)    console.error('[Aujourdhui] erreur user_profile',     profRes.error)
      if (journalRes.error) console.error('[Aujourdhui] erreur journal',           journalRes.error)
      if (xpRes.error)      console.error('[Aujourdhui] erreur xp',               xpRes.error)
      if (habRes.error)     console.error('[Aujourdhui] erreur habitudes',         habRes.error)
      if (cochRes.error)    console.error('[Aujourdhui] erreur habitudes_cochees', cochRes.error)

      const p      = profRes.data
      const j      = journalRes.data
      const xpRows = xpRes.data  ?? []
      const habs   = habRes.data ?? []
      const coch   = new Set((cochRes.data ?? []).map(r => r.habitude_id))

      const loadedEntry = j ? {
        sommeil:           j.sommeil           ?? '',
        humeur:            j.humeur            ?? 5,
        journee_difficile: j.journee_difficile ?? false,
        quete_cochee:      j.quete_cochee      ?? false,
        quete_valeur:      j.quete_valeur      ?? '',
        tracker4_nom:      j.tracker4_nom      ?? '',
        tracker4_valeur:   j.tracker4_valeur   ?? '',
        notes:             j.notes             ?? '',
        journee_minimum:   j.journee_minimum   ?? [],
      } : ENTRY_DEFAULT

      if (j) {
        console.log('[Aujourdhui] entrée du jour restaurée')
        if (j.quete_valeur) setIndulgenceInput(String(j.quete_valeur))
      } else {
        console.log('[Aujourdhui] aucune entrée du jour en base')
      }

      setProfil(p)
      setHabitudes(habs)
      setHabitsCochees(coch)
      setEntry(loadedEntry)
      setTotalXpLifetime(xpRows.reduce((s, r) => s + (r.xp_gagnes_jour ?? 0), 0))
      stateRef.current = { entry: loadedEntry, habitsCochees: coch, habitudes: habs, profil: p }
      setLoading(false)
    })
  }, [session])

  // ── Auto-save journal ────────────────────────────────────────────────────────
  const doSave = useCallback(() => {
    if (!session) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const st = stateRef.current
      if (!st.profil) { console.warn('[Aujourdhui] doSave: profil null'); return }
      const { pts, xp } = computeTotals(st)
      const { entry } = st
      const payload = {
        user_id:           session.user.id,
        date:              todayISO(),
        sommeil:           entry.sommeil         !== '' ? Number(entry.sommeil)         : null,
        humeur:            Number(entry.humeur),
        journee_difficile: entry.journee_difficile,
        quete_cochee:      entry.quete_cochee,
        quete_valeur:      entry.quete_valeur    !== '' ? Number(entry.quete_valeur)    : null,
        tracker4_nom:      entry.tracker4_nom    || null,
        tracker4_valeur:   entry.tracker4_valeur !== '' ? Number(entry.tracker4_valeur) : null,
        notes:             entry.notes           || null,
        journee_minimum:   entry.journee_minimum,
        pts_gagnes_jour:   pts,
        xp_gagnes_jour:    xp,
      }
      console.log('[Aujourdhui] upsert journal ->', payload)
      const { data, error } = await supabase
        .from('journal')
        .upsert(payload, { onConflict: 'user_id,date' })
        .select()
      if (error) console.error('[Aujourdhui] erreur upsert journal', error)
      else       console.log('[Aujourdhui] upsert OK ->', data)
    }, 600)
  }, [session])

  // ── Mise à jour champ de l'entrée ────────────────────────────────────────────
  const update = useCallback((key, val) => {
    setEntry(prev => {
      const next = { ...prev, [key]: val }
      if (key === 'humeur') next.journee_difficile = Number(val) <= 2
      stateRef.current = { ...stateRef.current, entry: next }
      doSave()
      return next
    })
  }, [doSave])

  // ── Journée minimum ──────────────────────────────────────────────────────────
  const toggleMin = useCallback((id) => {
    setEntry(prev => {
      const has  = prev.journee_minimum.includes(id)
      const next = {
        ...prev,
        journee_minimum: has
          ? prev.journee_minimum.filter(t => t !== id)
          : [...prev.journee_minimum, id],
      }
      stateRef.current = { ...stateRef.current, entry: next }
      doSave()
      return next
    })
  }, [doSave])

  // ── Toggle habitude (DB immédiat + total journal debounced) ──────────────────
  const toggleHabit = useCallback(async (habit) => {
    if (!session) return
    const isChecked = stateRef.current.habitsCochees.has(habit.id)
    const newSet = new Set(stateRef.current.habitsCochees)

    if (isChecked) {
      newSet.delete(habit.id)
      const { error } = await supabase
        .from('habitudes_cochees')
        .delete()
        .eq('user_id',     session.user.id)
        .eq('date',        todayISO())
        .eq('habitude_id', habit.id)
      if (error) { console.error('[Aujourdhui] erreur delete habitude_cochee', error); return }
    } else {
      const base = DIFF_PTS[habit.difficulte] ?? 0
      newSet.add(habit.id)
      const { error } = await supabase
        .from('habitudes_cochees')
        .upsert({
          user_id:     session.user.id,
          date:        todayISO(),
          habitude_id: habit.id,
          pts:         base,
          xp:          habit.type === 'responsabilite' ? base : 0,
        }, { onConflict: 'user_id,date,habitude_id' })
      if (error) { console.error('[Aujourdhui] erreur insert habitude_cochee', error); return }
    }

    setHabitsCochees(newSet)
    stateRef.current = { ...stateRef.current, habitsCochees: newSet }
    doSave()
  }, [session, doSave])

  // ── Ajout d'habitude via modal ────────────────────────────────────────────────
  const handleAddHabit = useCallback(async ({ nom, difficulte, type }) => {
    if (!session) return
    const { data, error } = await supabase
      .from('habitudes')
      .insert({ user_id: session.user.id, nom, type, difficulte, actif: true })
      .select()
      .single()
    if (error) { console.error('[Aujourdhui] erreur ajout habitude', error); return }
    setHabitudes(prev => {
      const next = [...prev, data]
      stateRef.current = { ...stateRef.current, habitudes: next }
      return next
    })
  }, [session])

  // ── Utiliser indulgence ───────────────────────────────────────────────────────
  const handleUtiliserIndulgence = useCallback(() => {
    setEntry(prev => {
      const next = { ...prev, quete_valeur: indulgenceInput }
      stateRef.current = { ...stateRef.current, entry: next }
      doSave()
      return next
    })
  }, [indulgenceInput, doSave])

  // ── Toggle quête cochée ───────────────────────────────────────────────────────
  const toggleQueteCochee = useCallback(() => {
    setEntry(prev => {
      const next = { ...prev, quete_cochee: !prev.quete_cochee }
      stateRef.current = { ...stateRef.current, entry: next }
      doSave()
      return next
    })
  }, [doSave])

  // ── Render ────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const classe = profil?.classe ?? 'guerrier'
  const { level, progress, xpToNext, isMax } = getLevelInfo(totalXpLifetime)
  const classeTitle = TITLES[classe]?.[level - 1] ?? ''
  const totals   = computeTotals({ entry, habitsCochees, habitudes, profil })
  const mult     = entry.journee_difficile ? 2 : 1

  const humeurColor = entry.humeur <= 2 ? 'text-red-400' : entry.humeur <= 5 ? 'text-yellow-400' : 'text-green-400'
  const dayNum = profil?.cycle_actif && profil?.cycle_debut ? cycleDay(profil.cycle_debut) : null

  const selfcare = habitudes.filter(h => h.type === 'selfcare')
  const respos   = habitudes.filter(h => h.type === 'responsabilite')

  const indulgenceCostPreview = (profil?.quete_cout_unite ?? 0) * (Number(indulgenceInput) || 0)
  const indulgenceUsedCost    = (profil?.quete_cout_unite ?? 0) * (Number(entry.quete_valeur) || 0)

  return (
    <div className="flex flex-col gap-4 p-4">
      {showModal && (
        <HabitModal type={showModal} onClose={() => setShowModal(null)} onAdd={handleAddHabit} />
      )}

      {/* ── Date & cycle ─────────────────────────────────────────────── */}
      <div>
        <p className="text-lg font-semibold text-white capitalize">{formatDateLong(new Date())}</p>
        {dayNum && <p className="text-sm text-violet-400 mt-0.5">🌙 Jour {dayNum} du cycle</p>}
      </div>

      {/* ── Carte de niveau ──────────────────────────────────────────── */}
      <Card>
        <div className="flex items-start justify-between mb-3">
          <div>
            <FieldLabel>Niveau {level}</FieldLabel>
            <p className="text-white font-bold text-xl mt-0.5">{classeTitle}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-neutral-500">Aujourd'hui</p>
            <p className="text-white font-semibold text-sm">{totals.pts} pts · {totals.xp} XP</p>
          </div>
        </div>
        <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
          <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-neutral-500 mt-1.5">
          {isMax ? 'Niveau maximum atteint' : `${xpToNext} XP pour le niveau ${level + 1}`}
        </p>
      </Card>

      {/* ── Bandeau journée difficile ─────────────────────────────────── */}
      {entry.journee_difficile && (
        <div className="flex items-center gap-3 bg-red-950/50 border border-red-800/60 rounded-2xl px-4 py-3">
          <span className="text-xl shrink-0">🔥</span>
          <div>
            <p className="text-red-400 font-semibold text-sm">Journée difficile</p>
            <p className="text-red-400/70 text-xs">Tous tes gains sont doublés aujourd'hui</p>
          </div>
        </div>
      )}

      {/* ── Trackers ─────────────────────────────────────────────────── */}
      <Card>
        <p className="text-sm font-semibold text-neutral-200 mb-4">Trackers</p>
        <div className="flex flex-col gap-5">
          <div>
            <FieldLabel>Sommeil (heures)</FieldLabel>
            <input
              type="number" min="0" max="24" step="0.5"
              value={entry.sommeil}
              onChange={e => update('sommeil', e.target.value)}
              placeholder="ex. 7.5"
              className="mt-2 w-full px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-600 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <FieldLabel>Humeur</FieldLabel>
              <span className={`text-base font-bold ${humeurColor}`}>{entry.humeur} / 10</span>
            </div>
            <input
              type="range" min="1" max="10" step="1"
              value={entry.humeur}
              onChange={e => update('humeur', e.target.value)}
              className="w-full h-2 rounded-full appearance-none cursor-pointer accent-violet-500 bg-neutral-800"
            />
            <div className="flex justify-between text-xs text-neutral-600 mt-1">
              <span>1</span><span>5</span><span>10</span>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Tracker libre ─────────────────────────────────────────────── */}
      <Card>
        <FieldLabel>Tracker libre</FieldLabel>
        <div className="flex gap-3 mt-2">
          <input
            type="text"
            value={entry.tracker4_nom}
            onChange={e => update('tracker4_nom', e.target.value)}
            placeholder="Nom…"
            className="flex-1 px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-600 focus:outline-none focus:border-violet-500 transition-colors text-sm"
          />
          <input
            type="number" min="0" step="1"
            value={entry.tracker4_valeur}
            onChange={e => update('tracker4_valeur', e.target.value)}
            placeholder="0"
            className="w-20 px-3 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-600 focus:outline-none focus:border-violet-500 transition-colors text-center"
          />
        </div>
      </Card>

      {/* ── Habitudes ─────────────────────────────────────────────────── */}
      <Card>
        <p className="text-sm font-semibold text-neutral-200 mb-4">Habitudes</p>
        <div className="grid grid-cols-2 gap-3">
          <HabitColumn
            type="selfcare"
            habitudes={selfcare}
            habitsCochees={habitsCochees}
            mult={mult}
            onToggle={toggleHabit}
            onAdd={() => setShowModal('selfcare')}
          />
          <HabitColumn
            type="responsabilite"
            habitudes={respos}
            habitsCochees={habitsCochees}
            mult={mult}
            onToggle={toggleHabit}
            onAdd={() => setShowModal('responsabilite')}
          />
        </div>
      </Card>

      {/* ── Quête centrale ───────────────────────────────────────────── */}
      {profil?.quete_active && (
        <Card>
          <FieldLabel>Quête centrale</FieldLabel>
          <p className="text-white font-semibold text-sm mt-0.5 mb-4">🎯 {profil.quete_nom}</p>

          {/* Résistance */}
          <button
            type="button"
            onClick={toggleQueteCochee}
            className={`flex items-center gap-3 w-full text-left p-3 rounded-xl border mb-4 transition-all ${
              entry.quete_cochee
                ? 'border-green-500 bg-green-500/10'
                : 'border-neutral-700 hover:border-neutral-600 bg-neutral-800/30'
            }`}
          >
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
              entry.quete_cochee ? 'border-green-500 bg-green-500' : 'border-neutral-600'
            }`}>
              {entry.quete_cochee && <Check />}
            </div>
            <span className={`text-sm flex-1 ${entry.quete_cochee ? 'text-white' : 'text-neutral-400'}`}>
              J'ai résisté aujourd'hui
            </span>
            <span className="text-xs text-neutral-600 shrink-0">+{20 * mult} pts · +{20 * mult} XP</span>
          </button>

          {/* Indulgence */}
          <div className={entry.quete_cochee ? 'opacity-40 pointer-events-none select-none' : ''}>
            <FieldLabel>Indulgence — {profil.quete_unite}</FieldLabel>
            <div className="flex items-center gap-3 mt-2">
              <input
                type="number" min="0" step="1"
                value={indulgenceInput}
                onChange={e => setIndulgenceInput(e.target.value)}
                placeholder="0"
                disabled={entry.quete_cochee}
                className="w-24 px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-600 focus:outline-none focus:border-violet-500 transition-colors text-center disabled:opacity-40"
              />
              <span className="flex-1 text-sm text-red-400">
                {indulgenceCostPreview > 0 ? `−${indulgenceCostPreview} pts` : ''}
              </span>
              <button
                type="button"
                onClick={handleUtiliserIndulgence}
                disabled={entry.quete_cochee || !indulgenceInput || Number(indulgenceInput) <= 0}
                className="px-4 py-2.5 rounded-xl bg-red-900/50 border border-red-800/60 text-red-400 text-sm font-medium hover:bg-red-900/80 disabled:opacity-40 transition-colors"
              >
                Utiliser
              </button>
            </div>
            {Number(entry.quete_valeur) > 0 && (
              <p className="text-xs text-neutral-500 mt-2">
                Utilisé aujourd'hui : {entry.quete_valeur} {profil.quete_unite}
                {indulgenceUsedCost > 0 ? ` (−${indulgenceUsedCost} pts)` : ''}
              </p>
            )}
          </div>
        </Card>
      )}

      {/* ── Notes ─────────────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <FieldLabel>Notes</FieldLabel>
          <span className="text-xs text-neutral-600">{(entry.notes ?? '').length}/500</span>
        </div>
        <textarea
          value={entry.notes ?? ''}
          onChange={e => { if (e.target.value.length <= 500) update('notes', e.target.value) }}
          placeholder="Comment tu te sens aujourd'hui…"
          rows={3}
          className="w-full px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-600 focus:outline-none focus:border-violet-500 transition-colors resize-none text-sm"
        />
      </Card>

      {/* ── Journée minimum ───────────────────────────────────────────── */}
      <Card className="mb-2">
        <p className="text-sm font-semibold text-neutral-200 mb-3">
          {MIN_SECTION[classe] ?? 'Journée minimum'}
        </p>
        <div className="flex flex-col gap-2.5">
          {MIN_TASKS.map(task => {
            const checked = entry.journee_minimum.includes(task.id)
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => toggleMin(task.id)}
                className={`flex items-center gap-3 w-full text-left p-3 rounded-xl border transition-all ${
                  checked
                    ? 'border-violet-500 bg-violet-500/10'
                    : 'border-neutral-700 hover:border-neutral-600 bg-neutral-800/30'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                  checked ? 'border-violet-500 bg-violet-500' : 'border-neutral-600'
                }`}>
                  {checked && <Check />}
                </div>
                <span className={`text-sm flex-1 ${checked ? 'text-white' : 'text-neutral-400'}`}>{task.label}</span>
                <span className="text-xs text-neutral-600">+{5 * mult} pts</span>
              </button>
            )
          })}
        </div>
        {entry.journee_minimum.length > 0 && (
          <p className="text-xs text-neutral-500 mt-3 text-right">
            {entry.journee_minimum.length}/3 · {entry.journee_minimum.length * 5 * mult} pts gagnés
          </p>
        )}
      </Card>
    </div>
  )
}
