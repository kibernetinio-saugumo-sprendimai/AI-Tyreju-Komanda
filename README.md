# Technologijų ir kodo tyrėjų komanda

Keturių narių komanda technologijų ir kodo analizei: trys tyrėjai ir koordinatorius. Šiame kataloge yra darbo taisyklės, užduoties šablonas ir vietinis MCP serveris, skirtas VS Code. [MCP serverio paleidimas ir naudojimas](MCP_SERVER.md).

## Nariai

| Narys | Agento vardas šiame pokalbyje | Atsakomybė |
| --- | --- | --- |
| Architektūros tyrėjas | `architekturos_tyrejas` | Sistemos struktūra, priklausomybės, duomenų srautai ir integracijos. |
| Kodo kokybės tyrėjas | `kodo_kokybes_tyrejas` | Logikos klaidos, ribiniai atvejai ir testavimo spragos. |
| Technologijų tyrėjas | `technologiju_tyrejas` | Oficiali dokumentacija, versijų suderinamumas ir alternatyvos. |
| Koordinatorius ir vertintojas | Pagrindinis asistentas | Tyrimo ribos, užduočių paskirstymas, įrodymų patikra ir bendra ataskaita. |

Tyrėjų instrukcijos pateiktos [VAIDMENYS.md](VAIDMENYS.md). Pokalbyje komanda naudoja atskirus agentus. MCP serveris tuos pačius vaidmenis vykdo per tris specializuotas VS Code modelio užklausas ir ketvirtą koordinatoriaus užklausą; ankstesnio pokalbio agentų pasiekiamumas nereikalingas. MCP modelių kontekstams VS Code klientas turi perduoti jau surinktus įrodymus, nes serveris pats projekto neskaito ir interneto nenaršo.

## Užduoties pateikimas

Pakanka čia parašyti tyrimo klausimą ir pateikti saugyklos kelią, kodo fragmentą arba technologiją. Papildomus apribojimus galima nurodyti pagal [UZDUOTIS.md](UZDUOTIS.md). Šablono pildyti neprivaloma.

Pavyzdys: „Ištirk projektą `/kelias/iki/projekto`: surask svarbiausias patikimumo problemas ir įvertink naudojamų bibliotekų suderinamumą. Kodo nekeisk.“

## Koordinatoriaus darbo eiga

1. Perskaityk užduotį ir taikomas saugyklos instrukcijas. Patikrink prieinamus failus, versijas ir kontekstą prieš prašydamas vartotojo informacijos, kurią galima rasti savarankiškai.
2. Apibrėžk tikslą, analizės ribas ir baigties kriterijus. Jei esminės informacijos trūksta, užduok vieną konkretų klausimą ir tęsk nuo atsakymo nepriklausantį darbą.
3. Kiekvienam tyrėjui perduok konkrečią, apribotą užduotį, bendrą kontekstą, prieinamus šaltinius, apribojimus ir laukiamą išvadų formatą. Tyrėjai dirba lygiagrečiai, koordinatorius tikrina bendrą kontekstą. Jei sričiai nėra medžiagos, pažymėk ją kaip netaikomą ir neskirk dirbtinės užduoties.
4. Surink išvadas, pašalink pasikartojimus ir patikrink svarbiausius teiginius pagal nurodytus įrodymus. Prieštaravimus spręsk papildoma kryptinga patikra; jei jų išspręsti nepavyksta, ataskaitoje išlaikyk neapibrėžtumą.
5. Pateik vieną bendrą ataskaitą su radiniais, jų poveikiu, rekomenduojamais veiksmais, atliktomis patikromis ir likusiais neaiškumais.

## Įrodymų ir darbo taisyklės

