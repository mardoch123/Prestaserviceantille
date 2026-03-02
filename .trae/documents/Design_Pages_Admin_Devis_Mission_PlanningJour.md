# Spécification UI/UX (desktop-first)

## Global Styles (communs)
- Layout: Grille 12 colonnes (CSS Grid) pour les zones principales + Flexbox pour alignements internes.
- Conteneur: largeur max 1200–1440px, padding 24px, interlignes 16/24.
- Typo: base 14–16px, titres 20/24/32px, chiffres (totaux) en semi-bold.
- Couleurs: fond #F7F8FA, cartes #FFFFFF, texte #111827, secondaire #6B7280.
- Actions: bouton primaire (fond sombre ou couleur marque), secondaire (outline), danger (rouge) ; hover = légère élévation + assombrissement 4–6%.
- États: skeleton loading, empty state (icone + texte), error state (message + action retour).

---

## Page 1 — Admin • Détail devis (ouvert depuis notification)

### Layout
- Structure: Header fixe (optionnel) + contenu en 2 colonnes.
  - Colonne gauche (8/12): contenu principal du devis.
  - Colonne droite (4/12): panneau “Résumé / Totaux”.
- Responsive: en dessous ~1024px, colonnes empilées (résumé passe en haut).

### Meta Information
- Title: `Admin — Devis {id}`
- Description: `Détail complet du devis.`
- Open Graph: titre identique + type `website`.

### Page Structure
1. Bandeau haut: fil d’Ariane + bouton “Retour”.
2. En-tête devis: ID, statut, date, client.
3. Corps: tableau des lignes du devis.
4. Panneau latéral: sous-total, total, infos complémentaires.

### Sections & Components
- Banner “Ouvert depuis notification” (si navigation via push): petit bandeau info discret, avec lien “Voir dans le planning” uniquement si relation existe (sinon absent).
- Card “Infos devis”: champs en 2 colonnes (label/value) ; valeurs longues en wrap.
- Table “Lignes”: colonnes Désignation / Qté / PU / Total ligne ; footer total.
- Card “Résumé”: total mis en avant ; cohérence des formats (monnaie, séparateurs).
- États:
  - Loading: skeleton sur en-tête + table.
  - Not found: message “Devis introuvable” + bouton retour.

---

## Page 2 — Admin • Détail mission / planning (ouvert depuis notification)

### Layout
- Structure: header + contenu en 2 blocs verticaux.
  - Bloc 1: résumé mission (date, créneau, statut).
  - Bloc 2: détails (lieu, description/notes, références si existantes).

### Meta Information
- Title: `Admin — Mission {id}`
- Description: `Détail d’une mission planifiée.`

### Page Structure
1. Fil d’Ariane + retour.
2. En-tête mission (ID, statut) + chip date.
3. Cartes: “Créneau”, “Lieu”, “Détails”.

### Sections & Components
- Banner “Ouvert depuis notification”: indique la source et propose “Aller au jour du planning” (navigue vers la date de la mission).
- Card “Créneau”: heure début/fin + durée calculée.
- Card “Lieu”: adresse/zone (si disponible).
- Card “Notes”: texte multi-lignes, sanitization si contenu riche.
- États:
  - Loading: skeleton sur cartes.
  - Not found: message “Mission introuvable” + retour.

---

## Page 3 — Admin • Planning (Vue jour) + correction “Total heures”

### Layout
- Structure: barre d’outils (top) + liste du jour + panneau latéral d’indicateurs.
  - Liste (8/12): items (missions) en liste chronologique.
  - Indicateurs (4/12): “Total heures”, compte missions, filtres minimum si déjà existants.
- Responsive: empilement, indicateurs au-dessus de la liste.

### Meta Information
- Title: `Admin — Planning (Jour)`
- Description: `Planning quotidien et total d’heures.`

### Page Structure
1. Toolbar: sélecteur date (input) + boutons précédent/suivant.
2. Bloc indicateurs: “Total heures” (élément principal).
3. Liste missions: cartes compactes.

### Sections & Components
- Sélecteur de jour:
  - Affiche la date actuellement consultée (celle du paramètre `date`/state UI).
  - Met à jour la liste ET les indicateurs à chaque changement.
- Liste missions (item): heure, titre (client/lieu si existant), statut ; clic ouvre détail mission.
- Widget “Total heures” (CORRECTION):
  - Calcule le total uniquement sur l’intervalle [début du jour affiché, fin du jour affiché].
  - Pour une mission qui traverse minuit, ne compte que la portion dans le jour affiché.
  - Utilise le même fuseau horaire que l’affichage du planning.
  - Affiche en `X h YY` (ou `X,YY h` selon convention produit).
- États:
  - Empty state: “Aucune mission ce jour”.
  - Error state: “Impossible de charger le planning” + action retry.
