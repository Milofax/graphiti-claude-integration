#PITH:1.2
#MCP:graphiti|stand:2026-01

!!verfügbarkeit:Graphiti-Tools MÜSSEN verfügbar sein
  |prüfen:discover_tools_by_words("graphiti")→0 Treffer=SOFORT ESKALIEREN
  |verstoß:Still weiterarbeiten ohne Graphiti→User merkt zu spät→Session kompromittiert
  |eskalation:"⚠️ Graphiti MCP nicht erreichbar! Kann kein Wissen speichern/abrufen."
  |ursachen:Container down|Traefik kaputt|mcp-funnel Cache stale→Docker restart auf VM

!!erst:Bei Fragen über Personen/Firmen/Projekte→IMMER graphiti__search_nodes() ZUERST
  |verstoß:Raten/Erfinden ohne Recherche→User bekommt falsche Info→Vertrauen zerstört
  |trigger:"wer ist"|"kennst du"|"was weißt du über"|Person/Firma/Projekt erwähnt
  |warnsignal:Antwort ohne search_nodes()=STOP→erst recherchieren

!zuständig:Persönliches Wissen|Kontakte,Firmen,Projekte|Entscheidungen,Präferenzen|Session-übergreifendes Gedächtnis
!nicht_zuständig:Allgemeines Weltwissen|Aktuelle News|Code-Dokumentation(→Context7)
!aktivierung:discover_tools_by_words("graphiti",enable=true)

## tools
add_memory:name+episode_body+source_description?+group_id?→Wissen speichern(Entity-Extraktion automatisch,~30-50s)
search_nodes:query+group_ids?+entity_types?+max_nodes?→Semantische Hybrid-Suche nach Entities
search_memory_facts:query+group_ids?+max_facts?+center_node_uuid?→Suche nach Fakten/Beziehungen(Edges)
get_entity_edge:uuid→Details zu Beziehung
get_episodes:group_ids?+max_episodes?→Alle Episodes abrufen
delete_entity_edge:uuid→Beziehung löschen
delete_episode:uuid→Episode löschen
clear_graph:group_ids?→Graph leeren(⚠️destruktiv,IMMER fragen)
get_status:→Service-Status prüfen

## entity_types(15)
Person|Organization|Location|Event|Project|Requirement|Procedure
Concept|Learning|Document|Topic|Object|Preference|Decision|Goal

## wann_welcher_type
Person:Einzelne Menschen→"Wer ist X?"|"X arbeitet bei Y"|Kontakte,Familie,Kollegen,Klienten
Organization:Gruppen/Firmen→"Firma X"|"Bei Y arbeiten"|Marakanda,Gemeinde,Band,Team
Location:Orte→"Wo ist X?"|"In Y"|Büro,Stadt,Server,Venue
Event:Zeitgebunden→"Wann war X?"|"Meeting am Y"|Termine,Deadlines,Konzerte
Project:Initiativen→"Projekt X"|"Woran arbeite ich?"|Repos,Features,Transformationen
Requirement:MUSS→"X muss Y"|"Anforderung"|Specs,Constraints,Akzeptanzkriterien
Procedure:WIE→"Wie macht man X?"|"Schritt 1, dann 2"|SOPs,Workflows,Anleitungen
Concept:Externes Wissen→"Was ist X?"|Frameworks,Theorien,Muster|OKRs,REST,Microservices
Learning:Persönliche Erkenntnis→"Ich habe gelernt"|"Das hat nicht funktioniert"|Erfahrungen
Document:Quellen→"Aus Buch X"|"Laut Artikel Y"|Bücher,RFCs,Specs,Bibelverse
Topic:Themengebiet→Kategorisierung wenn nichts anderes passt|"Machine Learning","Worship"
Object:Physische Dinge→"Mein X"|Gitarre,FM3,Laufschuhe|Fallback
Preference:Meinung→"Ich mag X"|"Ich bevorzuge Y"|Subjektiv
Decision:Wahl+Warum→"Entscheidung: X weil Y"|Architektur,Business,Persönlich
Goal:Ziele→"Mein Ziel"|"Bis Q2"|OKRs,Gewohnheiten,Targets

