# FitStart – Trainings-App fürs Handy

Persönlicher Trainingsbegleiter für zu Hause, gebaut als Web-App (PWA).
Sie läuft auf dem Android-Handy wie eine normale App, auch offline, ohne App Store und ohne Konto.
Alle Daten bleiben auf dem Handy.

## Was die App kann

- **Einsteigerprogramm** mit vier Trainingstagen im Wechsel:
  - A: Kraft, Ganzkörper
  - B: Kondition, Zirkel
  - C: Kraft, Ganzkörper
  - D: Power-Zirkel

  Die App merkt sich, welcher Tag als Nächstes dran ist.
- **Extra-Trainings:** Bauch & Rumpf (10 Min.), Beweglichkeit, Morgen-Wachmacher, Kurz & knackig, Arme & Schultern.
- **Überrasch mich:** ein zufällig zusammengestelltes Training mit 10, 20 oder 30 Minuten.
- **Eigene Pläne** anlegen, bearbeiten und kopieren.
- **91 Übungen** mit Schritt-für-Schritt-Anleitung, Tipps und Vorlesefunktion.
  Sie sind gefiltert nach der Ausrüstung (5-kg-Hanteln, Matte, Stuhl, Laufband, Ergometer usw.) und nach Rücksichten:
  - Handgelenke schonen: Liegestütze nur auf den Fäusten, Stütz nur auf den Unterarmen.
  - Optional „keine Sprünge“.
- **Erst erklären, dann loslegen:** Bei neuen Übungen zeigt die App die Anleitung groß an und liest sie vor.
  Der Countdown startet erst nach „Bereit“. Ab dem 3. Mal kommt eine kurze Ansage mit automatischem Start,
  ab dem 6. Mal nur noch der Name. In den Einstellungen lässt sich „immer ausführlich“ wählen.
- **Freihändig trainieren:**
  - Automatik: Jeder Satz läuft im Takt (einstellbar, Standard 3 Sek. pro Wiederholung) und wird mitgezählt.
    Danach startet die Pause von selbst. Am Ende lassen sich die Zahlen kurz korrigieren.
  - Ein Tipp irgendwo auf den Bildschirm heißt „Bereit“ bzw. „Satz fertig“.
- **Krafttraining Satz für Satz:**
  - Ziel aus dem letzten Mal (+1 Wiederholung), Pausentimer und Halte-Timer.
  - Vorschlag für die schwerere Variante, sobald alle Ziele erreicht sind.
- **Zeittraining:** Übung und Pause im Takt, mit Ton, Vibration, Sprachansage und Hinweis zum Seitenwechsel.
- **Ausdauer an Geräten:**
  - Vier geführte Programme mit je 4 Stufen: Laufband Gehen & Joggen, Laufband bergauf, Ergometer Intervalle, Ergometer gleichmäßig.
  - Die Belastung wird als „Anstrengung x von 10“ angesagt, weil jedes Gerät anders ist.
  - Nach zwei geschafften Einheiten geht es automatisch eine Stufe weiter.
  - Am Ende lassen sich km und kcal vom Display eintragen.
  - Freie Einheiten (auch Spaziergang, Radfahren, Schwimmen) lassen sich nachträglich eintragen.
- **Aufwärmen und Dehnen** automatisch dabei, das Aufwärmen wahlweise auf Laufband oder Ergometer. Beides lässt sich abschalten.
- **Zurück-Taste wie in einer App:** Sie schließt erst offene Fenster und geht dann eine Ebene zurück, von Tabs zu „Heute“.
  Im Training fragt sie, ob du unterbrechen willst.
- **Fitness-Stufe** (Einsteiger, etwas Erfahrung, fortgeschritten): Davon hängen Startziele, Varianten, Intervalle und die Ausdauer-Stufe ab.
- **Datensicherung:** alle Daten als Datei sichern (z. B. in Google Drive) und wieder einspielen.
- **Motivation:** Punkte & Level, 35 Abzeichen, Wochenziel mit Serie, Tages-Challenge, Konfetti.
- **Fortschritt:**
  - Trainings pro Woche und Kalender.
  - Volumen: Minuten, Wiederholungen, kg.
  - Kraft pro Übung: bester Satz, Gesamt, geschätzte Maximalkraft.
  - Verlauf.

## Auf das Handy bringen

Für die Installation und den Offline-Betrieb muss die App über **HTTPS** erreichbar sein.
Der einfachste kostenlose Weg ist **GitHub Pages**:

1. Diesen Ordner in ein GitHub-Repository hochladen.
2. Im Repository unter *Settings → Pages* als Quelle den Branch `main`, Ordner `/ (root)` wählen.
3. Die angezeigte Adresse (z. B. `https://<name>.github.io/<repo>/`) am Handy in **Chrome** öffnen.
4. Auf „App installieren“ tippen. Der Knopf erscheint auf der Startseite; alternativ geht es über das Chrome-Menü ⋮ → *App installieren*.

**Nur zum Ausprobieren im WLAN** (ohne Installation und Offline-Betrieb):

```bash
node tools/server.mjs --lan
```

Danach die angezeigte `http://192.168…:5173`-Adresse am Handy öffnen.
Windows fragt beim ersten Mal eventuell nach einer Firewall-Freigabe.

## Mehrere Personen

Jede Person installiert die App auf dem eigenen Handy über denselben Link.
Beim ersten Start wählt jede Person ihre eigene Fitness-Stufe, Ausrüstung, Rücksichten und ihr Wochenziel.
Die Daten bleiben automatisch getrennt, weil sie nur auf dem jeweiligen Handy gespeichert werden.

## Am PC testen

```bash
node tools/server.mjs
```

Dann <http://localhost:5173> öffnen. Am besten mit den Entwicklertools in der Handy-Ansicht.

## Änderungen veröffentlichen

Nach Änderungen an Dateien in `sw.js` die Zeile `const VERSION = 'fitstart-v1'` hochzählen (`v2`, `v3` …).
Nur dann laden installierte Apps die neue Version.
Neue Dateien müssen außerdem in der Liste `FILES` in `sw.js` stehen.

## Aufbau

| Datei | Inhalt |
|---|---|
| `js/exercises.js` | Übungsbibliothek mit Anleitungen |
| `js/plans.js` | Programm, Extra-Trainings, Zufallsgenerator, Filter |
| `js/session.js` | Training starten, Ziele berechnen, abschließen |
| `js/gamification.js` | Punkte, Level, Abzeichen, Challenges, Sprüche |
| `js/stats.js` | Auswertungen (Wochen, Serie, Bestleistungen) |
| `js/charts.js` | Diagramme (SVG) |
| `js/nav.js` | Navigation und Zurück-Taste (Verlauf, Fenster, Tabs, Training) |
| `js/views/*` | Bildschirme der App |
| `tools/make-icons.mjs` | erzeugt die App-Icons neu |

## Hinweis

Die App ersetzt keine ärztliche oder physiotherapeutische Beratung.
Bei Schmerzen die Übung abbrechen. Bei Beschwerden vorher abklären, welche Belastung passt.
