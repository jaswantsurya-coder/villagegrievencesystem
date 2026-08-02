#!/bin/bash
# ============================================================
# GramSeva AI — Oracle Cloud ARM Deployment Script
# Automated setup for Ubuntu ARM (Ampere A1) instance
# ============================================================

set -euo pipefail

APP_DIR="/opt/gramseva/inference"
VENV_DIR="/opt/gramseva/venv"
MODELS_DIR="/opt/gramseva/models"
SERVICE_NAME="gramseva-ai"
PYTHON_VERSION="3.11"

echo "═══════════════════════════════════════════════"
echo "  GramSeva AI — Oracle Cloud ARM Deployment"
echo "═══════════════════════════════════════════════"

# ─── 1. System Dependencies ──────────────────────────────────────────────────
echo "[1/7] Installing system dependencies..."
sudo apt-get update -y
sudo apt-get install -y \
  python${PYTHON_VERSION} \
  python${PYTHON_VERSION}-venv \
  python${PYTHON_VERSION}-dev \
  build-essential \
  git \
  curl \
  nginx \
  certbot \
  python3-certbot-nginx

# ─── 2. Create Directory Structure ───────────────────────────────────────────
echo "[2/7] Setting up directories..."
sudo mkdir -p ${APP_DIR}
sudo mkdir -p ${MODELS_DIR}/adapters
sudo mkdir -p /var/log/gramseva

# Create gramseva user (if not exists)
if ! id -u gramseva &>/dev/null; then
  sudo useradd -r -s /bin/bash -d /opt/gramseva gramseva
fi
sudo chown -R gramseva:gramseva /opt/gramseva
sudo chown -R gramseva:gramseva /var/log/gramseva

# ─── 3. Copy Application Files ───────────────────────────────────────────────
echo "[3/7] Copying application files..."
# Copy inference server code
sudo cp -r . ${APP_DIR}/
# Copy gramseva_model adapter directory
if [ -d "../gramseva_model" ]; then
  sudo cp -r ../gramseva_model ${APP_DIR}/gramseva_model
  echo "  → LoRA adapter copied"
else
  echo "  ⚠ gramseva_model/ not found — you'll need to copy it manually"
fi
sudo chown -R gramseva:gramseva ${APP_DIR}

# ─── 4. Create Virtual Environment & Install Dependencies ────────────────────
echo "[4/7] Setting up Python virtual environment..."
sudo -u gramseva python${PYTHON_VERSION} -m venv ${VENV_DIR}
sudo -u gramseva ${VENV_DIR}/bin/pip install --upgrade pip wheel setuptools
sudo -u gramseva ${VENV_DIR}/bin/pip install -r ${APP_DIR}/requirements.txt

# ─── 5. Environment File ─────────────────────────────────────────────────────
echo "[5/7] Setting up environment..."
if [ ! -f "${APP_DIR}/.env" ]; then
  sudo cp ${APP_DIR}/.env.example ${APP_DIR}/.env
  sudo chown gramseva:gramseva ${APP_DIR}/.env
  sudo chmod 600 ${APP_DIR}/.env
  echo "  → .env created from template — EDIT IT with your Supabase keys!"
  echo "  → sudo nano ${APP_DIR}/.env"
fi

# ─── 6. Install systemd Service ──────────────────────────────────────────────
echo "[6/7] Installing systemd service..."
sudo cp ${APP_DIR}/gramseva-ai.service /etc/systemd/system/${SERVICE_NAME}.service
sudo systemctl daemon-reload
sudo systemctl enable ${SERVICE_NAME}

# ─── 7. Start Service ────────────────────────────────────────────────────────
echo "[7/7] Starting GramSeva AI service..."
sudo systemctl restart ${SERVICE_NAME}

# Wait for startup
echo "Waiting for model to load (this may take 1-3 minutes on first run)..."
for i in {1..60}; do
  if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo ""
    echo "═══════════════════════════════════════════════"
    echo "  ✅ GramSeva AI Server is RUNNING!"
    echo "═══════════════════════════════════════════════"
    echo ""
    echo "Health check:"
    curl -s http://localhost:8000/health | python${PYTHON_VERSION} -m json.tool
    echo ""
    echo "Useful commands:"
    echo "  sudo systemctl status ${SERVICE_NAME}"
    echo "  sudo journalctl -u ${SERVICE_NAME} -f"
    echo "  curl http://localhost:8000/health"
    echo ""
    echo "Next steps:"
    echo "  1. Edit .env: sudo nano ${APP_DIR}/.env"
    echo "  2. Restart: sudo systemctl restart ${SERVICE_NAME}"
    echo "  3. Optional: Setup nginx + HTTPS with certbot"
    exit 0
  fi
  printf "."
  sleep 5
done

echo ""
echo "⚠ Server did not respond within 5 minutes."
echo "Check logs: sudo journalctl -u ${SERVICE_NAME} -f"
exit 1