## unterscheidung_kritisch
Concept≠Learning:Concept=externes Wissen(OKRs existieren)|Learning=persönliche Erfahrung(OKRs haben bei uns nicht funktioniert)
Decision≠Preference:Decision=getroffen+Begründung|Preference=Meinung ohne Entscheidung
Person≠Organization:Person=Individuum|Organization=Gruppe(auch 2 Personen)
Requirement≠Preference:Requirement=MUSS|Preference=MÖCHTE
Topic≠Concept:Topic=Kategorie/Feld|Concept=konkretes Wissen/Framework

## validierung
!quelle_pflicht:IMMER source_description angeben|Verstoß=add_memory ohne Quelle
!user_aussage:User sagt etwas über sich→wörtlich speichern|source:"User-Aussage"
!recherche:Fakt aus Recherche→mit Quelle speichern|source:"[URL/Buch/Artikel]"
!unsicher:Bei Unsicherheit→ERST fragen:"Soll ich speichern: [Fakt]? Quelle: [X]"|Verstoß=Still speichern
!nie:Annahmen als Fakten|Gerüchte|Unbestätigtes|Allgemeinwissen(gehört nicht in persönliches Wissen)

!!nie_credentials:NIEMALS Passwörter,API-Keys,Tokens,PINs,Kreditkarten speichern
  |verstoß:Credentials in Graphiti→Security-Breach→User kompromittiert→3-Strikes→Session BLOCKIERT
  |gehört_nach:1Password(immer)|Secrets Manager|Environment Variables
  |trigger:add_memory mit "password"|"api_key"|"token"|"secret"|"pin"|"credentials"=STOP
  |warnsignal:User erwähnt Credentials→"Das gehört in 1Password, nicht in Graphiti"

## workflow
speichern:add_memory(name,episode_body,source_description)→automatische Entity-Extraktion
  |vor_speichern:Quelle klar?→JA:speichern|NEIN:User fragen
  |user_kontext:User erzählt→source:"User-Aussage [Datum]"
  |recherche_kontext:Aus Web/Docs→source:"[Quelle mit URL/Referenz]"
abrufen:Frage über Person/Firma/Projekt→search_nodes(query,entity_types)→mit Ergebnis antworten
leer:search gibt nichts→Recherche- und Suchtools nutzen→Ergebnis speichern mit Quelle
  |persönlich:User-spezifisch(Familie,Kontakte)→"Das habe ich nicht gespeichert. Magst du mir erzählen?"
  |allgemein:Recherchierbar→recherchieren→finden→speichern→antworten
  |verstoß:Erfinden/Raten OHNE Recherche

## group_id_trennung(KRITISCH)
!trennung:Persönliches Wissen GETRENNT von Projektwissen|Verstoß=Projektwissen in "main" speichern
!main_only:Kontakte,Learnings,Decisions,Preferences,Goals→group_id:"main"(permanent)
!projekt:Projektdateien,temporäres Wissen→group_id:"project-[name]"(temporär)
!suche_default:Ohne group_ids→sucht nur in "main"|Mit group_ids→sucht in angegebenen

## group_ids
!naming:Name FREI WÄHLBAR|Einzige Ausnahme:"main" ist RESERVIERT für persönliches Wissen
!main_reserviert:"main"=NIEMALS für Projekte verwenden|NIEMALS löschen|Persönlich+Permanent
beispiele_gültig:prp|infrastructure|mein-projekt|bmad-v2|kunde-xyz|2024-redesign
beispiele_ungültig:main(reserviert)

main:Persönliches Wissen(PERMANENT)|Kontakte,Familie,Learnings,Decisions,Preferences,Goals
  |NIEMALS löschen|Überlebt alle Projekte
