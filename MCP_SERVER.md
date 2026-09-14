# Vietinis MCP serveris VS Code

Serveris `tyreju-komanda` paleidžiamas vietiniame kompiuteryje per `stdio`. VS Code valdo procesą ir ryšį; HTTP adresas, atviras prievadas ar nuolat veikianti tarnyba nereikalingi.

Viena tyrimo užklausa vykdo tris atskiras specializuotas modelio užklausas lygiagrečiai, tada ketvirtą – koordinatoriaus išvadoms. Tai šios MCP programos sukurti modelio kontekstai; jie nesijungia prie ankstesniame pokalbyje sukurtų agentų.

## Pradžia šiame kompiuteryje

1. Atidaryk norimą projektą **Visual Studio Code**.
2. Paspausk **Cmd+Shift+P → MCP: List Servers → tyreju-komanda → Start**. Jei VS Code parodo pasitikėjimo serveriu langą, peržiūrėk ir patvirtink jį.
3. Atidaryk vietinį **Chat → Agent** režimą. Jei AI funkcijos dar neaktyvios, įjunk jas ir prisijunk per VS Code. Šiame kompiuteryje esanti VS Code 1.135 versija turi integruotą Copilot Chat.
4. Per **Configure Tools** įjunk `tyreju-komanda` įrankius. Per **MCP: List Servers → tyreju-komanda → Configure Model Access** suteik serveriui prieigą prie savo turimų modelių; VS Code gali to paprašyti pirmos tyrimo užklausos metu.
5. Pateik užduotį, pavyzdžiui:

> Naudok tyreju-komanda MCP serverį. Perskaityk šio projekto pagrindinį modulį ir jo testus, perduok aktualius fragmentus research_team ir įvertink patikimumo problemas. Kodo nekeisk.

MCP promptų meniu taip pat yra `tyrimas`, kuris padeda surinkti įrodymus ir iškviesti komandą.

Serveriui nereikia atskiro API rakto. Modelius, jų prieigos leidimus ir naudojimo limitus valdo VS Code. Vietinis serveris savaime nereiškia vietinio modelio: pateikta tyrimo medžiaga siunčiama tam modelio tiekėjui, kurį leidai naudoti VS Code. Konkretų sampling modelį parenka klientas iš serveriui leistinų modelių; jis gali skirtis nuo pokalbio modelio.

## Diegimas ir konfigūracija

Reikia Node.js 22 ar naujesnio ir VS Code su MCP palaikymu. Šiame kompiuteryje patikrinta Node.js 26.8.2 ir VS Code 1.135.0.

```sh
cd /Users/safestack/tyreju-komanda
npm ci --ignore-scripts
npm run vscode:install
```

Diegimo komanda per oficialų VS Code `--add-mcp` įrašo serverį į vartotojo profilį. Naudojami absoliutūs Node ir serverio keliai, todėl paleidimas nepriklauso nuo VS Code terminalo PATH ar atidaryto projekto. Kitų serverių konfigūraciją sujungia VS Code. Perkėlus projektą ar pašalinus naudojamą Node vykdomąjį failą, pakartok `npm run vscode:install`.

Numatytojo macOS profilio konfigūracija:

`~/Library/Application Support/Code/User/mcp.json`

Jei nori konfigūraciją laikyti tik šiame projekte, [vscode-mcp.example.json](vscode-mcp.example.json) nukopijuok į `.vscode/mcp.json`. Pavyzdyje prireikus `node` pakeisk absoliučiu vykdomojo failo keliu. Vartotojo profilio ir projekto konfigūracijų kartu naudoti nereikia. Skirtingi VS Code profiliai turi atskiras konfigūracijas.

Tiesioginis `npm start` paleidžia MCP protokolo procesą, kuris laukia kliento pranešimų standartinėje įvestyje. Terminale jis nerodo interneto adreso. Darbui naudok VS Code; stabdymas – **MCP: List Servers → Stop**.

## MCP sąsaja

| Sąsaja | Paskirtis | Modelis |
| --- | --- | --- |
| Tool `list_researchers` | Keturi vaidmenys ir kliento sampling galimybė. | Nereikia |
| Tool `prepare_research` | Užduočių paskirstymas pagal vaidmenis. Tai paruošimas, ne atliktas tyrimas. | Nereikia |
| Tool `research_team` | Trijų specialistų analizė ir koordinatoriaus ataskaita. | Reikia sampling |
| Prompt `tyrimas` | Instrukcija VS Code agentui surinkti įrodymus ir paleisti komandą. Argumentas `question`. | Vykdymui reikia |
| Resource `team://guide` | Komandos darbo taisyklės. | Nereikia |
| Resource `team://roles` | Tyrėjų instrukcijos. | Nereikia |
| Resource `team://task-template` | Tyrimo užduoties šablonas. | Nereikia |

