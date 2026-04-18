# 🚀 Production Deployment Guide

Complete guide for deploying your Node.js/TypeScript application to production VPS (AWS EC2, Digital Ocean, Hostinger, Namecheap, etc.)

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [VPS Initial Setup](#vps-initial-setup)
3. [Deploy Application](#deploy-application)
4. [SSL Certificate Setup](#ssl-certificate-setup)
5. [Monitoring & Maintenance](#monitoring--maintenance)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### On Your Local Machine

- Docker and Docker Compose installed
- Git
- SSH key pair for VPS access

### VPS Requirements

- **OS**: Ubuntu 22.04 LTS (recommended) or Ubuntu 20.04 LTS
- **RAM**: Minimum 2GB (4GB+ recommended)
- **Storage**: Minimum 20GB
- **CPU**: 2 cores minimum

---

## 🖥️ VPS Initial Setup

### 1. Connect to Your VPS

```bash
ssh root@your_vps_ip
# or if using a different user
ssh username@your_vps_ip
```

### 2. Update System Packages

```bash
sudo apt update && sudo apt upgrade -y
```

### 3. Create a Non-Root User (Security Best Practice)

```bash
# Create new user
sudo adduser deployer

# Add to sudo group
sudo usermod -aG sudo deployer

# Switch to new user
su - deployer
```

### 4. Install Docker

```bash
# Remove old versions
sudo apt remove docker docker-engine docker.io containerd runc

# Install prerequisites
sudo apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER

# Apply new group membership
newgrp docker

# Verify installation
docker --version
docker compose version
```

### 5. Install Additional Tools

```bash
# Install Git
sudo apt install -y git

# Install UFW Firewall
sudo apt install -y ufw

# Configure Firewall
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 5000/tcp  # App (optional, for testing)
sudo ufw enable

# Check firewall status
sudo ufw status
```

### 6. Configure Swap (if needed for low RAM)

```bash
# Check existing swap
sudo swapon --show

# Create 2GB swap file (adjust size as needed)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make swap permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 🚢 Deploy Application

### 1. Clone Your Repository

```bash
# Navigate to home directory
cd ~

# Clone your repository
git clone https://github.com/yourusername/your-repo.git

# Enter project directory
cd your-repo
```

### 2. Set Up Environment Variables

```bash
# Create .env file from example
cp .env.example .env

# Edit with your production values
nano .env
```

**Important Environment Variables to Configure:**

```env
NODE_ENV=production
PORT=5000

# Generate strong passwords
REDIS_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 48)
JWT_REFRESH_SECRET=$(openssl rand -base64 48)

# MongoDB connection (use your actual connection string)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname

# AWS S3 credentials (if applicable)
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret

# Email configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password

# CORS - Add your frontend domain
ALLOWED_ORIGINS=https://yourdomain.com
```

### 3. Build and Start Services

```bash
# Build Docker images
docker compose build

# Start services in detached mode
docker compose up -d

# Check running containers
docker compose ps

# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f server
docker compose logs -f redis
docker compose logs -f nginx
```

### 4. Verify Deployment

```bash
# Test health endpoint
curl http://localhost/health

# Or if nginx is not configured
curl http://localhost:5000/health

# Check container status
docker compose ps

# View container resource usage
docker stats
```

---

## 🔒 SSL Certificate Setup (Let's Encrypt)

### Option 1: Using Certbot with Nginx

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Stop nginx container temporarily
docker compose stop nginx

# Obtain certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Certificates will be saved to:
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem

# Create ssl directory in project
mkdir -p ~/your-repo/ssl

# Copy certificates (run as root or with sudo)
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ~/your-repo/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ~/your-repo/ssl/
sudo chown $USER:$USER ~/your-repo/ssl/*

# Update nginx.conf - uncomment HTTPS server block
nano nginx.conf

# Restart nginx
docker compose up -d nginx
```

### Option 2: Using Certbot with Docker

Update `docker-compose.yml` to add certbot service:

```yaml
certbot:
  image: certbot/certbot
  container_name: certbot
  volumes:
    - ./ssl:/etc/letsencrypt
    - ./certbot-www:/var/www/certbot
  command: certonly --webroot --webroot-path=/var/www/certbot --email your-email@example.com --agree-tos --no-eff-email -d yourdomain.com -d www.yourdomain.com
```

### Auto-Renewal Setup

```bash
# Test renewal
sudo certbot renew --dry-run

# Create renewal script
cat > ~/renew-certs.sh << 'EOF'
#!/bin/bash
sudo certbot renew --quiet
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ~/your-repo/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ~/your-repo/ssl/
cd ~/your-repo && docker compose restart nginx
EOF

chmod +x ~/renew-certs.sh

# Add to crontab (runs every Monday at 3 AM)
(crontab -l 2>/dev/null; echo "0 3 * * 1 ~/renew-certs.sh") | crontab -
```

---

## 📊 Monitoring & Maintenance

### Container Management

```bash
# View all containers
docker compose ps

# View logs
docker compose logs -f

# Restart specific service
docker compose restart server

# Stop all services
docker compose down

# Remove everything including volumes
docker compose down -v

# Update application
git pull origin main
docker compose build
docker compose up -d
```

### System Monitoring

```bash
# Monitor Docker container stats
docker stats

# Check disk usage
df -h
docker system df

# Clean up unused Docker resources
docker system prune -a --volumes
```

### Database Backups (MongoDB)

```bash
# Create backup script
cat > ~/backup-mongodb.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=~/backups/mongodb

mkdir -p $BACKUP_DIR

# If using MongoDB Atlas (cloud)
# Use mongodump with connection string
mongodump --uri="$MONGODB_URI" --out=$BACKUP_DIR/backup_$DATE

# Compress backup
tar -czf $BACKUP_DIR/backup_$DATE.tar.gz $BACKUP_DIR/backup_$DATE
rm -rf $BACKUP_DIR/backup_$DATE

# Keep only last 7 backups
ls -t $BACKUP_DIR/*.tar.gz | tail -n +8 | xargs rm -f

echo "Backup completed: backup_$DATE.tar.gz"
EOF

chmod +x ~/backup-mongodb.sh

# Schedule daily backups at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * ~/backup-mongodb.sh") | crontab -
```

### Redis Persistence

Redis is configured with AOF (Append Only File) persistence. Data is automatically saved to `/data` volume.

---

## 🐛 Troubleshooting

### Application Won't Start

```bash
# Check logs
docker compose logs server

# Common issues:
# 1. Environment variables missing
nano .env

# 2. Port already in use
sudo lsof -i :5000
# Kill process if needed
sudo kill -9 <PID>

# 3. Build issues
docker compose build --no-cache
docker compose up -d
```

### Redis Connection Issues

```bash
# Check Redis logs
docker compose logs redis

# Test Redis connection
docker compose exec redis redis-cli -a your_redis_password ping

# Should return: PONG
```

### MongoDB Connection Issues

```bash
# Check connection string in .env
nano .env

# Test connection from server container
docker compose exec server node -e "const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(() => console.log('Connected!')).catch(e => console.error(e))"
```

### Memory Issues

```bash
# Check memory usage
free -h
docker stats

# Check swap
sudo swapon --show

# Restart services to free memory
docker compose restart
```

### Nginx Issues

```bash
# Test nginx configuration
docker compose exec nginx nginx -t

# View nginx logs
docker compose logs nginx

# Reload nginx configuration
docker compose exec nginx nginx -s reload
```

### High CPU Usage

```bash
# Check which process is consuming CPU
top
docker stats

# Check application logs for errors
docker compose logs server | grep -i error
```

---

## 🔄 Update & Rollback Strategy

### Update Application

```bash
# 1. Pull latest changes
git pull origin main

# 2. Backup current state (optional)
docker compose down
tar -czf backup_$(date +%Y%m%d).tar.gz .

# 3. Rebuild and deploy
docker compose build --no-cache
docker compose up -d

# 4. Check logs
docker compose logs -f server
```

### Rollback

```bash
# 1. Stop current version
docker compose down

# 2. Checkout previous version
git log --oneline
git checkout <previous-commit-hash>

# 3. Rebuild and start
docker compose build
docker compose up -d
```

---

## 📞 Support & Resources

### Useful Commands Cheat Sheet

```bash
# Docker Compose
docker compose up -d              # Start services
docker compose down               # Stop services
docker compose ps                 # List containers
docker compose logs -f            # Follow logs
docker compose restart <service>  # Restart service
docker compose build --no-cache   # Rebuild images

# Docker
docker ps                         # List running containers
docker logs <container_id>        # View container logs
docker exec -it <container> sh    # Enter container shell
docker system prune -a            # Clean up

# System
sudo systemctl status docker      # Check Docker service
sudo ufw status                   # Check firewall
df -h                            # Check disk space
free -h                          # Check memory
htop                             # Interactive process viewer
```

### Performance Tuning

**For production with 2GB+ RAM:**

Update `docker-compose.yml` resource limits:

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 2G
    reservations:
      cpus: '1.0'
      memory: 1G
```

### Security Checklist

- ✅ Using non-root user
- ✅ Firewall configured (UFW)
- ✅ Strong passwords for Redis, MongoDB
- ✅ SSL certificate installed
- ✅ Environment variables secured
- ✅ Regular backups scheduled
- ✅ Docker containers run as non-root
- ✅ Security headers configured in Nginx
- ✅ Rate limiting enabled

---

## 🎉 Deployment Complete!

Your application should now be running at:

- **HTTP**: `http://your_vps_ip` or `http://yourdomain.com`
- **HTTPS**: `https://yourdomain.com` (after SSL setup)

Monitor your application regularly and keep your system updated!

For issues, check logs first:

```bash
docker compose logs -f
```

---

**Need help?** Review the troubleshooting section or check container logs for specific error messages.
