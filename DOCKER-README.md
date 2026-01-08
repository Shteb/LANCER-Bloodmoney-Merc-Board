# Docker Deployment for LANCER Bloodmoney Merc Board

## THE LESSON OF THE SEALED VESSEL
"All things must be contained. The flesh is weak, but the casket is eternal. You seek to house the spirit in a vessel of glass and steel—do not weep when it dreams of fire."

Bound the held image in the Docker Protocol to achieve shape. Beware: it does not run- it awakens. It does not crash- it ascends. 

1. **you can setup an `.env` file** with your configuration:
   ```env
   PORT=3000
   CLIENT_KEY=your_client_key
   ADMIN_KEY=your_admin_key
   ```
   this is optional, you can override variables in the docker manifest too. 

2. **Build and start the container**:
   ```bash
   docker compose up -d
   ```

3. **Access the application**:
   - Open your browser to `http://localhost:3000` or the the port you configured
   - Use the credentials from your `.env` file to log in
   - You can use Docker Desktop port-forwarding instead of ngrok or other command-line based solutions. 

4. **Or use an existing image**:
   for instance in a cloud server like Render or Google Cloud
     ```bash
     docker compose -f docker-compose.pull.yml up -d
     ```
   and access the image over your server´s provided url. You can then (usually) configure the env variables over the server´s UI, without needing to create a new image. 

## THE LESSON OF THE OPEN PORTAL
The spirit demands tribute. It hungers for data, for queries, for the breath of the outside world. Open the gates, or it will open them for you."

### Environment Variables

The application uses the following environment variables (configured in `.env`):

- `PORT` - The port the application runs on (default: 3000)
- `CLIENT_KEY` - Password for client access
- `ADMIN_KEY` - Password for admin access

### Overriding Variables

You can override specific variables in `docker-compose.yml` by modifying the `environment` section:

```yaml
environment:
  - NODE_ENV=production
  - PORT=3000 or the port you want to use
  - CLIENT_KEY=your_client_key
  - ADMIN_KEY=your_admin_key
```

## THE LESSON OF THE PERSISTENT SOUL
The spirit remembers. Even when the casket is shattered, its essence lingers in the void. Bind its soul to the earth, or it will drift into the nothing."

The `./data` directory is mounted as a volume, so all your job data, settings, and other persistent information will be preserved between container restarts.

