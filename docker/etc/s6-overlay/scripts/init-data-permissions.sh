#!/command/with-contenv bash

echo "Starting init-data-permissions service"

GRIMOIRE_UID=$(id -u grimoire)
GRIMOIRE_GID=$(id -g grimoire)
echo "Grimoire user: UID=$GRIMOIRE_UID, GID=$GRIMOIRE_GID"

echo "Creating /app/data directory"
mkdir -p /app/data

# Check current ownership and fix if needed (also volume mounts)
DATA_OWNER=$(stat -c '%U' /app/data 2>/dev/null || echo "unknown")
echo "Current /app/data owner: $DATA_OWNER"

if [ "$DATA_OWNER" != "grimoire" ]; then
    echo "Fixing ownership of /app/data (was owned by $DATA_OWNER)"
    chown grimoire:grimoire /app/data
fi

# Ensure user-uploads dir exists
echo "Creating /app/data/user-uploads directory"
mkdir -p /app/data/user-uploads

echo "Setting ownership to grimoire:grimoire"
chown -R grimoire:grimoire /app/data

# Set proper permissions: owner can read/write/execute, group can read/execute, others can read/execute
echo "Setting directory permissions"
chmod 755 /app/data
chmod 755 /app/data/user-uploads

echo "Testing write permissions"
if ! su grimoire -c "touch /app/data/.test_write && rm -f /app/data/.test_write" 2>/dev/null; then
    echo "ERROR: grimoire user cannot write to /app/data"
    echo "Directory info:"
    ls -la /app/data
    exit 1
fi
echo "Write permissions verified"

# Check any existing database files have correct permissions
if [ -f /app/data/db.sqlite ]; then
    echo "Setting database file permissions"
    chown grimoire:grimoire /app/data/db.sqlite
    chmod 644 /app/data/db.sqlite
fi

# Check WAL and SHM files have correct permissions if they exist
if [ -f /app/data/db.sqlite-wal ]; then
    echo "Setting WAL file permissions"
    chown grimoire:grimoire /app/data/db.sqlite-wal
    chmod 644 /app/data/db.sqlite-wal
fi

if [ -f /app/data/db.sqlite-shm ]; then
    echo "Setting SHM file permissions"
    chown grimoire:grimoire /app/data/db.sqlite-shm
    chmod 644 /app/data/db.sqlite-shm
fi

echo "Data directory permissions initialized successfully"