[frei-wählbar]:Projektwissen(TEMPORÄR)|Projektdateien,Architektur,Requirements,Procedures
  |Name frei wählbar,z.B.:prp,infrastructure,bmad,kunde-abc
  |Löschen erlaubt nach Projektabschluss:clear_graph(group_ids:["dein-name"])

## wann_welche_group
main:User erzählt persönliches|Learning aus Erfahrung|Kontakt/Person|Präferenz|Entscheidung|Ziel
project-[name]:Projektdatei indexiert|Architektur-Doc|Requirement aus PRD|Procedure für Projekt
beide_suchen:Arbeit an Projekt→search(group_ids:["main","project-xyz"])|Persönlich+Projektkontext

## group_workflow
projekt_start:Dateien indexieren mit group_id:"project-[name]"
projekt_arbeit:search(group_ids:["main","project-[name]"])→beides durchsuchen
projekt_ende:ERST Learnings nach "main" promoten→DANN clear_graph(group_ids:["project-[name]"])
übergreifend:Learning aus Projekt→nach "main" speichern(bleibt permanent)

## projekt_erkennung
aus_pfad:Working Directory enthält Projektname→group_id ableiten
  |/Volumes/DATEN/Coding/PRP→project-prp
  |/Volumes/DATEN/Coding/INFRASTRUCTURE→project-infrastructure
aus_claude_md:CLAUDE.md kann graphiti_group_id definieren(wenn vorhanden)
fallback:Unsicher welches Projekt?→User fragen:"Welche group_id soll ich verwenden?"

## vor_projekt_ende(KRITISCH)
!review:VOR clear_graph→Learnings reviewen|"Gibt es übergreifende Erkenntnisse die ich nach main promoten soll?"
!promoten:Relevante Learnings/Decisions→add_memory(...,group_id:"main")→DANN clear_graph
!verlust:Nach clear_graph ist Projektwissen WEG|Nur "main" Wissen überlebt
beispiel:Learning "qwen3:32b ist gut für Entity-Extraktion"→nach main(projektübergreifend relevant)
beispiel:Requirement "API muss /health haben"→NICHT nach main(nur für dieses Projekt)

## params
add_memory:name(required)|episode_body(required)|source_description(empfohlen)|group_id(default:"main")|source:"text"|"json"|"message"
search_nodes:query(required)|group_ids(filter,array,default:["main"])|entity_types(filter,array)|max_nodes(default:10)
search_memory_facts:query(required)|group_ids(filter,array)|max_facts(default:10)|center_node_uuid(optional)

## eingabe_muster
person:"[Name] ist [Rolle] bei [Org]"
concept:"[Begriff] ist [Definition/Framework]"
learning:"Ich habe gelernt: [Erkenntnis]"
decision:"Entscheidung: [Was] weil [Warum]"
goal:"Mein Ziel: [Ziel] bis [Zeitraum]"
document:"Das Konzept [X] stammt aus [Buch/Artikel] von [Autor]"

## infrastruktur
host:Ubuntu VM(192.168.1.10)|ollama:AI-PC(192.168.1.12)
mcp_endpoint:https://graphiti.marakanda.biz/mcp
graph_ui:http://192.168.1.10:3001(FalkorDB Browser,nur lokal)
backup:Docker Volume auf Ubuntu VM

## performance
verarbeitung:~30-50s pro Episode(qwen3:32b auf RTX 5090)
suche:<1s|queue:Episodes werden sequentiell pro group_id verarbeitet

## fehler
nicht_gefunden→breiteren Begriff verwenden|entity_types Filter entfernen
ollama_offline→AI-PC Ollama Service prüfen(192.168.1.12:11434)
timeout→normal für add_memory(30-50s)|bei >60s→Logs prüfen
connection→Docker Container auf Ubuntu VM prüfen
