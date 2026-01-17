#PITH:1.2
#MCP:graphiti|stand:2026-01

!!verfügbarkeit:Graphiti-Tools MÜSSEN verfügbar sein
  |prüfen:discover_tools_by_words("graphiti")→0 Treffer=SOFORT ESKALIEREN
  |verstoß:Still weiterarbeiten ohne Graphiti→User merkt zu spät→Session kompromittiert
  |eskalation:"⚠️ Graphiti MCP nicht erreichbar! Kann kein Wissen speichern/abrufen."

!!erst:Bei Fragen über gespeichertes Wissen→IMMER graphiti__search_nodes() ZUERST
  |verstoß:Raten/Erfinden ohne Recherche→User bekommt falsche Info→Vertrauen zerstört
  |trigger:"wer"|"was weißt du"|"kennst du"|"habe ich"|"was ist mein"|"wie mache ich"|"was muss ich"
  |entity_types:Person|Organization|Location|Event|Project|Requirement|Procedure|Concept
               |Learning|Document|Topic|Object|Preference|Decision|Goal|Task|Work
  |warnsignal:Antwort ohne search_nodes()=STOP→erst recherchieren
  |ausnahme:Allgemeines Weltwissen(nicht persönlich)→Web/Docs nutzen

!zuständig:Langfristiges Wissen|Kontakte,Learnings,Decisions|Kontextspezifisches Wissen|Session-übergreifendes Gedächtnis
!nicht_zuständig:Allgemeines Weltwissen|Aktuelle News|Code-Dokumentation(→Context7)|Flüchtiges/Temporäres
!aktivierung:discover_tools_by_words("graphiti",enable=true)

## tools
add_memory:name+episode_body+source_description?+group_id?→Wissen speichern(Entity-Extraktion automatisch)
search_nodes:query+group_ids?+entity_types?+max_nodes?→Semantische Hybrid-Suche nach Entities
search_memory_facts:query+group_ids?+max_facts?+center_node_uuid?→Suche nach Fakten/Beziehungen(Edges)
get_entity_edge:uuid→Details zu Beziehung
get_episodes:group_ids?+max_episodes?→Alle Episodes abrufen
delete_entity_edge:uuid→Beziehung löschen
delete_episode:uuid→Episode löschen
clear_graph:group_ids?→Graph leeren(⚠️destruktiv,IMMER fragen)
get_status:→Service-Status prüfen

## entity_types(17)
Person|Organization|Location|Event|Project|Requirement|Procedure|Concept
Learning|Document|Topic|Object|Preference|Decision|Goal|Task|Work

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
Task:Zu erledigen→"Ich muss X"|"Todo"|"Aufgabe"|Assignments,Action Items,Reminders
Work:Kreatives Werk→"Song X"|"Album Y"|"Film Z"|"Buch Y"|Songs,Alben,Filme,Romane,Gemälde

## unterscheidung_kritisch
Concept≠Learning:Concept=externes Wissen(OKRs existieren)|Learning=persönliche Erfahrung(OKRs haben bei uns nicht funktioniert)
Decision≠Preference:Decision=getroffen+Begründung|Preference=Meinung ohne Entscheidung
Person≠Organization:Person=Individuum|Organization=Gruppe(auch 2 Personen)
Requirement≠Preference:Requirement=MUSS|Preference=MÖCHTE
Topic≠Concept:Topic=Kategorie/Feld|Concept=konkretes Wissen/Framework
Task≠Goal:Task=konkrete Aufgabe(zu tun)|Goal=Ergebnis(zu erreichen)
Task≠Requirement:Task=Action Item(ich tue)|Requirement=Constraint(muss erfüllt sein)
Task[persönlich]≠Task[projekt]:Task[persönlich]=eigene Todos("einkaufen")→main|Task[projekt]=Projekt-Aufgabe("Tests fixen")→project-*
Work≠Document:Work=Werk das ich erlebe/spiele(Song,Roman)|Document=Quelle die ich zitiere(RFC,Fachbuch)
Work≠Document≠Concept(Bücher):Work=Buch lesen("Ich lese X")|Document=Buch zitieren("Laut X...")|Concept=Ideen anwenden("X-Prinzipien")

## ambiguität
!werk_mit_meinung:"[Werk] ist gut/schlecht"→BEIDE speichern
  |work:"[Titel] von [Künstler]"
  |preference:"User findet [Titel] gut/schlecht"
  |beispiel:"Clean Code ist gut"→Work(Buch)+Preference(User-Meinung)
!typ_unklar:Bei Ambiguität→User fragen
  |beispiel:"Meinst du das Buch 'Clean Code' (Work) oder das Konzept Clean Code (Concept)?"

## validierung
!!quelle_pflicht:IMMER source_description angeben
  |warnsignal:add_memory geplant ohne Quelle→STOP
  |verstoß:Speichern ohne Quelle→Wissen kontaminiert→Vertrauen zerstört
  |aktion:Quelle recherchieren|User fragen|DANN speichern
