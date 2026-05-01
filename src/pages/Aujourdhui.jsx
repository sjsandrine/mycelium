import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

// ─── Système de niveaux ───────────────────────────────────────────────────────

const XP_THRESHOLDS = [0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 5800]

const TITLES = {
  guerrier:   ['Recrue', 'Combattant', 'Soldat', 'Guerrier', 'Champion', 'Maître', 'Épique', 'Légendaire', 'Mythique', 'Immortel'],
  magicien:   ['Novice', 'Apprenti', 'Praticien', 'Érudit', 'Arcaniste', 'Archimage', 'Sage', 'Oracle', 'Transcendant', 'Omniscient'],
  commercant: ['Apprenti', 'Marchand', 'Négociant', 'Entrepreneur', 'Investisseur', 'Baron', 'Magnat', 'Tycoon', 'Oligarque', 'Légende'],
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
  return {
    level,
    progress: Math.min(((totalXp - cur) / (nxt - cur)) * 100, 100),
    xpToNext: isMax ? 0 : Math.max(nxt - totalXp, 0),
    isMax,
  }
}

// ─── Constantes ───────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateLong(d) {
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function cycleDay(debut) {
  const diff = Math.floor((Date.now() - new Date(debut).getTime()) / 86400000)
  return (diff % 28) + 1
}

// ─── Composants UI ────────────────────────────────────────────────────────────

function Card({ children, className = '' }) {
  return (
    <div className={`bg-neutral-900 border border-neutral-800 rounded-2xl p-4 ${className}`}>
      {children}
    </div>
  )
}

