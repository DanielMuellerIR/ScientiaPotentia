// Vite-Entry — von index.html als /src/main.jsx geladen.
// HINWEIS (2026-06-04): Nach Datenverlust neu erstellt — Standard-Vite/React-18-Boilerplate.
// Das Original war identisch-trivial (createRoot → <App/>); falls es via Time Machine
// auftaucht, einfach ersetzen. Siehe RECONSTRUCTION-TODO.md.
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
