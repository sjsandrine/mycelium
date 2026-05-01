import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

// ─── Constantes niveau/titres ─────────────────────────────────────────────────

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
  return {
    level,
    progress: Math.min(((totalXp - cur) / (nxt - cur)) * 100, 100),
    xpToNext: isMax ? 0 : Math.max(nxt - totalXp, 0),
    isMax,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function subtractDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() - 1)
  return toDateStr(d)
}

function avg(arr) {
  const valid = arr.filter(v => v !== null && v !== undefined && !isNaN(v))
  if (!valid.length) return null
  return valid.reduce((s, v) => s + Number(v), 0) / valid.length
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function computeStreaks(journalRows) {
  const resistedDates = new Set(journalRows.filter(r => r.quete_cochee).map(r => r.date))
  const allDates = new Set(journalRows.map(r => r.date))

  let currentStreak = 0
  let cursor = toDateStr(new Date())
  for (let i = 0; i < 1000; i++) {
    if (resistedDates.has(cursor)) {
      currentStreak++
      cursor = subtractDay(cursor)
    } else {
      if (i === 0 && !allDates.has(cursor)) { cursor = subtractDay(cursor); continue }
      break
    }
  }

  const sorted = [...resistedDates].sort()
  let maxStreak = currentStreak
  let streak = 0
  let prev = null
  for (const ds of sorted) {
    if (prev) {
      const diff = Math.round((new Date(ds + 'T00:00:00') - new Date(prev + 'T00:00:00')) / 86400000)
      streak = diff === 1 ? streak + 1 : 1
    } else {
      streak = 1
    }
    if (streak > maxStreak) maxStreak = streak
    prev = ds
  }

  return { currentStreak, maxStreak }
}

// Regroupe les lignes indulgence par jour (agrège quantite + cout_paye)
function groupIndulgencesByDay(indulgences) {
  const byDay = {}
  for (const ind of indulgences) {
    const date = ind.created_at ? ind.created_at.split('T')[0] : null
    if (!date) continue
    if (!byDay[date]) byDay[date] = { date, quantite: 0, cout: 0, unite: ind.unite ?? '' }
    byDay[date].quantite += Number(ind.quantite ?? 0)
    byDay[date].cout     += Number(ind.cout_paye ?? 0)
  }
  return Object.values(byDay).sort((a, b) => b.date.localeCompare(a.date))
}

// ─── Composants UI ────────────────────────────────────────────────────────────

function Card({ children, className = '' }) {
  return (
    <div className={`bg-neutral-900 border border-neutral-800 rounded-2xl p-4 ${className}`}>
      {children}
    </div>
  )
}

function SectionLabel({ children }) {
  return <p className="text-xs text-neutral-500 uppercase tracking-wider font-medium mb-3">{children}</p>
}

function StatRow({ label, value, sub }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-neutral-800 last:border-0">
      <span className="text-sm text-neutral-400">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="text-sm font-semibold text-white">{value}</span>
        {sub && <span className="text-xs text-neutral-500">{sub}</span>}
      </div>
    </div>
  )
}

// ─── Page Progression ─────────────────────────────────────────────────────────

