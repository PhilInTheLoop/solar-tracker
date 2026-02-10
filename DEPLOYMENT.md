# Solar Tracker Deployment

Deployed to **solar.thiel.ph** on IONOS server (87.106.30.14).
Auto-deploys from GitHub on push to `main`.

## Automatic Deployment

Push to `main` branch triggers automatic deployment via GitHub Actions.

## Manual Deployment

SSH into server and run:
```bash
/opt/solar-tracker/deploy.sh
```

## Server Setup (One-Time)

### 1. Clone Repository

```bash
cd /opt
git clone https://github.com/PhilInTheLoop/solar-tracker.git
cd solar-tracker
```

### 2. Create Virtual Environment

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Make deploy.sh Executable

```bash
chmod +x /opt/solar-tracker/deploy.sh
```

### 4. Create systemd Service

Create `/etc/systemd/system/solar-tracker.service`:

```ini
[Unit]
Description=Solar Tracker App
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/solar-tracker
ExecStart=/opt/solar-tracker/venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8003
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable solar-tracker
sudo systemctl start solar-tracker
```

### 5. Nginx Configuration

Create `/etc/nginx/sites-available/solar-tracker`:

```nginx
server {
    listen 443 ssl;
    server_name solar.thiel.ph;

    ssl_certificate /etc/letsencrypt/live/solar.thiel.ph/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/solar.thiel.ph/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8003;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }
}

server {
    listen 80;
    server_name solar.thiel.ph;
    return 301 https://$host$request_uri;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/solar-tracker /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. DNS Setup

Add an A record in your IONOS DNS settings:
- **Type:** A
- **Name:** solar
- **Value:** 87.106.30.14

### 7. SSL Certificate

```bash
sudo certbot --nginx -d solar.thiel.ph
```

Or if using standalone:
```bash
sudo certbot certonly --standalone -d solar.thiel.ph
```

## Quick Setup (Copy-Paste)

Run these commands on the server to set everything up in one go:

```bash
# Clone and setup
cd /opt
git clone https://github.com/PhilInTheLoop/solar-tracker.git
cd solar-tracker
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
chmod +x deploy.sh

# Create systemd service
cat > /etc/systemd/system/solar-tracker.service << 'EOF'
[Unit]
Description=Solar Tracker App
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/solar-tracker
ExecStart=/opt/solar-tracker/venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8003
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable solar-tracker
systemctl start solar-tracker

# Create nginx config
cat > /etc/nginx/sites-available/solar-tracker << 'EOF'
server {
    listen 443 ssl;
    server_name solar.thiel.ph;

    ssl_certificate /etc/letsencrypt/live/solar.thiel.ph/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/solar.thiel.ph/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8003;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }
}

server {
    listen 80;
    server_name solar.thiel.ph;
    return 301 https://$host$request_uri;
}
EOF

ln -sf /etc/nginx/sites-available/solar-tracker /etc/nginx/sites-enabled/

# SSL certificate (run AFTER DNS is configured)
certbot --nginx -d solar.thiel.ph

nginx -t && systemctl reload nginx

# Verify
curl http://127.0.0.1:8003/api/health
```

## GitHub Actions Secrets

Set these in GitHub > Settings > Secrets and variables > Actions:

| Variable | Value |
|----------|-------|
| `SERVER_HOST` | `87.106.30.14` |
| `SERVER_USER` | SSH username |
| `SERVER_PASSWORD` | SSH password (masked) |

## Data Protection

The following are preserved during deployments:
- `backend/solar_data.db` - Database with readings and settings
- Backups stored in `/opt/solar-tracker-backups/`

## Default PIN

The app starts with a default PIN of **1234**. Change it immediately after first login via Settings > PIN ändern.

## Verification

```bash
# On server
curl http://127.0.0.1:8003/api/health

# Via domain
curl https://solar.thiel.ph/api/health

# Check service status
sudo systemctl status solar-tracker

# View logs
sudo journalctl -u solar-tracker -f
```

## Port Allocation

| App | Port |
|-----|------|
| diary-app | 8001 |
| fx-unified | 8002 |
| solar-tracker | 8003 |
