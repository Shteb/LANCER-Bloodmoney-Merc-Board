# LANCER Bloodmoney Merc Board

A terminal-styled web application for managing and viewing LANCER Bloodmoney Merc postings. Features password-gated access with separate client and admin interfaces.

## How to Run Locally
0. **You will need Node Package Manager (NPM) and therefore Node.js to use this.** 

   For Windows at least, you'll want to install Node.js through the installer on their website here: https://nodejs.org/en/download

   You will also need Git installed, which can be done from their website here: https://git-scm.com/install/

    0.5 Open a Terminal or CMD and `cd` to a folder of your preference where this will be stored.

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Shteb/LANCER-Bloodmoney-Merc-Board.git
   cd LANCER-Bloodmoney-Merc-Board
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the server**:
   ```bash
   npm start
   ```

4. **Open your browser** and navigate to `http://localhost:3000`

5. **Login** with one of the following access codes:
   - **CLIENT Mode**: Enter `IMHOTEP` (view-only access)
   - **ADMIN Mode**: Enter `TARASQUE` (full management access)

## Updating
At the same folder level you ran `npm install`, now run `git pull`.

### Login
<img width="1139" height="568" alt="image" src="https://github.com/user-attachments/assets/d6f08521-b564-4cba-917a-8fe22a6298c3" />

### Overview Page
<img width="1280" height="885" alt="image" src="https://github.com/user-attachments/assets/e3ba4bf2-1917-4090-8c93-41b4732d4788" />

### Job Board page
<img width="1280" height="844" alt="image" src="https://github.com/user-attachments/assets/b373b4fe-70bd-409d-baf9-08fcf0b6e840" />

### Base Management
<img width="1280" height="1341" alt="image" src="https://github.com/user-attachments/assets/a2304865-3b28-489c-8306-def436f88445" />

### Faction Relations
<img width="1280" height="720" alt="image" src="https://github.com/user-attachments/assets/d0c4cc8b-4bb0-4f2d-9c77-342ee7379a91" />

### ADMIN page
<img width="1157" height="2000" alt="image" src="https://github.com/user-attachments/assets/4cb88eaa-9325-4873-a9e1-a3dea1a49ad4" />

## Features

### Visual Style
- **4 color themes** to choose from (Grey, Orange, Green, Blue)

### Access Levels
- **Player Access** (password: IMHOTEP) - View information only
- **Game Master Access** (password: TARASQUE) - Create and edit everything

### For Players (CLIENT Mode)

**Main Dashboard**
- See your company's current money (Manna)
- View recent transactions
- Navigate to different sections

**Mission Board**
- Browse available missions
- See mission details: difficulty, type, objectives, payment
- View client information and logos

**Base Status**
- View your base's facilities and modules
- See what's operational and what's empty

**Faction Relations**
- Track relationships with different organizations
- See who trusts you and who doesn't
- View how many jobs you've completed for each faction
- Check your reputation level with each group

**Pilot Roster**
- See all your pilots and their details
- Edit pilot equipment and notes
- View which missions each pilot has worked on
- See active and inactive pilots

**Live Updates**
- Everything updates automatically when changes are made
- No need to refresh your browser

### For Game Masters (ADMIN Mode)

**Everything players can see, plus:**

**Manage Missions**
- Create new missions
- Edit or delete existing missions
- Change mission status (pending, active, completed, failed)
- Assign missions to factions
- Upload mission logos

**Manage Money**
- Add or remove funds
- Record transactions
- Edit transaction history

**Manage Base**
- Configure all base modules
- Write descriptions for facilities
- Enable or disable modules

**Manage Factions**
- Create and edit organizations
- Set relationship levels
- Upload faction logos
- Track job performance

**Manage Pilots**
- Add new pilots
- Edit pilot information
- Assign pilots to missions
- Mark pilots as active or inactive

**Settings**
- Change the portal title
- Set the date
- Change color scheme
- Update location information

All changes appear instantly for everyone viewing the app.

## Data Persistence

Job data is stored in `data/jobs.json` and global settings are stored in `data/settings.json`. These files are automatically created on first run with default data. The files persist across restarts, ensuring your job postings and settings are saved.

## Project Structure

```
LANCER-Bloodmoney-Merc-Board/
├── server.js                  # Express server and API routes
├── helpers.js                 # Validation and helper functions
├── package.json               # Project dependencies
├── views/
│   ├── landing.ejs            # Password entry page
│   ├── admin.ejs              # Admin panel with tabbed interface
│   ├── client-overview.ejs    # Client landing page (Manna balance + navigation)
│   ├── client-jobs.ejs        # Job board listing
│   ├── client-base.ejs        # Base modules display
│   ├── client-factions.ejs    # Faction relations display
│   ├── client-finances.ejs    # Full transaction history view
│   └── client-pilots.ejs      # Pilot list with reserves editing
├── public/
│   ├── css/
│   │   ├── terminal.css       # Terminal styling with color scheme support
│   │   └── currency.css       # Currency icon styling
│   └── js/
│       ├── sse-client.js      # SSE client for real-time updates
│       └── shared-handlers.js # Shared SSE event handlers
├── logo_art/                  # Emblem/logo SVG files (shared by jobs and factions)
└── data/                      # JSON data files (gitignored)
    ├── jobs.json              # Job postings with state and faction relationships
    ├── manna.json             # Manna balance and transaction history
    ├── base.json              # Base module configurations
    ├── factions.json          # Faction data with standings
    ├── pilots.json            # Pilot roster with related jobs
    └── settings.json          # Global settings including operation progress
```

## Technologies Used

- **Node.js**: Runtime environment
- **Express**: Web framework
- **EJS**: Templating engine
- **Body-Parser**: Request body parsing middleware
- **CSS3**: Terminal effects and styling

## Development Notes

- The application uses port 3000 by default (configurable via `PORT` environment variable)

# License

I have no idea how licensing works, but I'm using default emblems from https://logobook.com/.
