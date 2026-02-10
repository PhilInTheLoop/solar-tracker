#!/bin/bash
set -e

APP_DIR="/opt/solar-tracker"
BACKUP_DIR="/opt/solar-tracker-backups"
SERVICE_NAME="solar-tracker"

echo "=== Solar Tracker Deployment ==="

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup database before deployment
if [ -f "$APP_DIR/backend/solar_data.db" ]; then
    BACKUP_FILE="$BACKUP_DIR/solar_data_$(date +%Y%m%d_%H%M%S).db"
    cp "$APP_DIR/backend/solar_data.db" "$BACKUP_FILE"
    echo "Database backed up to $BACKUP_FILE"

    # Keep only last 10 backups
    ls -t "$BACKUP_DIR"/solar_data_*.db 2>/dev/null | tail -n +11 | xargs -r rm
fi

# Pull latest code
cd "$APP_DIR"
git pull origin main

# Update dependencies
source venv/bin/activate
pip install -r requirements.txt --quiet

# Restart service
sudo systemctl restart "$SERVICE_NAME"

# Wait and health check
sleep 2
if curl -s http://127.0.0.1:8003/api/health | grep -q "healthy"; then
    echo "Deployment successful! Health check passed."
else
    echo "WARNING: Health check failed!"
    sudo systemctl status "$SERVICE_NAME" --no-pager
    exit 1
fi
