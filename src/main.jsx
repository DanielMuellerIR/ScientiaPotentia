// Vite-Entry — von index.html als /src/main.jsx geladen.
// HINWEIS (2026-06-04): Nach Datenverlust neu erstellt — Standard-Vite/React-18-Boilerplate.
// Das Original war identisch-trivial (createRoot → <App/>); falls es via Time Machine
// auftaucht, einfach ersetzen. Siehe docs/archive/RECONSTRUCTION-TODO.md.
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { loadImageMirror } from './utils/imageMirror'
import './index.css'

// Das Bildmanifest sofort anfordern, nicht erst wenn die erste Bildkomponente
// erscheint: Es entscheidet über jede Bildadresse, und der Abruf läuft parallel
// zum Aufbau der Oberfläche.
loadImageMirror()

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
