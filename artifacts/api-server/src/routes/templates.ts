import { Router } from "express";

const router = Router();

interface Template {
  id: string;
  name: string;
  description: string;
  category: "nginx" | "systemd" | "docker" | "deploy";
  language: string;
  content: string;
}

const TEMPLATES: Template[] = [
  {
    id: "nginx-node-proxy",
    name: "Nginx → Node.js Reverse Proxy",
    description:
      "Forwards traffic from port 80/443 to a Node.js app running on localhost:3000. Includes HTTPS redirect and WebSocket support.",
    category: "nginx",
    language: "nginx",
    content: `server {
    listen 80;
    server_name example.com www.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com www.example.com;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
`,
  },
  {
    id: "nginx-static",
    name: "Nginx Static File Server",
    description:
      "Serves a static React/Vite build from /var/www/app with gzip, caching headers, and SPA fallback.",
    category: "nginx",
    language: "nginx",
    content: `server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    root /var/www/app;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    location ~* \\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
`,
  },
  {
    id: "systemd-node",
    name: "systemd Unit — Node.js App",
    description:
      "Runs a Node.js application as a systemd service with auto-restart, environment file, and resource limits.",
    category: "systemd",
    language: "ini",
    content: `[Unit]
Description=My Node.js Application
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/app
EnvironmentFile=/var/www/app/.env
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=my-app

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/www/app

# Resource limits
LimitNOFILE=65535
MemoryMax=512M

[Install]
WantedBy=multi-user.target
`,
  },
  {
    id: "systemd-postgres-backup",
    name: "systemd Timer — Postgres Daily Backup",
    description:
      "Daily pg_dump backup to /var/backups/postgres with 7-day retention. Includes both .service and .timer units.",
    category: "systemd",
    language: "ini",
    content: `# /etc/systemd/system/postgres-backup.service
[Unit]
Description=PostgreSQL Daily Backup
Wants=postgres-backup.timer

[Service]
Type=oneshot
User=postgres
Environment=PGPASSWORD=your_password
ExecStart=/bin/bash -c 'pg_dump -U postgres mydb | gzip > /var/backups/postgres/mydb-$(date +%%Y%%m%%d).sql.gz'
ExecStartPost=/bin/bash -c 'find /var/backups/postgres -name "mydb-*.sql.gz" -mtime +7 -delete'

[Install]
WantedBy=multi-user.target

---

# /etc/systemd/system/postgres-backup.timer
[Unit]
Description=Run PostgreSQL backup daily at 2am

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target

# Enable with:
# systemctl enable --now postgres-backup.timer
`,
  },
  {
    id: "docker-compose-full",
    name: "Docker Compose — App + Postgres + Nginx",
    description:
      "Full production stack: Node.js API, PostgreSQL 16, and Nginx reverse proxy with SSL termination.",
    category: "docker",
    language: "yaml",
    content: `version: "3.9"

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - api
    restart: unless-stopped

  api:
    build: .
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgres://app:\${POSTGRES_PASSWORD}@postgres:5432/app
      SESSION_SECRET: \${SESSION_SECRET}
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}
      POSTGRES_DB: app
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  pgdata:
`,
  },
  {
    id: "deploy-ubuntu-script",
    name: "Ubuntu 20.04 Deploy Script",
    description:
      "Full bash script to provision a fresh Ubuntu 20.04 VPS: installs Node.js 20, pnpm, Postgres 16, Nginx, Certbot, and deploys your app from a GitHub repo.",
    category: "deploy",
    language: "bash",
    content: `#!/bin/bash
# Ubuntu 20.04 — First-time deployment script
# Usage: curl -fsSL https://your-server/deploy.sh | bash
set -euo pipefail

REPO_URL="https://github.com/your-org/your-repo.git"
APP_DIR="/var/www/app"
DOMAIN="example.com"
APP_USER="www-data"
NODE_VERSION="20"

echo "==> Updating system packages"
apt-get update -qq && apt-get upgrade -y -qq

echo "==> Installing Node.js $NODE_VERSION"
curl -fsSL https://deb.nodesource.com/setup_\${NODE_VERSION}.x | bash -
apt-get install -y nodejs

echo "==> Installing pnpm"
corepack enable
corepack prepare pnpm@latest --activate

echo "==> Installing PostgreSQL 16"
sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt focal-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
apt-get update -qq
apt-get install -y postgresql-16

echo "==> Installing Nginx + Certbot"
apt-get install -y nginx certbot python3-certbot-nginx

echo "==> Cloning repository"
mkdir -p $(dirname $APP_DIR)
git clone "$REPO_URL" "$APP_DIR"
chown -R $APP_USER:$APP_USER "$APP_DIR"

echo "==> Installing dependencies"
cd "$APP_DIR"
pnpm install --frozen-lockfile

echo "==> Building application"
pnpm run build

echo "==> Configuring Nginx"
cp deploy/nginx.conf.example /etc/nginx/sites-available/$DOMAIN
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

echo "==> Obtaining SSL certificate"
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN

echo "==> Setting up systemd service"
cp deploy/app.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable app
systemctl start app

echo ""
echo "✓ Deployment complete. App running at https://$DOMAIN"
echo "  Check status: systemctl status app"
echo "  View logs:    journalctl -u app -f"
`,
  },
  {
    id: "github-actions-deploy",
    name: "GitHub Actions — Deploy on Push",
    description:
      "CI/CD workflow that runs tests, builds the Docker image, pushes to GHCR, and SSHes into your Ubuntu server to deploy on every push to main.",
    category: "deploy",
    language: "yaml",
    content: `name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up pnpm
        uses: pnpm/action-setup@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - name: Install & test
        run: |
          pnpm install --frozen-lockfile
          pnpm test
          pnpm run build

      - name: Build Docker image
        run: |
          docker build -t ghcr.io/\${{ github.repository }}:latest .
          echo \${{ secrets.GITHUB_TOKEN }} | docker login ghcr.io -u \${{ github.actor }} --password-stdin
          docker push ghcr.io/\${{ github.repository }}:latest

      - name: Deploy to server
        uses: appleboy/ssh-action@v1
        with:
          host: \${{ secrets.SERVER_HOST }}
          username: \${{ secrets.SERVER_USER }}
          key: \${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /var/www/app
            git pull origin main
            docker compose pull
            docker compose up -d --build
            docker system prune -f
`,
  },
];

// GET /templates
router.get("/templates", (_req, res) => {
  const list = TEMPLATES.map(({ id, name, description, category, language }) => ({
    id,
    name,
    description,
    category,
    language,
  }));
  res.json(list);
});

// GET /templates/:templateId
router.get("/templates/:templateId", (req, res) => {
  const template = TEMPLATES.find((t) => t.id === req.params.templateId);
  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  res.json(template);
});

export default router;