export default function Progression() {
  const { session } = useAuth()
  const [loading,     setLoading]     = useState(true)
  const [profil,      setProfil]      = useState(null)
  const [journalRows, setJournal]     = useState([])
  const [recompenses, setRecompenses] = useState([])   // type='recompense'
  const [indulgences, setIndulgences] = useState([])   // type='indulgence'

  useEffect(() => {
    if (!session) return
    const uid = session.user.id

    Promise.all([
      supabase.from('user_profile').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('journal')
        .select('date, xp_gagnes_jour, pts_gagnes_jour, humeur, sommeil, quete_cochee')
        .eq('user_id', uid),
      supabase.from('recompenses_achetees')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false }),
    ]).then(([profRes, journalRes, recompRes]) => {
      setProfil(profRes.data ?? null)
      setJournal(journalRes.data ?? [])
      const all = recompRes.error ? [] : (recompRes.data ?? [])
      setRecompenses(all.filter(r => !r.type || r.type === 'recompense'))
      setIndulgences(all.filter(r => r.type === 'indulgence'))
      setLoading(false)
    })
  }, [session])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Calculs ──────────────────────────────────────────────────────────────────

  const classe        = profil?.classe ?? 'guerrier'
  const xpTotal       = journalRows.reduce((s, r) => s + (r.xp_gagnes_jour  ?? 0), 0)
  const ptsTotalGagne = journalRows.reduce((s, r) => s + (r.pts_gagnes_jour ?? 0), 0)
  // ptsDisponible = gains totaux − achats de récompenses seulement
  // (l'indulgence est déjà déduite dans pts_gagnes_jour via Aujourd'hui)
  const ptsDisponible = Math.max(0, ptsTotalGagne - recompenses.reduce((s, r) => s + (r.cout_paye ?? 0), 0))
  const joursFilles   = journalRows.length

  const { level, progress, xpToNext, isMax } = getLevelInfo(xpTotal)
  const classeTitle = TITLES[classe]?.[level - 1] ?? ''

  const cutoff     = toDateStr((() => { const d = new Date(); d.setDate(d.getDate() - 30); return d })())
  const recent     = journalRows.filter(r => r.date >= cutoff)
  const avgHumeur  = avg(recent.map(r => r.humeur))
  const avgSommeil = avg(recent.filter(r => r.sommeil !== null).map(r => r.sommeil))

  const { currentStreak, maxStreak } = computeStreaks(journalRows)

  // Indulgences regroupées
  const indulgenceDays = groupIndulgencesByDay(indulgences)
  const today          = toDateStr(new Date())
  const monthStr       = today.slice(0, 7)   // 'YYYY-MM'
  const unite          = profil?.quete_unite ?? ''

  const todayInd = indulgenceDays.find(d => d.date === today) ?? { quantite: 0, cout: 0, unite }
  const monthInd = indulgenceDays
    .filter(d => d.date.startsWith(monthStr))
    .reduce((acc, d) => ({ quantite: acc.quantite + d.quantite, cout: acc.cout + d.cout }), { quantite: 0, cout: 0 })

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 p-4 pb-6">

      {/* ── Section 1 : Niveau actuel ─────────────────────────────────── */}
      <Card>
        <SectionLabel>Niveau actuel</SectionLabel>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-neutral-500 mb-0.5">Niveau {level}</p>
            <p className="text-white font-bold text-2xl">{classeTitle}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-neutral-500 mb-0.5">XP cumulé</p>
            <p className="text-violet-400 font-bold text-xl">{xpTotal} XP</p>
          </div>
        </div>
        <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
          <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-neutral-500 mt-2">
          {isMax ? 'Niveau maximum atteint — tu es une légende.' : `${xpToNext} XP manquants pour le niveau ${level + 1}`}
        </p>
      </Card>

      {/* ── Section 2 : Statistiques globales ────────────────────────── */}
      <Card>
        <SectionLabel>Statistiques globales</SectionLabel>
        <StatRow label="Points totaux gagnés à vie" value={ptsTotalGagne} sub="pts" />
        <StatRow label="Points disponibles"         value={ptsDisponible} sub="pts" />
        <StatRow label="XP total"                   value={xpTotal}       sub="XP"  />
        <StatRow label="Jours remplis"              value={joursFilles}   sub="jours" />
        <StatRow
          label="Humeur moyenne (30 jours)"
          value={avgHumeur !== null ? avgHumeur.toFixed(1) : '—'}
          sub={avgHumeur !== null ? '/ 10' : undefined}
        />
        <StatRow
          label="Sommeil moyen (30 jours)"
          value={avgSommeil !== null ? avgSommeil.toFixed(1) : '—'}
          sub={avgSommeil !== null ? 'h' : undefined}
        />
      </Card>

      {/* ── Section 3 : Quête centrale ───────────────────────────────── */}
      {profil?.quete_active && (
        <Card>
          <SectionLabel>Quête centrale</SectionLabel>
          <p className="text-sm text-white font-medium mb-4">🎯 {profil.quete_nom}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-neutral-800 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-green-400 leading-none">{currentStreak}</p>
              <p className="text-xs text-neutral-500 mt-2">{currentStreak <= 1 ? 'Jour de résistance' : 'Jours de résistance'}</p>
              <p className="text-xs text-neutral-600 mt-0.5">Série actuelle</p>
            </div>
            <div className="bg-neutral-800 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-violet-400 leading-none">{maxStreak}</p>
              <p className="text-xs text-neutral-500 mt-2">{maxStreak <= 1 ? 'Jour' : 'Jours'}</p>
              <p className="text-xs text-neutral-600 mt-0.5">Record personnel</p>
            </div>
          </div>
        </Card>
      )}

      {/* ── Section 4 : Indulgences utilisées ────────────────────────── */}
      {profil?.quete_active && (
        <Card>
          <SectionLabel>Indulgences utilisées</SectionLabel>
          {indulgenceDays.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-3">Aucune indulgence enregistrée</p>
          ) : (
            <>
              {/* Résumé du jour et du mois */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-neutral-800 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-amber-400 leading-none tabular-nums">
                    {todayInd.quantite}
                    <span className="text-xs font-normal text-neutral-400 ml-1">{unite}</span>
                  </p>
                  <p className="text-xs text-neutral-500 mt-1.5">Aujourd'hui</p>
                  {todayInd.cout > 0 && (
                    <p className="text-xs text-red-400 mt-0.5">−{todayInd.cout} pts</p>
                  )}
                </div>
                <div className="bg-neutral-800 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-amber-400 leading-none tabular-nums">
                    {monthInd.quantite}
                    <span className="text-xs font-normal text-neutral-400 ml-1">{unite}</span>
                  </p>
                  <p className="text-xs text-neutral-500 mt-1.5">Ce mois</p>
                  {monthInd.cout > 0 && (
                    <p className="text-xs text-red-400 mt-0.5">−{monthInd.cout} pts</p>
                  )}
                </div>
              </div>

              {/* Liste par jour */}
              <div className="flex flex-col">
                {indulgenceDays.map(day => (
                  <div
                    key={day.date}
                    className="flex items-center justify-between py-2.5 border-b border-neutral-800 last:border-0"
                  >
                    <div>
                      <p className="text-sm text-white">{formatDate(day.date)}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {day.quantite} {day.unite || unite}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-red-400 shrink-0 ml-4">
                      −{day.cout} pts
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      {/* ── Section 5 : Récompenses utilisées ────────────────────────── */}
      <Card>
        <SectionLabel>Récompenses utilisées</SectionLabel>
        {recompenses.length === 0 ? (
          <p className="text-sm text-neutral-500 text-center py-3">
            Aucune récompense utilisée pour l'instant
          </p>
        ) : (
          <div className="flex flex-col">
            {recompenses.map((r, i) => {
              const nom  = r.nom ?? 'Récompense'
              const cout = r.cout_paye ?? 0
              const date = r.created_at ? formatDate(r.created_at.split('T')[0]) : ''
              return (
                <div
                  key={r.id ?? i}
                  className="flex items-center justify-between py-2.5 border-b border-neutral-800 last:border-0"
                >
                  <div>
                    <p className="text-sm text-white">{nom}</p>
                    {date && <p className="text-xs text-neutral-500 mt-0.5">{date}</p>}
                  </div>
                  <p className="text-sm font-semibold text-red-400 shrink-0 ml-4">−{cout} pts</p>
                </div>
              )
            })}
          </div>
        )}
      </Card>

    </div>
  )
}
