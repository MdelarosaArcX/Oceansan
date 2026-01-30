# Build everything and start services
docker-compose up --build

# Detach and run in background
docker-compose up -d --build

# Stop containers
docker-compose down


# for backend
npm install -g .


## OCEANSAN Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `oceansan:start` | `pm2 start dist/server.js --name OceansanBackend` | Starts your backend **in the background** using PM2. |
| `oceansan:stop` | `pm2 stop OceansanBackend` | Stops the backend process **without deleting it** from PM2. |
| `oceansan:restart` | `pm2 restart OceansanBackend` | Restarts the backend process if you made changes or it crashed. |
| `oceansan:logs` | `pm2 logs OceansanBackend` | View **live logs** from your backend. Logs are also saved in `%USERPROFILE%\.pm2\logs`. |
| `oceansan:delete` | `pm2 delete OceansanBackend` | Completely removes the backend from PM2 management. |
| `oceansan:save` | `pm2 save` | Saves the current PM2 process list so it **auto-starts on Windows boot**. |
