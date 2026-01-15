# Deploying to Render

This guide will help you deploy the Lancer Bloodmoney Merc Board to Render's free tier and keep it awake. No port forwarding needed - the app will live on the web.

---

## Deployment Options

### Option 1: Deploy with Blueprint (Easiest)

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Blueprint"**
3. Connect this repository using the **"Public Git Repository"** option
4. Give a unique name to your blueprint
5. Render will detect the `render.yaml` Blueprint and deploy the app
6. Wait a bit and that's it! Your app will be live at your own URL (like `https://your-service-name.onrender.com`)

---

### Option 2: Deploy from GitHub

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Select existing public repository and paste the URL to this repo
4. Configure:
   - **Name**: Choose a name for the app
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. Click **"Create Web Service"**
6. Wait for deployment to complete
7. Your app will be live at `https://your-app-name.onrender.com`

---

### Option 3: Deploy from Docker Image

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Select **"Deploy an existing image from a registry"**
4. Input the URL to the latest image:
   ```
   ghcr.io/e-lupo/lancer-bloodmoney-merc-board:latest
   ```
5. Click **"Create Web Service"**
6. Wait for deployment to complete
7. Your app will be live at `https://your-app-name.onrender.com`

---

## Keeping Your App Awake

Render's free tier puts apps to sleep after 15 minutes of inactivity. To keep your app responsive, you need to ping it regularly from an external service.

### UptimeRobot (Recommended - Free & Easy)

1. Go to [UptimeRobot.com](https://uptimerobot.com/) and create a free account
2. Click **"Add New Monitor"**
3. Configure:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: Lancer Merc Board
   - **URL**: `https://your-app-name.onrender.com/health`
   - **Monitoring Interval**: 5 minutes (free tier minimum)
4. Click **"Create Monitor"**

UptimeRobot will ping your app every 5 minutes, keeping it awake. As a bonus, you'll get email alerts if the dashboard goes down.

---

### Cron-Job.org (Alternative)

1. Go to [cron-job.org](https://cron-job.org/) and create a free account
2. Click **"Create cronjob"**
3. Configure:
   - **Title**: Keep Lancer App Awake
   - **Address**: `https://your-app-name.onrender.com/health`
   - **Schedule**: Every 14 minutes (or any interval under 15 minutes)
4. Save and enable the cron job

---

### GitHub Actions (No External Account Needed)

If you use GitHub, you can set up automatic pinging using GitHub Actions:

1. In any repository (even your own fork of this one), create a file at `.github/workflows/keep-alive.yml`
2. Paste this content:

```yaml
name: Keep Alive

on:
  schedule:
    - cron: '*/14 * * * *'  # Every 14 minutes

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Render App
        run: curl https://your-app-name.onrender.com/health
```

3. Replace `your-app-name` with the actual URL of your app on Render
4. Commit and push the file
5. Enable workflows in your repo's **Actions** settings tab

GitHub Actions will automatically ping your app every 14 minutes.

---

## First Time Setup

Once your app is deployed and awake:

1. Visit your app URL: `https://your-app-name.onrender.com`
2. Default passwords:
   - **Pilot Password**: `IMHOTEP`
   - **Admin Password**: `TARASQUE`
3. Log in as Admin and change the passwords in Settings
4. Configure your portal heading, faction, and other settings