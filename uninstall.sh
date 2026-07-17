#!/bin/bash
# ==============================================================================
# uninstall.sh — Desinstalación limpia del proyecto Go2
# Plataforma: Unitree Go2 · Ubuntu 20.04 · ARM64
#
# Elimina todos los servicios, demonios, scripts y paquetes creados por init.sh
# para que el usuario pueda volver a ejecutar init.sh desde cero.
#
# Ejecutar como:  chmod +x uninstall.sh && sudo ./uninstall.sh
# ==============================================================================

set -euo pipefail

# ── Colores ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
BOLD='\033[1m'
NC='\033[0m'

# ── Verificar ejecución como root ─────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}[ERROR] Este script debe ejecutarse como root (sudo ./uninstall.sh)${NC}"
    exit 1
fi

REAL_USER="${SUDO_USER:-$USER}"
REAL_HOME=$(eval echo "~${REAL_USER}")
XVR_DIR="${REAL_HOME}/Documents/unitree-xvr-stream"

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║     Unitree Go2 — Desinstalación                            ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${YELLOW}${BOLD}  ADVERTENCIA: Este script eliminará:${NC}"
echo ""
echo -e "    • Servicio y timer de ruta por defecto"
echo -e "    • Dispatcher de NetworkManager"
echo -e "    • Script de ruta (/usr/local/bin/go2-default-route.sh)"
echo -e "    • Servicio y timer de Auto-Updater (go2-repo-updater)"
echo -e "    • Script del updater (/usr/local/bin/go2-repo-updater.sh)"
    echo -e "    • Servicio de run.py (go2-xvr-stream)"
echo -e "    • Servicio de MediaMTX (go2-mediamtx)"
echo -e "    • Paquete ffmpeg"
echo -e "    • Entorno virtual Python (${XVR_DIR}/venv)"
echo ""

read -rp "$(echo -e "${RED}${BOLD}  ¿Estás seguro? Escribe 'SI' para confirmar: ${NC}")" CONFIRM

if [[ "$CONFIRM" != "SI" ]]; then
    echo ""
    echo -e "  ${CYAN}Cancelado. No se realizaron cambios.${NC}"
    echo ""
    exit 0
fi

echo ""

# ==============================================================================
# 1. DETENER Y DESHABILITAR SERVICIOS
# ==============================================================================

SERVICES=(
    "go2-xvr-stream.service"
    "go2-mediamtx.service"
    "go2-repo-updater.timer"
    "go2-repo-updater.service"
    "go2-default-route.timer"
    "go2-default-route.service"
)

echo -e "${YELLOW}[1/5]${NC} Deteniendo y deshabilitando servicios..."

for svc in "${SERVICES[@]}"; do
    printf "  %-40s " "$svc"
    if systemctl is-active "$svc" &>/dev/null; then
        systemctl stop "$svc" 2>/dev/null || true
    fi
    if systemctl is-enabled "$svc" &>/dev/null; then
        systemctl disable "$svc" 2>/dev/null || true
    fi
    echo -e "${GREEN}✔${NC}"
done

echo ""

# ==============================================================================
# 2. ELIMINAR ARCHIVOS DE SERVICIOS SYSTEMD
# ==============================================================================

echo -e "${YELLOW}[2/5]${NC} Eliminando archivos de servicios..."

UNIT_FILES=(
    "/etc/systemd/system/go2-xvr-stream.service"
    "/etc/systemd/system/go2-mediamtx.service"
    "/etc/systemd/system/go2-repo-updater.service"
    "/etc/systemd/system/go2-repo-updater.timer"
    "/etc/systemd/system/go2-default-route.service"
    "/etc/systemd/system/go2-default-route.timer"
)

for f in "${UNIT_FILES[@]}"; do
    printf "  %-55s " "$f"
    if [[ -f "$f" ]]; then
        rm -f "$f"
        echo -e "${GREEN}eliminado${NC}"
    else
        echo -e "${GRAY}no existía${NC}"
    fi
done

systemctl daemon-reload
echo -e "  ${GREEN}✔ systemctl daemon-reload${NC}"
echo ""

# ==============================================================================
# 3. ELIMINAR SCRIPTS Y DISPATCHER
# ==============================================================================

echo -e "${YELLOW}[3/5]${NC} Eliminando scripts auxiliares..."

AUX_FILES=(
    "/usr/local/bin/go2-default-route.sh"
    "/usr/local/bin/go2-repo-updater.sh"
    "/etc/NetworkManager/dispatcher.d/99-go2-default-route"
)

for f in "${AUX_FILES[@]}"; do
    printf "  %-55s " "$f"
    if [[ -f "$f" ]]; then
        rm -f "$f"
        echo -e "${GREEN}eliminado${NC}"
    else
        echo -e "${GRAY}no existía${NC}"
    fi
done

echo ""

# ==============================================================================
# 4. DESINSTALAR FFMPEG
# ==============================================================================

echo -e "${YELLOW}[4/5]${NC} Desinstalando ffmpeg..."

if dpkg -l ffmpeg &>/dev/null 2>&1; then
    apt remove -y ffmpeg
    echo -e "  ${GREEN}✔ ffmpeg desinstalado${NC}"
else
    echo -e "  ${GRAY}  ffmpeg no estaba instalado${NC}"
fi

echo ""

# ==============================================================================
# 5. ELIMINAR ENTORNO VIRTUAL PYTHON
# ==============================================================================

echo -e "${YELLOW}[5/5]${NC} Eliminando entorno virtual Python..."

VENV_DIR="${XVR_DIR}/venv"
if [[ -d "$VENV_DIR" ]]; then
    rm -rf "$VENV_DIR"
    echo -e "  ${GREEN}✔ ${VENV_DIR} eliminado${NC}"
else
    echo -e "  ${GRAY}  ${VENV_DIR} no existía${NC}"
fi

echo ""

# ==============================================================================
# RESUMEN
# ==============================================================================

echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║               Desinstalación completada                      ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Todos los servicios y archivos creados por ${BOLD}init.sh${NC} fueron eliminados."
echo -e "  Puedes volver a ejecutar ${CYAN}sudo ./init.sh${NC} para reinstalar."
echo ""
echo -e "  ${GRAY}Nota: El código fuente en ${XVR_DIR} NO fue tocado,${NC}"
echo -e "  ${GRAY}solo se eliminó la carpeta venv/.${NC}"
echo -e "  ${GRAY}Las licencias y la carpeta config/ (license.lic, .device_fingerprint,${NC}"
echo -e "  ${GRAY}.clock_state, .license_activated_at, .env) tampoco se tocaron.${NC}"
echo ""