function FieldLabel({ children }) {
  return <p className="text-xs text-neutral-500 uppercase tracking-wider font-medium">{children}</p>
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function Aujourdhui() {
  const { session } = useAuth()
  const [profil, setProfil] = useState(null)
  const [totalXp, setTotalXp] = useState(0)
  const [entry, setEntry] = useState({
    sommeil: '',
    humeur: 5,
    journee_difficile: false,
    quete_valeur: '',
    tracker4_nom: '',
    tracker4_valeur: '',
    journee_minimum: [],
  })
  const [loading, setLoading] = useState(true)
  const saveTimer = useRef(null)
  const profRef = useRef(null)

  useEffect(() => {
    if (!session) return
    const uid = session.user.id
    Promise.all([
      supabase.from('user_profile').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('journal').select('*').eq('user_id', uid).eq('date', todayISO()).maybeSingle(),
      supabase.from('journal').select('xp_gagnes_jour').eq('user_id', uid),
    ]).then(([{ data: p }, { data: j }, { data: xpRows }]) => {
      setProfil(p)
      profRef.current = p
      if (j) {
        setEntry({
          sommeil: j.sommeil ?? '',
          humeur: j.humeur ?? 5,
          journee_difficile: j.journee_difficile ?? false,
          quete_valeur: j.quete_valeur ?? '',
          tracker4_nom: j.tracker4_nom ?? '',
          tracker4_valeur: j.tracker4_valeur ?? '',
          journee_minimum: j.journee_minimum ?? [],
        })
      }
      setTotalXp(xpRows?.reduce((s, r) => s + (r.xp_gagnes_jour ?? 0), 0) ?? 0)
      setLoading(false)
    })
  }, [session])

  const doSave = useCallback((next) => {
    if (!session || !profRef.current) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const pts = next.journee_minimum.length * 5 * (next.journee_difficile ? 2 : 1)
      supabase.from('journal').upsert({
        user_id: session.user.id,
        date: todayISO(),
        sommeil: next.sommeil !== '' ? Number(next.sommeil) : null,
        humeur: Number(next.humeur),
        journee_difficile: next.journee_difficile,
        quete_valeur: next.quete_valeur !== '' ? Number(next.quete_valeur) : null,
        tracker4_nom: next.tracker4_nom || null,
        tracker4_valeur: next.tracker4_valeur !== '' ? Number(next.tracker4_valeur) : null,
        journee_minimum: next.journee_minimum,
        pts_gagnes_jour: pts,
        xp_gagnes_jour: 0,
      }, { onConflict: 'user_id,date' })
    }, 600)
  }, [session])

  const update = useCallback((key, val) => {
    setEntry(prev => {
      const next = { ...prev, [key]: val }
      if (key === 'humeur') next.journee_difficile = Number(val) <= 2
      doSave(next)
      return next
    })
  }, [doSave])

  const toggleMin = useCallback((id) => {
    setEntry(prev => {
      const has = prev.journee_minimum.includes(id)
      const next = {
        ...prev,
        journee_minimum: has
          ? prev.journee_minimum.filter(t => t !== id)
          : [...prev.journee_minimum, id],
      }
      doSave(next)
      return next
    })
  }, [doSave])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const classe = profil?.classe ?? 'guerrier'
  const { level, progress, xpToNext, isMax } = getLevelInfo(totalXp)
  const classeTitle = TITLES[classe]?.[level - 1] ?? ''
  const ptsToday = entry.journee_minimum.length * 5 * (entry.journee_difficile ? 2 : 1)
  const xpToday = 0

  const humeurColor = entry.humeur <= 2
    ? 'text-red-400'
    : entry.humeur <= 5 ? 'text-yellow-400' : 'text-green-400'

  const dayNum = profil?.cycle_actif && profil?.cycle_debut
    ? cycleDay(profil.cycle_debut)
    : null

  return (
    <div className="flex flex-col gap-4 p-4">

      {/* ── Date & cycle ─────────────────────────────────────────────── */}
      <div>
        <p className="text-lg font-semibold text-white capitalize">
          {formatDateLong(new Date())}
        </p>
        {dayNum && (
          <p className="text-sm text-violet-400 mt-0.5">🌙 Jour {dayNum} du cycle</p>
        )}
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
            <p className="text-white font-semibold text-sm">{ptsToday} pts · {xpToday} XP</p>
          </div>
        </div>
        <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-neutral-500 mt-1.5">
          {isMax
            ? 'Niveau maximum atteint'
            : `${xpToNext} XP pour le niveau ${level + 1}`}
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

      {/* ── Trackers principaux ───────────────────────────────────────── */}
      <Card>
        <p className="text-sm font-semibold text-neutral-200 mb-4">Trackers</p>
        <div className="flex flex-col gap-5">

          {/* Sommeil */}
          <div>
            <FieldLabel>Sommeil (heures)</FieldLabel>
            <input
              type="number"
              min="0"
              max="24"
              step="0.5"
              value={entry.sommeil}
              onChange={e => update('sommeil', e.target.value)}
              placeholder="ex. 7.5"
              className="mt-2 w-full px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-600 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          {/* Humeur */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <FieldLabel>Humeur</FieldLabel>
              <span className={`text-base font-bold ${humeurColor}`}>{entry.humeur} / 10</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={entry.humeur}
              onChange={e => update('humeur', e.target.value)}
              className="w-full h-2 rounded-full appearance-none cursor-pointer accent-violet-500 bg-neutral-800"
            />
            <div className="flex justify-between text-xs text-neutral-600 mt-1">
              <span>1</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Quête centrale (conditionnel) ─────────────────────────────── */}
      {profil?.quete_active && (
        <Card>
          <FieldLabel>Quête centrale</FieldLabel>
          <p className="text-white font-semibold text-sm mt-0.5 mb-3">🎯 {profil.quete_nom}</p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0"
              step="1"
              value={entry.quete_valeur}
              onChange={e => update('quete_valeur', e.target.value)}
              placeholder="0"
              className="w-24 px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-600 focus:outline-none focus:border-violet-500 transition-colors text-center"
            />
            <span className="text-neutral-400 text-sm">{profil.quete_unite} aujourd'hui</span>
          </div>
        </Card>
      )}

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
            type="number"
            min="0"
            step="1"
            value={entry.tracker4_valeur}
            onChange={e => update('tracker4_valeur', e.target.value)}
            placeholder="0"
            className="w-20 px-3 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-600 focus:outline-none focus:border-violet-500 transition-colors text-center"
          />
        </div>
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
                  {checked && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={`text-sm flex-1 ${checked ? 'text-white' : 'text-neutral-400'}`}>
                  {task.label}
                </span>
                <span className="text-xs text-neutral-600">
                  +{5 * (entry.journee_difficile ? 2 : 1)} pts
                </span>
              </button>
            )
          })}
        </div>
        {entry.journee_minimum.length > 0 && (
          <p className="text-xs text-neutral-500 mt-3 text-right">
            {entry.journee_minimum.length}/3 · {ptsToday} pts gagnés
          </p>
        )}
      </Card>

    </div>
  )
}