- Pagal nutylėjimą atliekama analizė. Kodo keitimas yra atskira vartotojo užduotis.
- Kiekvienas reikšmingas radinys turi nurodyti konkretų failą ir eilutę arba pirminio šaltinio nuorodą. Ataskaitoje naudok paspaudžiamas nuorodas.
- Faktus, iš šaltinių daromas išvadas ir nepatikrintas hipotezes aiškiai atskirk. Agentų sutarimas nepakeičia įrodymų.
- Versijų suderinamumą ir kitus kintančius technologinius teiginius tikrink pagal aktualią oficialią dokumentaciją; nurodyk vertintas versijas ir patikros datą.
- Testus ar kitas patikras rinkis tik konkrečiai išvadai patikrinti. Atsižvelk į jų šalutinį poveikį. Aiškiai nurodyk, kas vykdyta, kas tik perskaityta ir kas liko nepatikrinta.
- Jei nėra prieigos prie kodo, dokumentacijos ar vykdymo aplinkos, nurodyk apribojimą ir tęsk prieinamą analizę; neišgalvok rezultatų.
- Neatskleisk aptiktų paslapčių, prieigos raktų ar nesusijusių privačių duomenų.

## Bendros ataskaitos formatas

1. **Santrauka:** atsakymas į tyrimo klausimą ir svarbiausia rekomendacija.
2. **Radiniai:** problema arba pastebėjimas, įrodymas, faktas ar hipotezė, poveikis ir siūlomas veiksmas. Rikiuok pagal praktinį poveikį.
3. **Patikra:** atliktos patikros ir rezultatai; nevykdytų reikalingų patikrų priežastys.
4. **Neaiškumai ir aprėptis:** ištirtos sritys, apribojimai ir klausimai, kuriems dar trūksta įrodymų.

Tyrimas baigtas, kai atsakyta į sutartą klausimą, reikšmingi radiniai pagrįsti ir aiškiai įvardytos išvadų ribos. Jei pagrįstų problemų nerasta, taip ir parašyk.

## Repo agentai

Repositoryje pateikti keturi VS Code Custom Agents kataloge `.github/agents/`:

- `architecture` — sistemos struktūra, priklausomybės ir integracijos.
- `code-quality` — logikos klaidos, ribiniai atvejai ir testavimo spragos.
- `technology` — oficiali dokumentacija, versijos ir suderinamumas.
- `coordinator` — užduoties ribos, specialistų išvadų sujungimas ir įrodymų patikra.

Bendros taisyklės yra `.github/copilot-instructions.md`, o repositoryje dalijamas MCP serverio aprašas — `.vscode/mcp.json`. Prieš naudojant MCP įrankius įdiek priklausomybes su `npm install`; projektui reikia Node.js `>=22`. Serverį galima paleisti su `npm start` arba pasirinkti MCP serverį VS Code įrankių sąraše.

Šis eksportas keičia tik repository failus. Jis neįrašo MCP į vartotojo VS Code profilį, nepublikuoja pakeitimų į GitHub ir nesukuria Git commit.

## Markdown failai

| Failas | Paskirtis |
| --- | --- |
| [README.md](README.md) | Projekto paskirtis, tyrėjų komandos darbo eiga, agentų naudojimas ir pagrindinės taisyklės. |
| [MCP_SERVER.md](MCP_SERVER.md) | Vietinio MCP serverio diegimas, VS Code konfigūracija, įrankiai, resursai, apribojimai ir trikčių diagnostika. |
| [UZDUOTIS.md](UZDUOTIS.md) | Tyrimo užduoties šablonas: klausimas, objektas, kontekstas, apribojimai ir baigties kriterijus. |
| [VAIDMENYS.md](VAIDMENYS.md) | Trijų specialistų vaidmenų instrukcijos: architektūros, kodo kokybės ir technologijų tyrimai. |
| [.github/copilot-instructions.md](.github/copilot-instructions.md) | Bendros repository Copilot instrukcijos: kalba, įrodymų taisyklės, read-only režimas ir delegavimas. |
| [.github/agents/architecture.agent.md](.github/agents/architecture.agent.md) | Architektūros agento atsakomybės, darbo eiga ir atsakymo formatas. |
| [.github/agents/code-quality.agent.md](.github/agents/code-quality.agent.md) | Kodo kokybės agento atsakomybės, patikros ir radinių formatas. |
| [.github/agents/technology.agent.md](.github/agents/technology.agent.md) | Technologijų agento versijų, oficialių šaltinių ir alternatyvų vertinimo taisyklės. |
| [.github/agents/coordinator.agent.md](.github/agents/coordinator.agent.md) | Koordinatoriaus darbo eiga, įrodymų patikra ir bendros ataskaitos formatas. |
