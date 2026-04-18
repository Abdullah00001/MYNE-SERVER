# 🚀 Quick Deployment Reference

## Quick Start (TL;DR)

```bash
# 1. Clone repo
git clone your-repo-url
cd your-project

# 2. Configure environment
cp .env.example .env
nano .env  # Edit with your values

# 3. Deploy
chmod +x deploy.sh
./deploy.sh

# Done! 🎉
```

---

## Essential Commands

### Deployment

```bash
./deploy.sh              # Full deployment
./deploy.sh build        # Build only
./deploy.sh start        # Start services
./deploy.sh stop         # Stop services
./deploy.sh restart      # Restart services
./deploy.sh logs         # View logs
./deploy.sh status       # Check status
./deploy.sh health       # Health check
```

### Docker Compose

```bash
docker compose up -d              # Start in background
docker compose down               # Stop all services
docker compose ps                 # List containers
docker compose logs -f            # Follow logs
docker compose logs -f server     # Server logs only
docker compose restart server     # Restart server
docker compose build --no-cache   # Force rebuild
```

### Monitoring

```bash
docker stats                      # Real-time stats
docker compose ps                 # Container status
docker compose logs --tail=50     # Last 50 log lines
docker system df                  # Disk usage
```

---

## File Structure

```
your-project/
├── Dockerfile                 # Production Docker image
├── docker-compose.yml         # Production orchestration
├── .dockerignore             # Files to exclude from build
├── nginx.conf                # Reverse proxy config
├── .env                      # Environment variables (create this)
├── .env.example              # Environment template
├── deploy.sh                 # Deployment script
├── README-DEPLOYMENT.md      # Full deployment guide
└── src/                      # Your application code
```

---

## Environment Variables Priority

**MUST CONFIGURE:**

- `MONGODB_URI` - Your MongoDB connection string
- `REDIS_PASSWORD` - Strong Redis password
- `JWT_SECRET` - Strong JWT secret (min 32 chars)
- `JWT_REFRESH_SECRET` - Strong refresh secret

**SHOULD CONFIGURE:**

- `EMAIL_*` - Email service credentials
- `AWS_*` - AWS S3 credentials (if using)
- `ALLOWED_ORIGINS` - CORS origins

---

## Ports

- **5000** - Application server
- **6379** - Redis
- **80** - HTTP (Nginx)
- **443** - HTTPS (Nginx, requires SSL)

---

## Health Checks

```bash
# Check application health
curl http://localhost:5000/health

# With Nginx
curl http://localhost/health

# Check Redis
docker compose exec redis redis-cli -a your_password ping
```

---

## Common Issues

### Port Already in Use

```bash
sudo lsof -i :5000
sudo kill -9 <PID>
```

### Container Won't Start

```bash
docker compose logs server
docker compose down
docker compose up -d
```

### Out of Memory

```bash
docker system prune -a
docker volume prune
```

### Permission Denied

```bash
chmod +x deploy.sh
sudo chown -R $USER:$USER .
```

---

## Security Checklist

- [ ] Strong passwords in `.env`
- [ ] UFW firewall enabled
- [ ] SSL certificate installed
- [ ] Non-root user for deployment
- [ ] `.env` file not committed to git
- [ ] Regular backups scheduled
- [ ] Rate limiting configured
- [ ] CORS properly configured

---

## Update Process

```bash
# 1. Pull latest code
git pull origin main

# 2. Rebuild and restart
docker compose down
docker compose build --no-cache
docker compose up -d

# 3. Check health
curl http://localhost:5000/health
docker compose logs -f server
```

---

## Backup & Restore

### Backup Redis

```bash
docker compose exec redis redis-cli -a password SAVE
docker cp sofiajamale_redis:/data/dump.rdb ./backup/
```

### Restore Redis

```bash
docker compose down redis
docker cp ./backup/dump.rdb sofiajamale_redis:/data/
docker compose up -d redis
```

---

## Performance Tuning

For 2GB RAM server:

```yaml
# In docker-compose.yml
deploy:
  resources:
    limits:
      memory: 1G
    reservations:
      memory: 512M
```

For 4GB+ RAM server:

```yaml
# In docker-compose.yml
deploy:
  resources:
    limits:
      memory: 2G
    reservations:
      memory: 1G
```

---

## Support

- **Full Guide**: See `README-DEPLOYMENT.md`
- **Logs**: `docker compose logs -f`
- **Status**: `docker compose ps`
- **Health**: `curl http://localhost:5000/health`

---

**Remember**: Always test in development before deploying to production! 🛡️