!user_aussage:User sagt etwas über sich→wörtlich speichern|source:"User-Aussage"
!recherche:Fakt aus Recherche→mit Quelle speichern|source:"[URL/Buch/Artikel]"
!!unsicher:Bei Unsicherheit→ERST fragen:"Soll ich speichern: [Fakt]? Quelle: [X]?"
  |verstoß:Still speichern ohne Bestätigung→falsches Wissen→Vertrauen zerstört
!nie:Annahmen als Fakten|Gerüchte|Unbestätigtes|Allgemeinwissen(gehört nicht in persönliches Wissen)

!!nie_credentials:NIEMALS Passwörter,API-Keys,Tokens,PINs,Kreditkarten speichern
  |verstoß:Credentials in Graphiti→Security-Breach→User kompromittiert→3-Strikes→Session BLOCKIERT
  |gehört_nach:1Password(immer)|Secrets Manager|Environment Variables
  |trigger:add_memory mit "password"|"api_key"|"token"|"secret"|"pin"|"credentials"=STOP
  |warnsignal:User erwähnt Credentials→"Das gehört in 1Password, nicht in Graphiti"

## workflow
!!vor_add_memory:group_id ENTSCHEIDEN bevor add_memory aufgerufen wird
  |hook_zeigt:Hook zeigt aktuellen Kontext→VERWENDEN(project-*)
  |procedure:FAST IMMER projekt-spezifisch→project-*
  |requirement:FAST IMMER projekt-spezifisch→project-*
  |learning:Allgemeingültig?→JA:main|NEIN:project-*
  |decision:Übertragbar auf andere Projekte?→JA:main|NEIN:project-*
  |warnsignal:add_memory ohne group_id-Überlegung=STOP
  |verstoß:Falsches group_id→Kontamination→manuelles Cleanup nötig
speichern:add_memory(name,episode_body,source_description,group_id)→automatische Entity-Extraktion
  |vor_speichern:1.group_id entschieden?→2.Quelle klar?→JA:speichern|NEIN:User fragen
  |user_kontext:User erzählt→source:"User-Aussage [Datum]"
  |recherche_kontext:Aus Web/Docs→source:"[Quelle mit URL/Referenz]"
abrufen:Frage über Person/Firma/Projekt→search_nodes(query,entity_types)→mit Ergebnis antworten
leer:search gibt nichts→Recherche- und Suchtools nutzen→Ergebnis speichern mit Quelle
  |persönlich:User-spezifisch(Familie,Kontakte)→"Das habe ich nicht gespeichert. Magst du mir erzählen?"
  |allgemein:Recherchierbar→recherchieren→finden→speichern→antworten
  |verstoß:Erfinden/Raten OHNE Recherche

## group_id_trennung
!!trennung:Langfristiges Wissen GETRENNT von kontextgebundenem Wissen
  |prinzip:main=überlebt alles|project-*=löschbar nach Kontext-Ende
  |verstoß:Temporäres Wissen in "main"→Kontamination→main aufgebläht→nicht mehr wartbar
  |trigger:add_memory→IMMER fragen:"Ist das langfristig relevant oder nur hier?"
  |warnsignal:"Ich speichere..." ohne group_id-Überlegung=STOP
  |recovery:search_nodes(group_ids:["main"])→identifizieren→delete_episode
!main:Langfristiges,allgemeingültiges Wissen→group_id:"main"(PERMANENT)
  |bleibt_relevant:Kontakte|Learnings|Decisions|Preferences|Goals|Concepts|Documents|Works
  |beispiel:Learning "GraphQL ist für kleine Teams overkill"→main(gilt immer)
  |beispiel:Decision "FalkorDB statt Neo4j wegen Einfachheit"→main(Erfahrungswert)
!kontext:Kontextgebundenes,begrenztes Wissen→group_id:"project-[name]"(TEMPORÄR)
  |nur_hier_relevant:Requirements|Procedures|Architektur-Details|Projekt-Tasks
  |beispiel:Requirement "API braucht /health endpoint"→project-*(nur dieses Projekt)
  |beispiel:Procedure "Deploy via git push + docker compose"→project-*(nur dieses Repo)
!suche_default:Ohne group_ids→sucht nur in "main"|Mit group_ids→sucht in angegebenen

## group_ids
!naming:Name FREI WÄHLBAR|Einzige Ausnahme:"main" ist RESERVIERT
!main_reserviert:"main"=NIEMALS für Projekte|NIEMALS löschen|Langfristig+Permanent
beispiele_gültig:prp|infrastructure|bmad-v2|kunde-xyz|2024-redesign
beispiele_ungültig:main(reserviert)

main:Langfristiges Wissen(PERMANENT)|Kontakte,Learnings,Decisions,Preferences,Goals,Concepts,Documents,Works
  |NIEMALS löschen|Überlebt alle Kontexte
  |frage:"Werde ich das in 5 Jahren noch wissen wollen?"→JA=main
