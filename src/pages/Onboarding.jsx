import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const CLASSES = [
  {
    id: 'guerrier',
    label: 'Guerrier',
    emoji: '⚔️',
    description: "Tu avances pas à pas, même quand c'est difficile. Ta force vient de ta capacité à te relever, pas à ne jamais tomber.",
  },
  {
    id: 'magicien',
    label: 'Magicien',
    emoji: '🔮',
    description: "Tu avances par la compréhension. Chaque habitude est un rituel. Ta puissance vient de la connaissance de toi-même.",
  },
  {
    id: 'commercant',
    label: 'Commerçant',
    emoji: '⚖️',
    description: "Tu avances par l'échange. Chaque effort mérite récompense. Tu sais négocier avec toi-même pour obtenir ce que tu veux.",
  },
]

const DIFFICULTES = [
  { id: 'facile',   label: 'Facile',    active: 'border-green-400 text-green-400 bg-green-400/10' },
  { id: 'moyen',    label: 'Moyen',     active: 'border-yellow-400 text-yellow-400 bg-yellow-400/10' },
  { id: 'difficile',label: 'Difficile', active: 'border-red-400 text-red-400 bg-red-400/10' },
]

const TOTAL_STEPS = 6

function DifficulteSelector({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {DIFFICULTES.map(d => (
        <button
          key={d.id}
          type="button"
          onClick={() => onChange(d.id)}
          className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
            value === d.id
              ? d.active
              : 'border-neutral-700 text-neutral-500 hover:border-neutral-500'
          }`}
        >
          {d.label}
        </button>
      ))}
    </div>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-neutral-700/60 last:border-0">
      <span className="text-neutral-400 text-sm shrink-0">{label}</span>
      <span className="text-white text-sm text-right">{value}</span>
    </div>
  )
}

export default function Onboarding({ onComplete }) {
  const { session } = useAuth()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState({
    classe: null,
    cycle_actif: null,
    quete_active: null,
    quete_nom: '',
    quete_unite: '',
    selfcare_nom: '',
    selfcare_difficulte: null,
    responsabilite_nom: '',
    responsabilite_difficulte: null,
  })

  const update = (key, value) => setData(d => ({ ...d, [key]: value }))

  const canNext = () => {
    switch (step) {
      case 0: return data.classe !== null
      case 1: return data.cycle_actif !== null
      case 2:
        if (data.quete_active === null) return false
        if (data.quete_active) return data.quete_nom.trim() !== '' && data.quete_unite.trim() !== ''
        return true
      case 3: return data.selfcare_nom.trim() !== '' && data.selfcare_difficulte !== null
      case 4: return data.responsabilite_nom.trim() !== '' && data.responsabilite_difficulte !== null
      case 5: return true
      default: return false
    }
  }

  const handleComplete = async () => {
    setSaving(true)

    await supabase.from('user_profile').upsert({
      user_id: session.user.id,
      classe: data.classe,
      cycle_actif: data.cycle_actif,
      quete_active: data.quete_active,
      quete_nom: data.quete_active ? data.quete_nom.trim() : null,
      quete_unite: data.quete_active ? data.quete_unite.trim() : null,
      onboarding_complete: true,
    })

    await supabase.from('habitudes').insert([
      {
        user_id: session.user.id,
        nom: data.selfcare_nom.trim(),
        type: 'selfcare',
        difficulte: data.selfcare_difficulte,
        actif: true,
      },
      {
        user_id: session.user.id,
        nom: data.responsabilite_nom.trim(),
        type: 'responsabilite',
        difficulte: data.responsabilite_difficulte,
        actif: true,
      },
    ])

    setSaving(false)
    onComplete()
  }

  const classeInfo = CLASSES.find(c => c.id === data.classe)

  const steps = [
    // Étape 0 — Classe
    <div key="classe" className="flex flex-col gap-3">
      <div className="mb-2">
        <h2 className="text-2xl font-bold text-white mb-1">Choisis ta classe</h2>
        <p className="text-neutral-400 text-sm">Elle définit ton style d'avancement.</p>
      </div>
      {CLASSES.map(c => (
        <button
          key={c.id}
          type="button"
          onClick={() => update('classe', c.id)}
          className={`w-full text-left p-4 rounded-xl border transition-all ${
            data.classe === c.id
              ? 'border-violet-500 bg-violet-500/10'
              : 'border-neutral-700 bg-neutral-800/40 hover:border-neutral-600'
          }`}
        >
          <div className="flex items-center gap-3 mb-1.5">
            <span className="text-2xl">{c.emoji}</span>
            <span className="font-semibold text-white">{c.label}</span>
          </div>
          <p className="text-neutral-400 text-sm leading-snug">{c.description}</p>
        </button>
      ))}
    </div>,

    // Étape 1 — Cycle
    <div key="cycle" className="flex flex-col gap-3">
      <div className="mb-2">
        <h2 className="text-2xl font-bold text-white mb-1">Suivi de cycle</h2>
        <p className="text-neutral-400 text-sm">
          Active le suivi de ton cycle menstruel pour adapter tes habitudes à tes phases.
        </p>
      </div>
      {[
        { val: true,  label: 'Oui, activer', emoji: '🌙' },
        { val: false, label: 'Non merci',    emoji: '✕' },
      ].map(opt => (
        <button
          key={String(opt.val)}
          type="button"
          onClick={() => update('cycle_actif', opt.val)}
          className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-4 ${
            data.cycle_actif === opt.val
              ? 'border-violet-500 bg-violet-500/10'
              : 'border-neutral-700 bg-neutral-800/40 hover:border-neutral-600'
          }`}
        >
          <span className="text-xl w-6 text-center">{opt.emoji}</span>
          <span className="font-semibold text-white">{opt.label}</span>
        </button>
      ))}
    </div>,

    // Étape 2 — Quête centrale
    <div key="quete" className="flex flex-col gap-3">
      <div className="mb-2">
        <h2 className="text-2xl font-bold text-white mb-1">Quête centrale</h2>
        <p className="text-neutral-400 text-sm">
          Une habitude que tu veux décourager — cigarettes, sucre, réseaux sociaux…
        </p>
      </div>
      {[
        { val: true,  label: 'Oui, activer', emoji: '🎯' },
        { val: false, label: 'Non merci',    emoji: '✕' },
      ].map(opt => (
        <button
          key={String(opt.val)}
          type="button"
          onClick={() => update('quete_active', opt.val)}
          className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-4 ${
            data.quete_active === opt.val
              ? 'border-violet-500 bg-violet-500/10'
              : 'border-neutral-700 bg-neutral-800/40 hover:border-neutral-600'
          }`}
        >
          <span className="text-xl w-6 text-center">{opt.emoji}</span>
          <span className="font-semibold text-white">{opt.label}</span>
        </button>
      ))}
      {data.quete_active && (
        <div className="flex flex-col gap-3 pt-2">
          <div>
            <label className="text-sm text-neutral-400 mb-1.5 block">Nom de l'habitude</label>
            <input
              type="text"
              value={data.quete_nom}
              onChange={e => update('quete_nom', e.target.value)}
              placeholder="ex. cigarettes"
              className="w-full px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>
          <div>
            <label className="text-sm text-neutral-400 mb-1.5 block">Unité (singulier)</label>
            <input
              type="text"
              value={data.quete_unite}
              onChange={e => update('quete_unite', e.target.value)}
              placeholder="ex. cigarette"
              className="w-full px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>
        </div>
      )}
    </div>,

    // Étape 3 — Selfcare
    <div key="selfcare" className="flex flex-col gap-4">
      <div className="mb-2">
        <h2 className="text-2xl font-bold text-white mb-1">Premier selfcare</h2>
        <p className="text-neutral-400 text-sm">
          Une habitude positive pour toi — méditation, sport, lecture…
        </p>
      </div>
      <div>
        <label className="text-sm text-neutral-400 mb-1.5 block">Nom</label>
        <input
          type="text"
          value={data.selfcare_nom}
          onChange={e => update('selfcare_nom', e.target.value)}
          placeholder="ex. méditation"
          className="w-full px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500 transition-colors"
        />
      </div>
      <div>
        <label className="text-sm text-neutral-400 mb-2 block">Difficulté</label>
        <DifficulteSelector value={data.selfcare_difficulte} onChange={v => update('selfcare_difficulte', v)} />
      </div>
    </div>,

    // Étape 4 — Responsabilité
    <div key="responsabilite" className="flex flex-col gap-4">
      <div className="mb-2">
        <h2 className="text-2xl font-bold text-white mb-1">Première responsabilité</h2>
        <p className="text-neutral-400 text-sm">
          Une obligation à honorer — ménage, budget, emails…
        </p>
      </div>
      <div>
        <label className="text-sm text-neutral-400 mb-1.5 block">Nom</label>
        <input
          type="text"
          value={data.responsabilite_nom}
          onChange={e => update('responsabilite_nom', e.target.value)}
          placeholder="ex. ménage"
          className="w-full px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500 transition-colors"
        />
      </div>
      <div>
        <label className="text-sm text-neutral-400 mb-2 block">Difficulté</label>
        <DifficulteSelector value={data.responsabilite_difficulte} onChange={v => update('responsabilite_difficulte', v)} />
      </div>
    </div>,

    // Étape 5 — Confirmation
    <div key="confirmation" className="flex flex-col gap-4">
      <div className="mb-2">
        <h2 className="text-2xl font-bold text-white mb-1">Tout est prêt !</h2>
        <p className="text-neutral-400 text-sm">Résumé de ton profil avant de commencer.</p>
      </div>
      <div className="bg-neutral-800/50 rounded-xl p-4 border border-neutral-700 flex flex-col">
        <SummaryRow label="Classe" value={`${classeInfo?.emoji} ${classeInfo?.label}`} />
        <SummaryRow label="Cycle" value={data.cycle_actif ? '🌙 Activé' : 'Désactivé'} />
        <SummaryRow
          label="Quête centrale"
          value={data.quete_active ? `🎯 ${data.quete_nom} (${data.quete_unite})` : 'Désactivée'}
        />
        <SummaryRow label="Selfcare" value={`${data.selfcare_nom} · ${data.selfcare_difficulte}`} />
        <SummaryRow label="Responsabilité" value={`${data.responsabilite_nom} · ${data.responsabilite_difficulte}`} />
      </div>
    </div>,
  ]

  return (
    <div className="flex flex-col min-h-dvh bg-neutral-950 max-w-lg mx-auto px-5 pt-8 pb-6">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex justify-between text-xs text-neutral-500 mb-2">
          <span>Étape {step + 1} / {TOTAL_STEPS}</span>
          <span>{Math.round(((step + 1) / TOTAL_STEPS) * 100)} %</span>
        </div>
        <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-500 rounded-full transition-all duration-300"
            style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        {steps[step]}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-6">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(s => s - 1)}
            className="flex-1 py-3 rounded-xl border border-neutral-700 text-neutral-300 font-medium hover:border-neutral-500 transition-colors"
          >
            Retour
          </button>
        )}
        {step < TOTAL_STEPS - 1 ? (
          <button
            type="button"
            onClick={() => setStep(s => s + 1)}
            disabled={!canNext()}
            className="flex-1 py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Suivant
          </button>
        ) : (
          <button
            type="button"
            onClick={handleComplete}
            disabled={saving}
            className="flex-1 py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Sauvegarde…' : '🍄 Commencer'}
          </button>
        )}
      </div>
    </div>
  )
}
