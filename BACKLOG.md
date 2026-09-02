# Backlog

- Vier Fragetypen sind dominant, weil der eigene Bestand schief ist, nicht die Welt: Sprache
  der Genre-Literatur (80 % Englisch), Amtssprachenländer (51 % „2 Länder"), Geologietyp
  (50 % Vulkan) und Essbarkeit von Pilzen (58 % essbar). Sie sind in
  `scripts/lib/dominance_policy.cjs` mit Begründung und Obergrenze freigegeben; abbauen lässt
  sich das nur über einen breiteren Bestand, nicht über andere Distraktoren. Die übrigen
  vierzehn dominanten Typen bilden die Wirklichkeit ab (die meisten Schriften laufen von links
  nach rechts, die IUCN stuft die Mehrheit der Arten als nicht gefährdet ein) und bleiben so.
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
