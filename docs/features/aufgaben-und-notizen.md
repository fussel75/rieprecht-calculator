# Feature: Aufgaben & Notizen

Erweitere den Rieprecht Calculator um ein neues Hauptmenü-Modul „Aufgaben & Notizen" mit zwei Tabs/Unterbereichen: **Aufgaben** und **Notizen**. Tech-agnostisch — nutze den bestehenden Stack des Projekts (Frontend, Backend, DB, Auth, E-Mail-Versand) und füge dich in vorhandene Patterns (Routing, Layout, State, API-Struktur) ein. Bestehende User werden als Zuweisungs-Empfänger genutzt.

## Aufgaben

Eine vollwertige Task-Verwaltung mit allem, was eine moderne Aufgaben-App können sollte:

- CRUD für Aufgaben mit Titel, Beschreibung (Rich Text oder Markdown), Fälligkeitsdatum, Priorität (niedrig/mittel/hoch/dringend), Status (offen / in Bearbeitung / erledigt)
- Zuweisung an einen oder mehrere App-User; Ersteller und Zugewiesene sind getrennt sichtbar
- Weiterbearbeitung jederzeit: Beschreibung, Anhänge, Kommentare, Fälligkeit etc. lassen sich nach dem Anlegen ergänzen — auch von Zugewiesenen, nicht nur vom Ersteller
- Kommentar-/Verlaufs-Feed pro Aufgabe (chronologisch, mit Autor und Zeitstempel) — damit Diskussion und nachträgliche Gedanken dokumentiert sind
- Datei-Anhänge (Bilder, PDFs, Office-Dokumente) — Upload, Vorschau wo möglich, Download, Löschen
- Erinnerungen / Eskalation bei nicht erledigten Aufgaben — Benachrichtigung in-app UND per E-Mail (E-Mail-Infrastruktur ist im Projekt schon vorhanden, diese nutzen):
  - automatischer Reminder bei Annäherung an Fälligkeit (z. B. 24 h vorher)
  - Eskalations-Reminder wenn Fälligkeit überschritten und Aufgabe noch offen
  - Empfänger: Zugewiesene primär, Ersteller bei Eskalation cc
  - User-Setting pro Account: E-Mail-Reminder aktivieren/deaktivieren (Default: aktiviert)
- Erledigung: ein-Klick-Abschluss, mit Zeitstempel und „erledigt von" — Aufgaben verschwinden nicht, sondern wandern in einen Filter/Bereich „Erledigt"
- Filter & Ansicht: Meine Aufgaben / Von mir vergeben / Alle; nach Status, Priorität, Fälligkeit, Zugewiesenem; Sortierung nach Fälligkeit/Priorität; Suche über Titel und Beschreibung
- Optional, falls leicht umsetzbar: wiederkehrende Aufgaben (täglich/wöchentlich/monatlich)

## Notizen

Schlanker als Aufgaben — bewusst als zweite Ebene gedacht, nicht als zweite Task-Liste:

- CRUD für Notizen mit Titel und Inhalt (Rich Text oder Markdown), Datei-Anhänge wie bei Aufgaben
- Sichtbarkeits-Checkbox „Für alle sichtbar" beim Anlegen und Bearbeiten:
  - Default: privat (nur Ersteller sieht die Notiz)
  - Aktiviert: alle App-User sehen die Notiz im Tab „Notizen"
  - Sichtbarkeit jederzeit umschaltbar durch den Ersteller
  - Bearbeiten und Erledigen einer öffentlichen Notiz: nur durch den Ersteller (alle anderen lesen)
- Eine Notiz bleibt so lange aktiv, bis sie explizit als erledigt markiert wird — keine Fälligkeit, keine Eskalation, keine Reminder, keine E-Mails
- Erledigte Notizen werden ausgeblendet, bleiben aber in einem „Erledigt"-Filter abrufbar und reaktivierbar
- Filter im Notizen-Tab: Meine / Öffentliche / Alle sichtbaren; Suche über Titel und Inhalt; Sortierung zuletzt geändert / Titel
- Bonus, wenn schnell machbar: eine Notiz lässt sich per Knopfdruck in eine Aufgabe umwandeln (Inhalt + Anhänge übernehmen)

## Technische Hinweise

- **Datenmodell**: separate Entities `Task` und `Note`; `Note` hat ein Feld `visibility: 'private' | 'public'`; Anhänge als wiederverwendbare Attachment-Relation, falls das zum Stack passt
- **Berechtigungen**:
  - Aufgaben sehen Ersteller und Zugewiesene; bearbeiten dürfen beide; löschen nur Ersteller
  - Notizen privat: nur Ersteller. Notizen öffentlich: alle User lesen, nur Ersteller bearbeitet/löscht/erledigt
- **Reminder-Logik** server-seitig (Cron/Scheduled Job), nicht client-seitig — für In-App- und E-Mail-Benachrichtigung
- **E-Mail-Templates** konsistent zum bestehenden Look (falls Templates im Projekt existieren, diese als Vorlage nutzen); Betreff klar, Aufgaben-Titel + Fälligkeit prominent, Direktlink zur Aufgabe
- **UI** konsistent zum bestehenden Look des Calculators; mobil-tauglich (Bedienung primär vom Smartphone)
- **Tests** für die Kern-Flows: Anlegen, Zuweisen, Erledigen, Reminder-Trigger (in-app + E-Mail), Anhang-Upload, Notiz-Sichtbarkeit umschalten

> Frag bei Unklarheiten zur bestehenden Architektur (Auth-Modell, Storage für Anhänge, konkreter E-Mail-Service/Provider, Notification-Patterns) zurück, bevor du Annahmen festschreibst.
