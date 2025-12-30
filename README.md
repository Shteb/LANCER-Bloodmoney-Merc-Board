# LANCER RPG Job Board

A terminal-styled web application for managing and viewing LANCER RPG job postings. Features password-gated access with separate client and admin interfaces.

## How to Run Locally
0. **You will need Node Package Manager (NPM) and therefore Node.js to use this.** 

   For Windows at least, you'll want to install Node.js through the installer on their website here: https://nodejs.org/en/download

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Shteb/LANCER-RPG-Job-Board.git
   cd LANCER-RPG-Job-Board
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

### Login
<img width="1139" height="568" alt="image" src="https://github.com/user-attachments/assets/d6f08521-b564-4cba-917a-8fe22a6298c3" />

### Overview Page
<img width="920" height="916" alt="image" src="https://github.com/user-attachments/assets/38c364ac-c0b7-4dab-a30b-1900c44e8a2e" />

### Job Board page
<img width="1276" height="1002" alt="image" src="https://github.com/user-attachments/assets/6be8400d-4539-434f-b17a-8e18288f4a11" />

### Base Management
<img width="920" height="916" alt="image" src="https://github.com/user-attachments/assets/4068086c-22c7-4c51-87e2-9ac532b09558" />

### Faction Relations
<img width="920" height="916" alt="image" src="https://github.com/user-attachments/assets/959b93d8-0ac5-4f7d-b5f4-ac838bbe38b7" />

### ADMIN page
<img src="https://github.com/user-attachments/assets/b6c936a0-8192-4501-9b80-aed059fa1917" />

## Features

- **CLIENT Mode** (Password: `IMHOTEP`): View-only grid of job cards
- **ADMIN Mode** (Password: `TARASQUE`): Full CRUD operations for managing job postings
- **Persistent Storage**: Job data is stored in a JSON file for persistence across restarts
- **Global Settings**: Customizable settings displayed in the client view:
  - **User Group**: Displayed below the portal header
  - **UNT Date**: Universal time/date in DD/MM/YYYY format, `U` appended for Union vibes. 
  - **Galactic Position**: Current location in the galaxy.
  - **Color Scheme**: Terminal color theme (grey, orange, green, or blue)
- **Comprehensive Job Information**: Each job card includes:
  - Job name
  - Job rank (1-3 stars)
  - Client name
  - Job description
  - Client brief
  - Currency payment (e.g., "100m")
  - Additional payment information

### Access Codes

- **CLIENT Mode**: Enter `IMHOTEP` at the landing page
- **ADMIN Mode**: Enter `TARASQUE` at the landing page

### Client View

The client view displays all job postings in a terminal-styled grid layout. Each card shows:
- Job name with rank indicator (★ stars)
- Client information
- Job description and brief
- Payment details

### Admin View

The admin panel provides a clean, functional interface for managing job postings and global settings:
- **Global Settings**: Configure system-wide settings
  - **Color Scheme**: Choose terminal color theme for client and landing views
  - **UNT**: Set the universal time/date (DD/MM/YYYY format)
  - **Current Galactic Position**: Set the current location
  - **User Group**: Set the user group name displayed in client view
- **Add New Jobs**: Fill out the form to create new job postings
- **Edit Jobs**: Click the "Edit" button to modify existing jobs
- **Delete Jobs**: Click the "Delete" button to remove jobs

## Data Persistence

Job data is stored in `data/jobs.json` and global settings are stored in `data/settings.json`. These files are automatically created on first run with default data. The files persist across restarts, ensuring your job postings and settings are saved.

## Project Structure

```
LANCER-RPG-Job-Board/
├── server.js                  # Express server and API routes
├── package.json               # Project dependencies
├── views/
│   ├── landing.ejs            # Password entry page
│   ├── admin.ejs              # Admin panel with tabbed interface
│   ├── client-overview.ejs    # Client landing page (Manna balance + navigation)
│   ├── client-jobs.ejs        # Job board listing
│   ├── client-base.ejs        # Base modules display
│   ├── client-factions.ejs    # Faction relations display
│   └── client-finances.ejs    # Full transaction history view
├── public/
│   └── css/
│       ├── terminal.css       # Terminal styling with color scheme support
│       └── currency.css       # Currency icon styling
├── logo_art/                  # Emblem/logo SVG files (shared by jobs and factions)
└── data/                      # JSON data files (gitignored)
    ├── jobs.json              # Job postings
    ├── manna.json             # Manna balance and transaction history
    ├── base.json              # Base module configurations
    ├── factions.json          # Faction data with standings
    └── settings.json          # Global settings
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
