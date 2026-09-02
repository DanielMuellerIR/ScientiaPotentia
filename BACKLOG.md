# Backlog

- 18 Fragetypen haben eine dominante Lösung: Dieselbe Antwort ist in mindestens der Hälfte
  aller Fälle richtig, am stärksten bei Schriftrichtung (85 %), Netzwerkschicht (82 %),
  Schrifttyp einer Sprache (81 %), Motorgattung (81 %) und Sprache der Genre-Literatur (80 %).
  `npm run audit:questions` listet sie unter „Dominante Antwort". Je Typ ist zu entscheiden,
  ob der Distraktorpool erweitert, die Frage umformuliert oder der Typ gestrichen wird. Die
  Verteilung bildet teils die Wirklichkeit ab, macht die Frage aber trotzdem erratbar.
- Die Bildabdeckung von Homo hinkt der Konzeptzahl hinterher: 946 Konzepte, 306 Bilder. Die
  acht neuen Kategorien der Welle vom 2026-09-02 haben noch keine aufgelösten Commons-Bilder.
- Die vier Lingua-Kategorien Lehnwort, Sprachkuriosum, Grammatik und Phonetik (80 Konzepte)
  erzeugen bis heute keine einzige Frage, weil ihre Attributschlüssel je Konzept verschieden
  sind. Sie brauchen einen eigenen Fragetyp; Begründung in `docs/attribut_luecken.md`.
- Lizenz der vorgesehenen IAU-Grenzdaten ausdrücklich dokumentieren, bevor sie gebündelt werden.
- Responsive Shell und VisualPanel auf einem echten iPhone im Hochformat prüfen.
- Bildabdeckung in Museum und Explorern nur mit fachlich eindeutigen, freien Kandidaten erweitern.
- Verbleibende Sach- und Fairnesskandidaten aus den semantischen QA-Berichten einzeln gegen
  belastbare Quellen prüfen.
- Das Deployment langfristig auf unveränderliche Release-Verzeichnisse mit einem atomar
  umgeschalteten Release-Zeiger umstellen. Der aktuelle Ablauf veröffentlicht Assets vor dem
  Entrypoint und kann deshalb kurzzeitig alten Code mit neuen Daten kombinieren.
- Terra erst dann in den Bereichsmix aufnehmen, wenn Kartenfragen und generische Konzeptkarten
  denselben visuellen Vertrag erfüllen.
