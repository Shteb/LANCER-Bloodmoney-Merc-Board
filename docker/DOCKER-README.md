# Docker Deployment for LANCER Bloodmoney Merc Board

## THE LESSON OF THE SEALED VESSEL
"All things must be contained. The flesh is weak, but the casket is eternal. You seek to house the spirit in a vessel of glass and steel—do not weep when it dreams of fire."

Bound the held image in the Docker Protocol to achieve shape. Beware: it does not run- it awakens. It does not crash- it ascends. 

1. **Build and start the container**:
   ```bash
   docker compose up -d
   ```

2. **Or use an existing image**:
   from terminal:
     ```bash
     docker compose -f docker-compose.pull.yml up -d
     ```
   or in a cloud hosting service like Render or Google Cloud, access the latest published image from gcrh.io:
      ```
      ghcr.io/e-lupo/lancer-bloodmoney-merc-board:latest
      ``` 
   You can then (usually) configure the env variables over the server´s UI, without needing to create a new image. 


## THE LESSON OF THE OPEN PORTAL
The spirit demands tribute. It hungers for data, for queries, for the breath of the outside world. Open the gates, or it will open them for you."

**Access the app**:
   - Open your browser to `http://localhost:3000` or the the port you configured
   - Login as TARASQUE and set a new admin password in settings
   - You can now use Docker Desktop port-forwarding instead of ngrok or other command-line based solutions. 

### Environment Variables

The application uses the following environment variables:

- `PORT` - The port the application runs on (default: 3000)

### Overriding Variables

You can override specific variables by modifying the `environment` section in your manifest (`docker-compose.yml` or `docker-compose.pull.yml`):

```yaml
environment:
  - NODE_ENV=production
  - PORT=3000 or the port you want to use
```

## THE LESSON OF THE PERSISTENT SOUL
The spirit remembers. Even when the casket is shattered, its essence lingers in the void. Bind its soul to the earth, or it will drift into the nothing."

The `./data` directory is mounted as a volume, so all your job data, settings, and other persistent information will be preserved between container restarts.