# M3U Live Player

Lecteur web M3U/M3U8 pour chaînes Live, basé sur React, Vite et hls.js.

## Installation

Prérequis : Node.js 18+.

```bash
npm install
npm run dev
```

Puis ouvre l'adresse indiquée par Vite.

## Production

```bash
npm run build
npm run preview
```

## Fonctionnalités

- Import de fichiers `.m3u`, `.m3u8` et `.txt`
- Chargement d'une playlist M3U distante
- Lecture HLS `.m3u8` avec hls.js
- Support natif HLS sur les navigateurs qui le proposent
- Recherche
- Groupes/catégories
- Favoris sauvegardés localement
- Plein écran
- Volume / mute
- Reconnexion réseau HLS basique
- Interface responsive

## Important

La lecture des flux dépend du navigateur, du serveur de streaming et de ses règles CORS. Utilise uniquement des playlists et flux pour lesquels tu disposes des droits nécessaires.
