# ⚽ FIFA World Cup 2026 – iCal Calendar Service
This project generates a dynamic and fully automated iCal feed (.ics) for all 104 matches of the FIFA World Cup 2026. Running serverless via Google Apps Script, it stores data in a Google Sheet and automatically synchronizes match schedules, knockout teams, live match results, and goalscorers every single night.

## 🚀 Features
* **100% Official Data:** Eliminates the risk of AI hallucinations by fetching raw data directly from the community-vetted openfootball database.
* **Automated Timezone Handling:** Automatically converts local stadium times (e.g., UTC-6 in Mexico City) into pure UTC, ensuring matches land at the exact right hour in European/Norwegian calendars (handling Daylight Saving Time perfectly).
* **Automated Knockout Progression:** Instantly updates placeholder teams (e.g., Winner Group A) with real nations (e.g., Mexico) as soon as they qualify.
* **Live Results & Goalscorers:** The morning after a match, the calendar entry updates the title with the final score (e.g., 🏁 (2 - 1) Mexico – South Africa) and adds a detailed list of goalscorers with match minutes in the description.
* **Smart iCal Updates (SEQUENCE):** Alerts subscriber calendar apps (Apple, Google, Outlook) of data changes automatically so entries refresh seamlessly without forcing users to re-subscribe.

## 🛠️ Architecture & Data Flow
```text
[ openfootball (GitHub JSON) ] 
              │
              ▼  (Every night at 04:00 AM via Time-driven Trigger)
   [ Google Apps Script ] 
              │
              ▼  (Parses ISO 8601 offsets, stores scores/goals)
      [ Google Sheets ] 
              │
              ▼  (Served via Web App Deployment URL)
 [ Apple / Google / Outlook Calendar ]
```
## 📦 Installation & Setup

### 1. Create the Google Sheet
1. Create a new Google Spreadsheet.
2. Rename the active sheet/tab to Kamper (or whatever you choose to define as SHEET_NAME in your script).
3. Copy the Spreadsheet ID from the browser URL (the long string between /d/ and /edit).

### 2. Add the Code to Google Apps Script
1. Inside your spreadsheet, navigate to Extensions -> Apps Script.
2. Clear out any default code in the editor (Code.gs).
3. Paste your two main functions:
   * fyllRegnearkMedTerminliste() (Fetches, parses, and cleans data from GitHub).
   * doGet() (Generates and serves the formatted iCal/ICS file).
4. Define your global constants at the very top of the script:
   const SPREADSHEET_ID = "YOUR_GOOGLE_SHEET_ID_HERE";
   const SHEET_NAME = "Kamper";
5. Click the Save icon (the floppy disk).

### 3. Configure the Nightly Trigger
To keep your calendar updated with live results and advancing knockout brackets:
1. Click on Triggers (the clock icon) in the left sidebar of the Apps Script interface.
2. Click the blue Add Trigger button in the bottom right corner.
3. Configure the fields exactly as follows:
   * Choose which function to run: fyllRegnearkMedTerminliste
   * Choose which deployment should run: Head
   * Select event source: Time-driven
   * Select type of time-based trigger: Day timer
   * Select time of day: 4am to 5am (Ideal, as all evening games in North America will be wrapped up, and data will be pushed to GitHub).
4. Click Save.

### 4. Deploy as a Web App
1. Click the Deploy button in the top right -> select New deployment.
2. Click the gear icon next to "Select type" and choose Web app.
3. Set Execute as to: Me.
4. Set Who has access to: Anyone (This is crucial, otherwise external calendar apps won't be able to fetch the feed).
5. Click Deploy and copy the generated Web app URL.

## 📅 How to Subscribe

Copy the Web App URL obtained from the deployment step and paste it into your favorite calendar application:

* iPhone / Mac (Apple Calendar): Open Calendar -> File -> New Calendar Subscription... -> Paste the URL.
* Google Calendar: Click the + sign next to "Other calendars" -> From URL -> Paste the URL.
* Outlook: Click Add Calendar -> Subscribe from web -> Paste the URL.

## 📝 Spreadsheet Layout (Columns)
The script automatically builds and maintains the following structure in your Kamper sheet:

```text
Column A | Header: MatchID | Description: Unique iCal UID (wm2026-match-1)
Column B | Header: DatoUTC | Description: True timezone-adjusted UTC date (2026-06-11T19:00:00Z)
Column C | Header: Hjemmelag | Description: Home nation or placeholder (Mexico / Winner Group A)
Column D | Header: Bortelag | Description: Away nation or placeholder (South Africa)
Column E | Header: Gruppe | Description: Group stage designation or cup round (Group A / Round of 32)
Column F | Header: Stadion | Description: Arena name (Estadio Azteca)
Column G | Header: By | Description: Host city (Mexico City)
Column H | Header: LokalTid | Description: Raw local time text string from source data (13:00 UTC-6)
Column I | Header: Sekvens | Description: iCal version tracking (increments on match changes or final scores)
Column J | Header: ResultatInfo | Description: Fulltime score + goals (FINAL SCORE: 2 - 1 | Goals: ⚽ ...)
```

## 📄 License
This project is open-source. All World Cup match data is provided and actively maintained by the open-source community via the openfootball project.