`prepare_research` ir `research_team` naudoja bendrą įvesties formatą:

```json
{
  "question": "Ar ši funkcija tinkamai apdoroja tuščią masyvą?",
  "evidence": [
    {
      "source": "src/average.js",
      "startLine": 1,
      "content": "export const average = xs => xs.reduce((a, b) => a + b, 0) / xs.length;"
    }
  ],
  "constraints": "Atsakyk lietuviškai. Kodo nekeisk."
}
```

`question` privalomas. `constraints` ir `startLine` neprivalomi. Tyrimui reikia bent vieno įrodymo, planavimui jų galima nepateikti. Ribos: klausimas ir apribojimai po 4000 simbolių, iki 20 įrodymų, kiekvieno tekstas iki 60000 simbolių, bendras įrodymų tekstas iki 80000 simbolių.

`source` yra tik citavimo žyma. Serveris neatveria nurodytų failų ar URL. VS Code agentas turi savo įrankiais perskaityti aktualų kodą, dokumentaciją ar testų rezultatus ir perduoti `content`. Modelių užklausos neturi naršymo ar failų įrankių. Jei šaltinių ar versijų nepakanka, ataskaita turi aiškiai tai pažymėti.

Rezultatas pateikiamas kaip tekstinis JSON ir `structuredContent`: `status`, `question`, `report`, `specialists`, `coordinator` ir `limitations`. Kai nė vienas specialistas neatsako, koordinatorius nekviečiamas, todėl `coordinator` nėra.

- `complete`: visi keturi modelio atsakymai gauti pilnai. Tai negarantuoja, kad kiekviena modelio išvada teisinga; ją reikia vertinti pagal įrodymus.
- `partial`: dalis užklausų nepavyko arba atsakymas sutrumpintas; grąžinami turimi rezultatai ir apribojimai. Jei sintezė nepavyksta, išsaugomos specialistų ataskaitos.
- `failed` su `isError: true`: nėra sampling palaikymo, visi specialistai nesėkmingi arba įvyko kita tyrimą sustabdžiusi klaida.

Vienu metu šiame serverio procese vyksta vienas tyrimas. Kiekvienos modelio užklausos laukimo riba – 180 sekundžių. Nesėkmingos užklausos automatiškai nekartojamos; vartotojo atšaukimas perduodamas vykdomoms užklausoms. Serveris neatlieka pakeitimų projekte ir neišsaugo tyrimo turinio į failus. Tyrėjų instrukcijos ir resursai perskaitomi paleidžiant; juos pakeitus perkrauk serverį.

## Patikra ir trikčių diagnostika

```sh
npm run check
npm test
```

Testai naudoja tikrą MCP klientą ir atskirą serverio procesą, o modelio atsakymus imituoja vietoje. Jie nenaudoja API raktų ar mokamų modelių. Gyvas tyrimas papildomai priklauso nuo vartotojo modelio prieigos ir VS Code leidimų.

- Serverio nematyti: patikrink aktyvų VS Code profilį, paleisk `npm run vscode:install` ir atverk **MCP: List Servers**.
- Procesas nepasileidžia: per **Show Output** patikrink Node/serverio kelią; jei trūksta priklausomybių, paleisk `npm ci --ignore-scripts`.
- Modelio užklausos atmetamos: patikrink **Configure Model Access**, AI prisijungimą ir turimo modelio naudojimo limitus.
- Matomas `sampling_unavailable`: klientas šios galimybės nepaskelbė. Naudok VS Code vietinį Chat Agent režimą; kiti klientai ar Agent Host sesijos gali turėti kitokį palaikymą. Planavimo įrankiai ir resursai vis tiek prieinami.
- Peržiūrėti modelio užklausas galima per serverio **Show Sampling Requests**.

## Suderinamumo pagrindas

Naudojamas oficialus `@modelcontextprotocol/sdk` 1.30.0 ir MCP 2025-11-25 protokolo suderinamumas. MCP 2026-07-28 laidoje tiesioginis sampling pažymėtas kaip keičiamas nauja eiga; ši versija sąmoningai remiasi VS Code palaikomu SDK v1 keliu. Pereinant prie SDK v2 reikia iš naujo patikrinti sampling API ir suderintą protokolą.

Oficialūs šaltiniai, patikrinti 2026-09-12:

- [VS Code MCP serverių diegimas ir valdymas](https://code.visualstudio.com/docs/agent-customization/mcp-servers)
- [VS Code sampling ir modelio prieiga](https://code.visualstudio.com/api/extension-guides/ai/mcp#sampling)
- [Integruotas Copilot nuo VS Code 1.116](https://code.visualstudio.com/updates/v1_116#_github-copilot-is-now-builtin)
- [Oficialaus MCP SDK v1 galimybės](https://ts.sdk.modelcontextprotocol.io/capabilities)
- [MCP 2026-07-28 protokolo pakeitimai](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
