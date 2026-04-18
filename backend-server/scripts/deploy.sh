#!/bin/bash

# ============================================
# Production Deployment Script
# ============================================

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check .env file
    if [ ! -f .env ]; then
        log_error ".env file not found. Please create it from .env.example"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

check_env_variables() {
    log_info "Checking required environment variables..."
    
    required_vars=(
        "NODE_ENV"
        "PORT"
        "REDIS_PASSWORD"
        "MONGODB_URI"
        "JWT_SECRET"
        "JWT_REFRESH_SECRET"
    )
    
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" .env || grep -q "^${var}=$" .env; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        log_error "Missing or empty environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        exit 1
    fi
    
    log_success "Environment variables check passed"
}

backup_current() {
    log_info "Creating backup of current deployment..."
    
    BACKUP_DIR="backups"
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).tar.gz"
    
    mkdir -p $BACKUP_DIR
    
    if [ -d "dist" ]; then
        tar -czf $BACKUP_DIR/$BACKUP_FILE dist node_modules .env 2>/dev/null || true
        log_success "Backup created: $BACKUP_DIR/$BACKUP_FILE"
    else
        log_warning "No previous deployment found to backup"
    fi
}

build_application() {
    log_info "Building Docker images..."
    
    if docker compose build --no-cache; then
        log_success "Docker images built successfully"
    else
        log_error "Failed to build Docker images"
        exit 1
    fi
}

stop_services() {
    log_info "Stopping existing services..."
    
    if docker compose down; then
        log_success "Services stopped"
    else
        log_warning "No services were running"
    fi
}

start_services() {
    log_info "Starting services..."
    
    if docker compose up -d; then
        log_success "Services started successfully"
    else
        log_error "Failed to start services"
        exit 1
    fi
}

health_check() {
    log_info "Performing health check..."
    
    MAX_ATTEMPTS=30
    ATTEMPT=0
    
    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        if curl -f http://localhost:5000/health &> /dev/null; then
            log_success "Health check passed"
            return 0
        fi
        
        ATTEMPT=$((ATTEMPT + 1))
        echo -n "."
        sleep 2
    done
    
    echo ""
    log_error "Health check failed after $MAX_ATTEMPTS attempts"
    log_info "Checking logs..."
    docker compose logs server
    exit 1
}

show_status() {
    log_info "Container status:"
    docker compose ps
    
    echo ""
    log_info "Application logs (last 20 lines):"
    docker compose logs --tail=20 server
}

cleanup() {
    log_info "Cleaning up unused Docker resources..."
    
    docker system prune -f
    log_success "Cleanup completed"
}

# Main deployment flow
main() {
    echo "============================================"
    echo "  Production Deployment Script"
    echo "============================================"
    echo ""
    
    check_prerequisites
    check_env_variables
    backup_current
    stop_services
    build_application
    start_services
    
    # Wait a bit for services to initialize
    sleep 5
    
    health_check
    show_status
    cleanup
    
    echo ""
    echo "============================================"
    log_success "Deployment completed successfully! 🎉"
    echo "============================================"
    echo ""
    log_info "Your application is running at:"
    echo "  - Health: http://localhost:5000/health"
    echo "  - Nginx:  http://localhost (if configured)"
    echo ""
    log_info "Useful commands:"
    echo "  - View logs:    docker compose logs -f"
    echo "  - Stop:         docker compose down"
    echo "  - Restart:      docker compose restart"
    echo ""
}

# Handle script arguments
case "${1:-}" in
    "build")
        build_application
        ;;
    "start")
        start_services
        ;;
    "stop")
        stop_services
        ;;
    "restart")
        stop_services
        start_services
        ;;
    "logs")
        docker compose logs -f
        ;;
    "status")
        show_status
        ;;
    "health")
        health_check
        ;;
    "cleanup")
        cleanup
        ;;
    *)
        main
        ;;
esac