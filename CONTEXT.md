# CONTEXT — Mycelium

Mémoire de projet pour les sessions Claude. Toujours lire ce fichier en début de session.

---

## Description

PWA de suivi d'habitudes gamifiée, conçue pour les personnes TDAH/TSA.
Système de points + XP, classes RPG, quête centrale (résistance à une mauvaise habitude), récompenses achetables.
Interface mobile-first, dark theme violet.

---

## Stack technique

| Outil | Version | Rôle |
|---|---|---|
| React | 19 | UI |
| Vite | 8 | Bundler |
| Tailwind CSS | 4.2 | Styling (via @tailwindcss/vite) |
| React Router | 7 | Navigation (5 onglets) |
| Supabase JS | 2.x | Auth + base de données |
| vite-plugin-pwa | 1.x | PWA / installable |
| Chart.js + react-chartjs-2 | 4.x | Graphiques (pas encore utilisé) |

**Auth** : magic link Supabase (pas de mot de passe).  
**Déploiement** : Vercel (CI/CD automatique sur push main).

---

## URLs

- **GitHub** : https://github.com/sjsandrine/Mycelium
- **Production** : https://mycelium-pearl.vercel.app

---

## Structure du projet

```
src/
├── App.jsx                   # Router + layout + AuthContext
├── context/AuthContext.jsx   # Auth state (session Supabase)
├── lib/supabase.js           # Client Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
├── components/
│   ├── BottomNav.jsx         # Navigation 5 onglets
│   └── Header.jsx            # Email + boutons reset/logout
└── pages/
    ├── Auth.jsx              # Page magic link
    ├── Onboarding.jsx        # Wizard 6 étapes
    ├── Aujourdhui.jsx        # Onglet principal ✅
    ├── Progression.jsx       # Onglet progression ✅
    ├── Recompenses.jsx       # Stub
    ├── Niveaux.jsx           # Stub
    └── Historique.jsx        # Stub
```

---

## Ce qui est fait ✅

- **Setup** : Vite + React + Tailwind + Supabase + PWA configurés
- **Auth** : magic link, redirect automatique, protection des routes
- **Onboarding** : wizard 6 étapes (classe, cycle menstruel, quête centrale, 2 habitudes, récap)
- **Onglet Aujourd'hui** : trackers sommeil/humeur/libre, habitudes selfcare + responsabilités, quête centrale (résistance + indulgence), notes, journée minimum, auto-save 600 ms
- **Onglet Progression** : niveau actuel + barre XP, stats globales (pts à vie, pts dispo, XP, jours remplis, moyennes humeur/sommeil 30 j), série de résistance + record, liste récompenses achetées

---

## Ce qui reste à faire

- **Récompenses** : boutique pour dépenser les points disponibles → insère dans `recompenses_achetees`
- **Niveaux** : tableau des 10 niveaux par classe, visualisation des seuils XP
- **Historique** : calendrier ou liste des journées passées avec stats
- **Passe visuelle** : illustrations, animations, polish UI
- **Publicités / monétisation** : à définir

---

## Tables Supabase

### `user_profile`
```
user_id            UUID PK (= auth.users.id)
classe             TEXT ('guerrier' | 'magicien' | 'commercant')
cycle_actif        BOOLEAN
cycle_debut        DATE
quete_active       BOOLEAN
quete_nom          TEXT
quete_unite        TEXT
quete_cout_unite   INTEGER (pts par unité d'indulgence)
onboarding_complete BOOLEAN
```

### `habitudes`
```
id          UUID PK
user_id     UUID FK
nom         TEXT
type        TEXT ('selfcare' | 'responsabilite')
difficulte  TEXT ('facile' | 'moyen' | 'difficile')
actif       BOOLEAN
created_at  TIMESTAMPTZ
```

### `habitudes_cochees`
```
user_id     UUID FK
date        DATE
habitude_id UUID FK
pts         INTEGER
xp          INTEGER
PK: (user_id, date, habitude_id)
```

### `journal`
```
user_id            UUID FK
date               DATE
sommeil            NUMERIC
humeur             INTEGER (1–10)
journee_difficile  BOOLEAN
quete_cochee       BOOLEAN
quete_valeur       INTEGER (unités d'indulgence utilisées)
tracker4_nom       TEXT
tracker4_valeur    NUMERIC
notes              TEXT
journee_minimum    TEXT[] (['eau','manger','quitter'])
pts_gagnes_jour    INTEGER
xp_gagnes_jour     INTEGER
PK: (user_id, date)
```

### `user_stats` *(à créer si absente)*
```sql
CREATE TABLE IF NOT EXISTS user_stats (
  user_id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xp_total        INTEGER DEFAULT 0,
  pts_total_gagne INTEGER DEFAULT 0,
  pts_disponible  INTEGER DEFAULT 0,
  niveau_actuel   SMALLINT DEFAULT 1,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own stats" ON user_stats FOR ALL USING (auth.uid() = user_id);
```
*Note : actuellement calculée dynamiquement depuis `journal`, pas encore persistée.*

### `recompenses_achetees` *(à créer si absente)*
```sql
CREATE TABLE IF NOT EXISTS recompenses_achetees (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nom        TEXT NOT NULL,
  cout_paye  INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE recompenses_achetees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own recompenses" ON recompenses_achetees FOR ALL USING (auth.uid() = user_id);
```

---

## Système économique

### Deux ressources distinctes
| Ressource | Usage | Réinitialisation |
|---|---|---|
| **Points (pts)** | Dépensables en récompenses | Non — mais dépensés |
| **XP** | Permanent, détermine le niveau | Jamais |

### Gains par action
| Action | Points | XP |
|---|---|---|
| Habitude facile | 5 | 5 (responsabilité uniquement) |
| Habitude moyen | 10 | 10 (responsabilité uniquement) |
| Habitude difficile | 20 | 20 (responsabilité uniquement) |
| Journée minimum (x3) | 5 chacune | 0 |
| Résistance quête | 20 | 20 |
| Journée difficile (humeur ≤ 2) | ×2 tout | ×2 tout |
| Indulgence quête | −(cout_unite × valeur) | 0 |

Les habitudes **selfcare** donnent des points mais **pas d'XP**.

### Classes et niveaux
3 classes : **Guerrier**, **Magicien**, **Commerçant**  
10 niveaux chacun avec des titres différents par classe.

**Seuils XP** : `[0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 5800]`

| Niveau | XP requis | Guerrier | Magicien | Commerçant |
|---|---|---|---|---|
| 1 | 0 | Recrue | Novice | Apprenti |
| 2 | 100 | Combattant | Apprenti | Marchand |
| 3 | 250 | Soldat | Praticien | Négociant |
| 4 | 500 | Guerrier | Érudit | Entrepreneur |
| 5 | 900 | Champion | Arcaniste | Investisseur |
| 6 | 1 400 | Maître | Archimage | Baron |
| 7 | 2 100 | Épique | Sage | Magnat |
| 8 | 3 000 | Légendaire | Oracle | Tycoon |
| 9 | 4 200 | Mythique | Transcendant | Oligarque |
| 10 | 5 800 | Immortel | Omniscient | Légende |

---

## Conventions de code

- Dark theme : `bg-neutral-950` base, cartes `bg-neutral-900 border border-neutral-800 rounded-2xl`
- Couleur principale : `violet-500`
- Layout : `max-w-lg`, mobile-first, `dvh` pour la hauteur
- Pas de commentaires inutiles, pas de TypeScript (JSX pur)
- Tailwind : pas de template literals dynamiques (classes statiques pour JIT)
- RLS activé sur toutes les tables, toujours filtrer par `user_id`
