// ==========================================
// CONFIGURATION
// ==========================================
const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const SHEET_NAME = "Kamper";
const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY") || "DIN_API_NØKKEL_HER";

// ==========================================
// 1. GENERER ICAL-FEED (Web App: doGet)
// ==========================================
function doGet() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  
  let icalString = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SmarteTore//Fotball-VM 2026//NO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Fotball-VM 2026",
    "X-WR-TIMEZONE:Europe/Oslo",
    "X-PUBLISHED-TTL:PT24H",          // Forteller apper at feeden oppdateres døgnkontinuerlig
    "REFRESH-INTERVAL;VALUE=DURATION:PT24H" // Tvinger Apple Calendar til å sette "Hver dag" (Daily) automatisk
  ].join("\r\n") + "\r\n";

  for (let i = 1; i < data.length; i++) {
    let [matchId, datoUtc, hjemme, borte, gruppe, stadion, by, lokalTid, sekvens, resultatInfo] = data[i];
    
    if (!matchId || !datoUtc) continue;

    let d = new Date(datoUtc);
    let iCalTime = d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    
    let dEnd = new Date(d.getTime() + (2 * 60 * 60 * 1000));
    let iCalTimeEnd = dEnd.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    let norskTidStreng = Utilities.formatDate(d, "Europe/Oslo", "HH:mm");
    let norskDatoStreng = Utilities.formatDate(d, "Europe/Oslo", "dd.MM.yyyy");

    let tittel = `⚽ ${hjemme} – ${borte} [${gruppe}]`;
    
    if (resultatInfo && resultatInfo.trim().includes("SLUTTRESULTAT")) {
      let renScore = resultatInfo.split(" | ")[0].replace("SLUTTRESULTAT: ", "").trim();
      tittel = `🏁 (${renScore}) ${hjemme} – ${borte}`;
    }

    // FIKSET: Unngå dobbeltkonveksjon hvis stadion og by er identiske i regnearket
    let lokasjonVisning = `${stadion} (${by})`;
    if (stadion.trim().toLowerCase() === by.trim().toLowerCase()) {
      lokasjonVisning = stadion;
    }
    
    let lokasjon = lokasjonVisning;
    
    // Bygg opp beskrivelsen med den fikset lokasjonsvisningen
    let beskrivelseLinjer = [
      `Kamp: ${gruppe.includes('finale') ? gruppe : 'Gruppespill'}`,
      `Stadion: ${lokasjonVisning}`,
      ``,
      `Tidspunkt:`,
      `• Klokkeslett i Norge: ${norskTidStreng} (Dato: ${norskDatoStreng})`,
      `• Lokal tid på stadion: ${lokalTid}`,
      ``
    ];

    if (resultatInfo && resultatInfo.trim() !== "") {
      beskrivelseLinjer.push(`📢 ${resultatInfo.replace(/ \| /g, "\\n📢 ")}`);
    } else {
      beskrivelseLinjer.push(`Status: ${hjemme.includes('Vinner') || hjemme.includes('Nr 3') ? 'Venter på endelig tabell.' : 'Kamp ikke startet.'}`);
    }

    beskrivelseLinjer.push(
      ``,
      `---`,
      `Sist synkronisert: ${Utilities.formatDate(new Date(), "Europe/Oslo", "yyyy-MM-dd HH:mm")}`
    );

    let beskrivelse = beskrivelseLinjer.join("\\n");

    icalString += [
      "BEGIN:VEVENT",
      `UID:${matchId}@vm2026.ical.local`,
      `SEQUENCE:${sekvens || 0}`,
      `DTSTAMP:${iCalTime}`,
      `DTSTART:${iCalTime}`,
      `DTEND:${iCalTimeEnd}`,
      `SUMMARY:${tittel}`,
      `LOCATION:${lokasjon}`,
      `DESCRIPTION:${beskrivelse}`,
      "END:VEVENT"
    ].join("\r\n") + "\r\n";
  }

  icalString += "END:VCALENDAR";

  return ContentService.createTextOutput(icalString)
    .setMimeType(ContentService.MimeType.TEXT);
}
// ==========================================
// 2. FYLL HELE TERMINLISTEN FRA GITHUB-DATABASE
// ==========================================
function fyllRegnearkMedTerminliste() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  
  let eksisterendeData = {};
  try {
    const gamleRader = sheet.getDataRange().getValues();
    for (let i = 1; i < gamleRader.length; i++) {
      let [mId, dUtc, hj, bo, gr, st, by, lok, sek, resInfo] = gamleRader[i];
      if (mId) {
        eksisterendeData[mId] = { hjemme: hj, borte: bo, info: gamleRader[i] };
      }
    }
  } catch(e) {}
  
  sheet.clearContents();
  sheet.appendRow(["MatchID", "DatoUTC", "Hjemmelag", "Bortelag", "Gruppe", "Stadion", "By", "LokalTid", "Sekvens", "ResultatInfo"]);
  
  Logger.log("Henter oppdatert VM 2026-database fra hurtigoppdatert feed...");
  // Endret til den aktive og hurtigoppdaterte fork-feeden for turneringen
  const url = "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";
  
  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) return;
    
    const data = JSON.parse(response.getContentText());
    let kamper = [];
    if (data.matches) { kamper = data.matches; } 
    else if (data.rounds) { data.rounds.forEach(r => { if (r.matches) kamper = kamper.concat(r.matches); }); }
    
    kamper.forEach((match, index) => {
      let matchId = match.num ? `wm2026-match-${match.num}` : `wm2026-match-${index + 1}`;
      
      let raaDato = match.date || "";
      let raaTid = match.time || ""; 
      
      let datoUtc = "";
      if (raaDato && raaTid) {
        let renTid = raaTid.replace("UTC", "").replace(" ", "") + ":00"; 
        
        if (renTid.includes("-") && renTid.split("-")[1].length === 4) {
          let deler = renTid.split("-");
          renTid = deler[0] + "-0" + deler[1];
        }
        if (renTid.includes("+") && renTid.split("+")[1].length === 4) {
          let deler = renTid.split("+");
          renTid = deler[0] + "+0" + deler[1];
        }

        let isoStreng = `${raaDato}T${renTid}`;
        let parseDato = new Date(isoStreng);
        
        if (!isNaN(parseDato.getTime())) {
          datoUtc = parseDato.toISOString().replace(".000", "");
        } else {
          datoUtc = "2026-06-11T19:00:00Z"; 
        }
      } else {
        datoUtc = "2026-06-11T19:00:00Z";
      }
      
      let hjemme = match.team1 || match.team1_placeholder || "Ukjent lag";
      let borte = match.team2 || match.team2_placeholder || "Ukjent lag";
      let gruppe = match.group || match.round || "Gruppespill";
      let stadion = match.ground || match.stadium || match.venue || "TBD Stadion";
      let by = match.city || match.ground || "Vertsby";
      let lokalTid = raaTid; 
      
      // Korrigert for openfootballs "score: { ft: [2, 0] }" datastruktur
      let resultatInfo = "";
      if (match.score && match.score.ft) {
        let s1 = match.score.ft[0];
        let s2 = match.score.ft[1];
        resultatInfo = `SLUTTRESULTAT: ${s1} - ${s2}`;
        
        let maal = [];
        if (match.goals1 && match.goals1.length > 0) match.goals1.forEach(g => { if (g.name) maal.push(`⚽ ${g.name} (${g.minute}') [${hjemme}]`); });
        if (match.goals2 && match.goals2.length > 0) match.goals2.forEach(g => { if (g.name) maal.push(`⚽ ${g.name} (${g.minute}') [${borte}]`); });
        if (maal.length > 0) resultatInfo += ` | Mål: ${maal.join(", ")}`;
      }
      
      let sekvens = 0;
      if (eksisterendeData[matchId]) {
        let gammel = eksisterendeData[matchId];
        let gammelSekvens = Number(gammel.info[8]) || 0;
        let gammelResultatInfo = gammel.info[9] || "";
        if (gammel.hjemme !== hjemme || gammel.borte !== borte || gammelResultatInfo !== resultatInfo) {
          sekvens = gammelSekvens + 1;
        } else {
          sekvens = gammelSekvens;
        }
      }
      
      sheet.appendRow([matchId, datoUtc, hjemme, borte, gruppe, stadion, by, lokalTid, sekvens, resultatInfo]);
    });
    
    Logger.log("Suksess! Tabellen ble oppdatert med ferske resultater.");
  } catch(e) {
    Logger.log("Kritisk feil: " + e.toString());
  }
}

function testArkTilgang() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    Logger.log("Fant regnearket: " + ss.getName());
    
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (sheet) {
      Logger.log("Suksess! Fant fanen: " + SHEET_NAME);
    } else {
      Logger.log("FEIL: Fant regnearket, men fant ingen fane med navn: '" + SHEET_NAME + "'");
    }
  } catch(e) {
    Logger.log("KRITISK FEIL: Kunne ikke åpne regnearket. Sjekk SPREADSHEET_ID. Feilmelding: " + e.toString());
  }
}
