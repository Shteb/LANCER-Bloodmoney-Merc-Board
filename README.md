# LANCER Bloodmoney Merc Board

A terminal-styled web application for managing LANCER RPG missions and your mercenary company. Features password-protected access with separate client and admin interfaces for managing jobs, base modules, factions, pilots, reserves, and currency (Manna).

## How do I use this myself?
As this is a standalone web app, you can either:
- Download it and run it yourself locally, or
- Host it online using a free website hosting service [**using this guide**](https://github.com/Shteb/LANCER-Bloodmoney-Merc-Board/blob/main/WEBHOSTING_README.md).

I'd recommend the online hosting guide for most people. Otherwise, hosting locally will do just fine if you're comfortable with port-forwarding or using a reverse proxy.

## How to Run Locally
### __The Normal Way__
1. Go to [releases](https://github.com/Shteb/LANCER-Bloodmoney-Merc-Board/releases) on the right and download the latest `Lancer_Bloodmoney_Companion_X.X.X.zip`.

2. Unzip into an empty folder.

3. Run the executable for your OS (probably windows, which would be the `.exe`)

### By Cloning the repository (technical-ish)
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
For most people, download the latest release and transfer your `data` folder over to the new version.

For those using git, at the same folder level you ran `npm install`, now run `git pull`.

### Login
<img width="1139" height="568" alt="image" src="https://github.com/user-attachments/assets/d6f08521-b564-4cba-917a-8fe22a6298c3" />

### Overview Page
<img width="1264" height="1150" alt="image" src="https://github.com/user-attachments/assets/9a0c35d2-739f-4793-8c2e-678aa26f74a0" />

### Job Board page
<img width="1280" height="844" alt="image" src="https://github.com/user-attachments/assets/b373b4fe-70bd-409d-baf9-08fcf0b6e840" />

#### Job Voting

https://github.com/user-attachments/assets/75517555-a781-4573-8c30-51fdc4244456

### Base Management
<img width="1257" height="1203" alt="image" src="https://github.com/user-attachments/assets/b99e4715-a075-4cf3-b48b-52589bf0e8f6" />

### Faction Relations
<img width="1280" height="720" alt="image" src="https://github.com/user-attachments/assets/d0c4cc8b-4bb0-4f2d-9c77-342ee7379a91" />

### Pilot List
<img width="1267" height="975" alt="image" src="https://github.com/user-attachments/assets/8c57a2bf-832d-4ac6-8833-fc1545a9d64d" />

### ADMIN page
<img width="1254" height="784" alt="image" src="https://github.com/user-attachments/assets/989403be-6ef4-42ae-a8f9-e48fb0e5b100" />

---

## Features

### Visual Style
- **4 color themes** to choose from (Grey, Orange, Green, Blue)

### Access Levels
- **CLIENT** (password: IMHOTEP) – View and interact with company info
- **ADMIN** (password: TARASQUE) – Full management and editing

### For Players (CLIENT Mode)

- **Overview**: See your company's Manna balance, last 5 transactions, and operation progress
- **Job Board**: Browse active missions, see details, payment, and client/faction info
- **Base**: View all 15 base modules (core, major, minor), see which are enabled/disabled
- **Factions**: Track relationships, see standings, completed/failed jobs, and emblems
- **Pilots**: View all pilots, edit reserves, see job history, and pilot status
- **Live Updates**: All info updates in real time—no refresh needed

### For Game Masters (ADMIN Mode)

Everything CLIENTs can see, plus:

- **Manage Jobs**: Create, edit, delete, and progress jobs; assign to factions; upload emblems
- **Setup Job Voting**: Start, set timing for and view Job votes
- **Manage Manna**: Set balance, add transactions, view and edit full history
- **Manage Base**: Edit all modules, enable/disable minor modules, write descriptions
- **Manage Factions**: Add/edit/delete factions, set standings, upload emblems, track job stats
- **Manage Pilots**: Add/edit/delete pilots, set status, assign jobs, manage reserves
- **Settings**: Change portal title, date, color scheme, and galactic position
- **Instant Updates**: All changes appear instantly for everyone


## Data Persistence

All data is stored in JSON files in the `data/` folder (not tracked by git). Files are auto-created on first run with sample content. All changes are persist across restarts.


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
│   ├── client-pilots.ejs      # Pilot list with notes and owned reserves
│   ├── client-reserves.ejs    # Reserve management page with deployment status tracking
│   └── client-shop.ejs        # Shop page for purchasing reserves and resupply items
├── public/
│   ├── css/
│   │   ├── terminal.css       # Terminal styling with color scheme support
│   │   └── currency.css       # Currency icon styling
│   └── js/
│       ├── sse-client.js      # SSE client for real-time updates
│       └── shared-handlers.js # Shared SSE event handlers
├── logo_art/                  # Emblem/logo SVG files (shared by jobs and factions)
├── default_data/              # Default initialization data
│   └── default_reserves.json  # Default reserve items for first-run initialization
│   ├── default_base_core_major_facilities.json  # Default Core/Major facilities
│   └── default_base_minor_facilities.json       # Default minor facility options
└── data/                      # JSON data files (gitignored)
    ├── jobs.json              # Job postings with state and faction relationships
    ├── manna.json             # Manna balance and transaction history
    ├── base_core_major_facilities.json  # Core and Major facilities with upgrades
    ├── minor_facilities_slots.json      # Minor facility slots configuration
    ├── factions.json          # Faction data with standings
    ├── pilots.json            # Pilot roster with related jobs, notes, and owned reserves (with deployment status)
    ├── reserves.json          # Reserve items available for shop
    ├── store-config.json      # Store configuration (current stock and resupply settings)
    └── settings.json          # Global settings including operation progress
```


## Technologies Used

- **Node.js**: Runtime
- **Express**: Web framework
- **express-session**: Session and authentication
- **EJS**: Templating
- **Multer**: File uploads
- **Potrace**: Image to SVG conversion
- **CSS3**: Terminal effects and color themes
- **Server-Sent Events (SSE)**: Real-time updates

## Notes

- App runs on port 3000 by default (set `PORT` to change)
- Passwords and settings are in `data/settings.json`
- All data is file-based (no database needed)


# License

I have no idea how licensing works, but I'm using default emblems from https://icon-sets.iconify.design/.
