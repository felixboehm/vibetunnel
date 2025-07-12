#!/bin/bash

# VibeTunnel Linux Server Installation Script
# Supports Ubuntu 20.04+ and Debian 10+

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VIBETUNNEL_USER="vibetunnel"
VIBETUNNEL_DIR="/opt/vibetunnel"
VIBETUNNEL_PORT="${PORT:-4020}"
NODE_VERSION="20"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root"
        exit 1
    fi
}

detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
    else
        log_error "Cannot detect operating system"
        exit 1
    fi
    
    log_info "Detected OS: $OS $VERSION"
    
    case $OS in
        ubuntu|debian)
            log_success "Supported OS detected"
            ;;
        *)
            log_warning "Untested OS. Proceeding anyway..."
            ;;
    esac
}

update_system() {
    log_info "Updating system packages..."
    apt update
    apt upgrade -y
    log_success "System updated"
}

install_dependencies() {
    log_info "Installing dependencies..."
    apt install -y curl build-essential unzip git ufw
    log_success "Dependencies installed"
}

install_nodejs() {
    log_info "Installing Node.js $NODE_VERSION..."
    
    # Check if Node.js is already installed
    if command -v node &> /dev/null; then
        NODE_CURRENT=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ $NODE_CURRENT -ge $NODE_VERSION ]]; then
            log_success "Node.js $NODE_CURRENT is already installed"
            return
        fi
    fi
    
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs
    
    # Verify installation
    node_version=$(node --version)
    npm_version=$(npm --version)
    log_success "Node.js $node_version and npm $npm_version installed"
}

install_bun() {
    log_info "Installing Bun runtime..."
    
    # Check if Bun is already installed
    if command -v bun &> /dev/null; then
        log_success "Bun is already installed"
        return
    fi
    
    curl -fsSL https://bun.sh/install | bash
    
    # Add to PATH for current session
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    
    log_success "Bun runtime installed"
}

create_user() {
    log_info "Creating vibetunnel user..."
    
    if id "$VIBETUNNEL_USER" &>/dev/null; then
        log_success "User $VIBETUNNEL_USER already exists"
    else
        useradd --system --create-home --shell /bin/bash "$VIBETUNNEL_USER"
        log_success "User $VIBETUNNEL_USER created"
    fi
}

setup_directory() {
    log_info "Setting up application directory..."
    
    mkdir -p "$VIBETUNNEL_DIR"
    chown "$VIBETUNNEL_USER:$VIBETUNNEL_USER" "$VIBETUNNEL_DIR"
    
    log_success "Directory $VIBETUNNEL_DIR created"
}

clone_and_build() {
    log_info "Cloning VibeTunnel repository..."
    
    # Switch to vibetunnel user
    sudo -u "$VIBETUNNEL_USER" bash << EOF
cd "$VIBETUNNEL_DIR"

# Clone repository
if [[ -d "vibetunnel" ]]; then
    log_warning "Repository already exists, pulling latest changes..."
    cd vibetunnel
    git pull
else
    git clone https://github.com/felixboehm/vibetunnel.git
    cd vibetunnel
fi

# Build web component
cd web
npm install
npm run build

log_success "VibeTunnel built successfully"
EOF
}

install_binary() {
    log_info "Installing VibeTunnel binary..."
    
    # Copy Linux server binary to system binary path
    cp "$VIBETUNNEL_DIR/vibetunnel/web/dist/vibetunnel-linux" /usr/local/bin/vibetunnel
    chmod +x /usr/local/bin/vibetunnel
    
    # Verify installation
    if /usr/local/bin/vibetunnel --version &>/dev/null; then
        log_success "VibeTunnel binary installed successfully"
    else
        log_error "Binary installation failed"
        exit 1
    fi
}

create_systemd_service() {
    log_info "Creating systemd service..."
    
    cat > /etc/systemd/system/vibetunnel.service << EOF
[Unit]
Description=VibeTunnel Web Terminal Server
After=network.target

[Service]
Type=simple
User=$VIBETUNNEL_USER
Group=$VIBETUNNEL_USER
WorkingDirectory=$VIBETUNNEL_DIR/vibetunnel/web
ExecStart=/usr/local/bin/vibetunnel
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Environment variables
Environment=NODE_ENV=production
Environment=PORT=$VIBETUNNEL_PORT
Environment=HOST=0.0.0.0

# Security settings
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=$VIBETUNNEL_DIR

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    log_success "Systemd service created"
}

configure_firewall() {
    log_info "Configuring firewall..."
    
    # Enable UFW if not already enabled
    if ! ufw status | grep -q "Status: active"; then
        ufw --force enable
    fi
    
    # Allow SSH and VibeTunnel port
    ufw allow 22/tcp comment 'SSH'
    ufw allow "$VIBETUNNEL_PORT/tcp" comment 'VibeTunnel'
    
    log_success "Firewall configured"
}

start_service() {
    log_info "Starting VibeTunnel service..."
    
    systemctl enable vibetunnel
    systemctl start vibetunnel
    
    # Wait a moment for service to start
    sleep 3
    
    if systemctl is-active --quiet vibetunnel; then
        log_success "VibeTunnel service started successfully"
    else
        log_error "Failed to start VibeTunnel service"
        log_info "Check logs with: sudo journalctl -u vibetunnel -f"
        exit 1
    fi
}

show_status() {
    echo
    echo "========================================"
    echo -e "${GREEN}VibeTunnel Installation Complete!${NC}"
    echo "========================================"
    echo
    echo "🚀 Service Status:"
    systemctl status vibetunnel --no-pager -l
    echo
    echo "🌐 Access your VibeTunnel server at:"
    echo "   http://$(curl -s ifconfig.me):$VIBETUNNEL_PORT"
    echo "   http://localhost:$VIBETUNNEL_PORT (local access)"
    echo
    echo "📋 Useful Commands:"
    echo "   sudo systemctl status vibetunnel     # Check service status"
    echo "   sudo systemctl restart vibetunnel    # Restart service"
    echo "   sudo systemctl stop vibetunnel       # Stop service"
    echo "   sudo journalctl -u vibetunnel -f     # View live logs"
    echo "   vibetunnel version                   # Check version"
    echo
    echo "🔧 Configuration:"
    echo "   Service file: /etc/systemd/system/vibetunnel.service"
    echo "   Application: $VIBETUNNEL_DIR/vibetunnel"
    echo "   Port: $VIBETUNNEL_PORT"
    echo
    echo "📖 Documentation: $VIBETUNNEL_DIR/vibetunnel/LINUX_SERVER.md"
    echo
}

main() {
    echo "========================================"
    echo "VibeTunnel Linux Server Installation"
    echo "========================================"
    echo
    
    check_root
    detect_os
    update_system
    install_dependencies
    install_nodejs
    install_bun
    create_user
    setup_directory
    clone_and_build
    install_binary
    create_systemd_service
    configure_firewall
    start_service
    show_status
    
    log_success "Installation completed successfully!"
}

# Run main function
main "$@"