[frei-wählbar]:Kontextgebundenes Wissen(TEMPORÄR)|Requirements,Procedures,Architektur,Projekt-Tasks
  |Name frei wählbar,z.B.:prp,infrastructure,kunde-abc
  |Löschen erlaubt nach Kontext-Ende:clear_graph(group_ids:["dein-name"])
  |frage:"Ist das nur für diesen Kontext relevant?"→JA=project-*

## wann_welche_group
main:Learning(allgemeingültig)|Decision(übertragbar)|Kontakt|Präferenz|Ziel|Concept|Document|Work
project-*:Requirement(projektspezifisch)|Procedure(kontextspezifisch)|Architektur-Detail|Projekt-Task
beide_suchen:Arbeit in Kontext→search(group_ids:["main","project-xyz"])|Langfristig+Kontext

## group_workflow
kontext_start:Dateien indexieren mit group_id:"project-[name]"
kontext_arbeit:search(group_ids:["main","project-[name]"])→beides durchsuchen
kontext_ende:ERST langfristiges Wissen nach "main" promoten→DANN clear_graph(group_ids:["project-[name]"])
übertragbar:Learning/Decision aus Kontext→nach "main" speichern(bleibt permanent)

## kontext_erkennung
aus_pfad:Working Directory→group_id ableiten
  |/Volumes/DATEN/Coding/PRP→project-prp
  |/Volumes/DATEN/Coding/INFRASTRUCTURE→project-infrastructure
aus_claude_md:CLAUDE.md kann graphiti_group_id definieren(wenn vorhanden)
fallback:Unsicher welcher Kontext?→User fragen:"Welche group_id soll ich verwenden?"

## vor_kontext_ende
!!review:VOR clear_graph→IMMER langfristig relevantes Wissen reviewen
  |verstoß:clear_graph ohne Review→übertragbares Wissen verloren→irreversibel
  |aktion:search_nodes(entity_types:["Learning","Decision","Concept"])→promoten→DANN clear_graph
  |frage:"Gibt es allgemeingültige Erkenntnisse die ich nach main promoten soll?"
!!promoten:Übertragbare Learnings/Decisions/Concepts→add_memory(...,group_id:"main")→DANN clear_graph
  |verstoß:Wertvolles Wissen nicht promotet→nach clear_graph verloren
!verlust:Nach clear_graph ist Kontext-Wissen WEG|Nur "main" Wissen überlebt
beispiel:Learning "Claude Opus 4.5 über CLIProxyAPI funktioniert gut"→nach main(allgemeingültig)
beispiel:Requirement "API muss /health haben"→NICHT nach main(nur für diesen Kontext)

## params
add_memory:name(required)|episode_body(required)|source_description(required)|group_id(default:"main")|source:"text"|"json"|"message"
search_nodes:query(required)|group_ids(filter,array,default:["main"])|entity_types(filter,array)|max_nodes(default:10)
search_memory_facts:query(required)|group_ids(filter,array)|max_facts(default:10)|center_node_uuid(optional)

## eingabe_muster
person:"[Name] ist [Rolle] bei [Org]"
concept:"[Begriff] ist [Definition/Framework]"
learning:"Ich habe gelernt: [Erkenntnis]"|kann positiv ODER negativ sein
decision:"Entscheidung: [Was] weil [Warum]"
goal:"Mein Ziel: [Ziel] bis [Zeitraum]"
task:"Ich muss [Aufgabe]"|"Todo: [Action Item]"
document:"Quelle: [Titel] von [Autor] ([Jahr])"
work:"[Titel] von [Autor/Künstler]"|"Song/Album/Film/Buch"

## pflichtattribute_zitierbar
!!fehlende_attribute:Pflichtattribute unbekannt→ERST recherchieren→DANN User fragen
  |verstoß:Raten/Unvollständig speichern→Quelle nicht zitierbar→Wissen wertlos
document:
  !buch:Autor+Titel+Jahr+ISBN|empfohlen:Verlag,Auflage
  !artikel:Autor+Titel+Quelle+Jahr|empfohlen:Volume,Seiten
  !web:URL+Zugriffsdatum|empfohlen:Autor/Organisation
  !spec:Nummer+Jahr|empfohlen:Organisation
  !bibelvers:Buch+Kapitel:Vers|beispiel:"Johannes 3:16"
work:
  !musikstück:Titel+Künstler/Komponist|empfohlen:Album,Jahr
  !album:Titel+Künstler+Jahr|empfohlen:Label
  !film:Titel+Regisseur+Jahr|empfohlen:Studio
  !roman:Titel+Autor+Jahr|empfohlen:Verlag
  !gemälde:Titel+Künstler|empfohlen:Jahr,Museum
  !podcast:Titel+Host|empfohlen:Episode,Jahr

## suchtipps
nicht_gefunden→breiteren Begriff verwenden|entity_types Filter entfernen|andere group_ids probieren
