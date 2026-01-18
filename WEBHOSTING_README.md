# Hosting the Dashboard as a public website

This guide will help you deploy the Lancer Bloodmoney Merc Board to as a public website. 
This means you don´t need to setup port forwarding - the app will live on the web and be accessible by anybody with the page´s url. 

## Hosting your webapp for free?
A little disclaimer. 
There are many services out there for hosting web apps offering hosting for free. These usually have limitations, like keeping your app awake only for so long at a time or not offering permanent storage. The dashboard saves settings and emblems to disk, so in most situations if the app restarts it will revert to the default settings and your jobs / pilots / embles etc will be lost.  

The specifics will differ from service provider to service provider, and the exact conditions of each service´s free tier is also bound to change with time - this guide describes two different options, Azure and Render, and how they work at the time of this writing. 

Contributions on how to host on other services are welcome!

---

## Hosting on Azure

Azure offers an App Hosting service with a free plan and some persistent storage option. To do so you need to setup a free trial account. Azure requires to input a credit card to setup an account, even if no charges occur. 

### Option 1: Deploy from Docker Image (Reccomended)
This option will automatically update your app to the newest version, but requires a bit more configuration than the pulling from code option detailed below. 

1. Go to [Azure portal](portal.azure.com)
2. Click **"Create a resource"** → **"Web App"**
3. Configure:
   - under Instance Details:
      - **Name**: Choose a name for the app
      - **Publish**: Container
      - **Operating System**: Linux
      - **Pricing plan**: Free F1
4. Click **Review + create**, then **Create** and wait for the resource to be created.
5. Wait for **"Deployment is in progress"** to become **✅ Your Deployment is complete**
6. Click **Go to resource**
7. In the left taskbar, click on **Settings** -> **Environmnetal Variables**
   - **WEBSITES_ENABLE_APP_SERVICE_STORAGE** -> write "true" instead of the default "false"
8. Click **Apply**
9. In the left taskbar, click on **Settings** -> **Configuration**
   - **SCM Basic Auth Publishing Credentials** -> check
10. Click **Apply**
11. In the left taskbar, click on **Deployment** -> **Deployment Center**
      If it shows a message with an option that mentions **"upgrade to sidecar container"**, click to upgrade:
12. Click on **"main"** in the container list and configure:
   - **Image Source**: Other container registry
   - **Image Type**: public
   - **Registry Server URL**: ghcr.io
   - **Image and Tag**: stheb/lancer-bloodmoney-merc-board:latest
   - **Volume Mounts**: add these two volumes (important! or your data won´t persist across restarts)
      | Volume sub path | Container mount path |
      | /home/app/data | /app/data |
      | /home/app/logo_art | /app/logo_art |
13. Click **Apply** 
14. Check the **"Continuous deployment for the main container"** checkbox.
15. Click on the **"Browse"** button. This will trigger the initial deployment of the app. Wait for it to complete.
16. Your app is now live at `https://your-app-name.azurewebsites.net`


### Option 2: Deploy from Github
This is the option with the smallest amount of configuration needed. It consumes quite more space on hard drive than the Docker option, and it requires manual updating whenever the app releases a new version

1. Go to [Azure portal](portal.azure.com)
2. Click **"Create a resource"** → **"Web App"**
3. Configure:
   - under Instance Details:
      - **Name**: Choose a name for the app
      - **Publish**: Code
      - **Runtime stack**: Node 24 LTS
      - **Pricing plan**: Free F1
4. Click **Review + create**, then **Create** and wait for the resource to be created.
5. Wait for **"Deployment is in progress"** to become **✅ Your Deployment is complete**
6. Click **Go to resource**
7. In the left taskbar, click on **Settings** -> **Configuration**
   - **SCM Basic Auth Publishing Credentials** -> check
8. Click **Apply**
9. In the left taskbar, click on **Deployment** -> **Deployment Center**
   - **Source**: External Git
   - **Repository**: paste the URL to this repo
   - **Branch**: type main
   - **Repository type**: Public
10. In the toolbar on top, Click **Save** 
11. Wait for deployment to complete.
12. Your app is now live at `https://your-app-name.azurewebsites.net`

To update the app to a new version, you need to head to the Developer Center and click the "sync" button. 

---

## Hosting on Render.com

Hosting on Render is really straightforward, comparing to Azure. Unfortunately, the free tier doesn´t offer storage, so if the app goes to sleep or restart for any reason, all your settings are gone. It´s a good option if you just want to test, or if you are willing to go for one of the paid plans. 

### Option 1: Deploy from GitHub

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

### Option 2: Deploy from Docker Image

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Select **"Deploy an existing image from a registry"**
4. Input the URL to the latest image:
   ```
   ghcr.io/shteb/lancer-bloodmoney-merc-board:latest
   ```
5. Click **"Create Web Service"**
6. Wait for deployment to complete
7. Your app will be live at `https://your-app-name.onrender.com`

---

## Keeping Your App Awake

Most free web hosting put apps to sleep after some amount of inactivity. To keep your app responsive, you need to ping it regularly from an external service. If you don´t do this your app will take a bit (30 second to a minute or so) to restart after it has gone inactive.

### UptimeRobot (Recommended - Free & Easy)

1. Go to [UptimeRobot.com](https://uptimerobot.com/) and create a free account
2. Click **"Add New Monitor"**
3. Configure:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: Lancer Merc Board
   - **URL**: `https://your-app-name.com/health`
   - **Monitoring Interval**: 5 minutes (free tier minimum)
4. Click **"Create Monitor"**

UptimeRobot will ping your app every 5 minutes, keeping it awake. As a bonus, you'll get email alerts if the dashboard goes down.

---

### Cron-Job.org (Alternative)

1. Go to [cron-job.org](https://cron-job.org/) and create a free account
2. Click **"Create cronjob"**
3. Configure:
   - **Title**: Keep Lancer App Awake
   - **Address**: `https://your-app-name.com/health`
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
        run: curl https://your-app-name.com/health
```

3. Replace `your-app-name` with the actual URL of your app on whicever web hosting service you picked.
4. Commit and push the file
5. Enable workflows in your repo's **Actions** settings tab

GitHub Actions will automatically ping your app every 14 minutes.

---

## First Time Setup

Once your app is deployed and awake:

1. Visit your app URL: `https://your-app-name.com`
2. Default passwords:
   - **Pilot Password**: `IMHOTEP`
   - **Admin Password**: `TARASQUE`
3. Log in as Admin and change the passwords in Settings
4. Configure your portal heading, faction, and other settings