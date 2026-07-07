#!/bin/bash
# ==============================================================================
# init.sh — Inicialización del proyecto unitree-xvr-stream
# Plataforma: Unitree Go2 · Ubuntu 20.04 · ARM64
#
# Ejecutar como:  chmod +x init.sh && sudo ./init.sh
# ==============================================================================

set -euo pipefail

# ── Colores ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Verificar ejecución como root ─────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}[ERROR] Este script debe ejecutarse como root (sudo ./init.sh)${NC}"
    exit 1
fi

REAL_USER="${SUDO_USER:-$USER}"
REAL_HOME=$(eval echo "~${REAL_USER}")
XVR_DIR="${REAL_HOME}/Documents/unitree-xvr-stream"

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║     Unitree XVR Stream — Inicialización de proyecto           ║${NC}"
echo -e "${CYAN}${BOLD}║     Ubuntu 20.04 · ARM64                                    ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ==============================================================================
# 1. CONFIGURACIÓN DE RED
# ==============================================================================

echo -e "${BOLD}┌─────────────────────────────────────────────────┐${NC}"
echo -e "${BOLD}│  Configuración de interfaz de red                │${NC}"
echo -e "${BOLD}└─────────────────────────────────────────────────┘${NC}"
echo ""
echo -e "  ${YELLOW}1)${NC} Adaptador inalámbrico (wlan0)"
echo -e "  ${YELLOW}2)${NC} Ethernet directo al router (eth1)"
echo ""

while true; do
    read -rp "$(echo -e "${CYAN}Selecciona una opción [1/2]: ${NC}")" NET_OPTION
    case "$NET_OPTION" in
        1) NET_IFACE="wlan0";  break ;;
        2) NET_IFACE="eth1";   break ;;
        *) echo -e "${RED}  Opción inválida. Escribe 1 o 2.${NC}" ;;
    esac
done

echo -e "${GREEN}  ✔ Interfaz seleccionada: ${BOLD}${NET_IFACE}${NC}"
echo ""

while true; do
    read -rp "$(echo -e "${CYAN}Escribe el gateway de la red (ej. 192.168.1.1): ${NC}")" GATEWAY
    if [[ "$GATEWAY" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        break
    else
        echo -e "${RED}  Formato inválido. Usa formato IPv4: 192.168.xxx.xxx${NC}"
    fi
done

echo -e "${GREEN}  ✔ Gateway: ${BOLD}${GATEWAY}${NC}"
echo ""

# ── Crear script de ruta por defecto ──────────────────────────────────────────
ROUTE_SCRIPT="/usr/local/bin/go2-default-route.sh"

echo -e "${YELLOW}[1/6]${NC} Configurando ruta por defecto persistente..."

cat > "$ROUTE_SCRIPT" <<ROUTEOF
#!/bin/bash
# Añade/reemplaza la ruta por defecto para salida a internet del Go2.
# Interfaz: ${NET_IFACE} | Gateway: ${GATEWAY}

IFACE="${NET_IFACE}"
GW="${GATEWAY}"

# Solo actuar si la interfaz existe y está UP
if ip link show "\$IFACE" 2>/dev/null | grep -q "state UP"; then
    # Eliminar ruta previa por esta interfaz (si existe) para evitar duplicados
    ip route del default dev "\$IFACE" 2>/dev/null || true
    ip route add default via "\$GW" dev "\$IFACE" metric 50 2>/dev/null || true
fi
ROUTEOF
chmod +x "$ROUTE_SCRIPT"

# ── Systemd service: ejecutar al arranque ─────────────────────────────────────
cat > /etc/systemd/system/go2-default-route.service <<EOF
[Unit]
Description=Go2 — Ruta por defecto via ${NET_IFACE}
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=${ROUTE_SCRIPT}
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

# ── Systemd timer: cada 5 minutos ────────────────────────────────────────────
cat > /etc/systemd/system/go2-default-route.timer <<EOF
[Unit]
Description=Go2 — Reaplicar ruta cada 5 minutos

[Timer]
OnBootSec=30
OnUnitActiveSec=5min
AccuracySec=30

[Install]
WantedBy=timers.target
EOF

# ── NetworkManager dispatcher: al reconectar la interfaz ──────────────────────
NM_DISPATCH_DIR="/etc/NetworkManager/dispatcher.d"
mkdir -p "$NM_DISPATCH_DIR"

cat > "${NM_DISPATCH_DIR}/99-go2-default-route" <<DISPEOF
#!/bin/bash
# Se dispara cuando NetworkManager detecta cambios en las interfaces.
IFACE_EVENT="\$1"
ACTION="\$2"

if [[ "\$IFACE_EVENT" == "${NET_IFACE}" && "\$ACTION" == "up" ]]; then
    ${ROUTE_SCRIPT}
fi
DISPEOF
chmod +x "${NM_DISPATCH_DIR}/99-go2-default-route"

# ── Habilitar servicios ──────────────────────────────────────────────────────
systemctl daemon-reload
systemctl enable --now go2-default-route.service
systemctl enable --now go2-default-route.timer

echo -e "${GREEN}  ✔ Ruta por defecto configurada y persistente${NC}"
echo -e "${GREEN}    · Servicio al arranque: go2-default-route.service${NC}"
echo -e "${GREEN}    · Timer cada 5 min:     go2-default-route.timer${NC}"
echo -e "${GREEN}    · Dispatcher NM:        99-go2-default-route${NC}"
echo ""

# ==============================================================================
# 1.5 CONFIGURACIÓN DE ZONA HORARIA Y HORA
# ==============================================================================

echo -e "${BOLD}┌─────────────────────────────────────────────────┐${NC}"
echo -e "${BOLD}│  Configuración de Zona Horaria (Timezone)        │${NC}"
echo -e "${BOLD}└─────────────────────────────────────────────────┘${NC}"
echo ""
echo -e "  Selecciona la zona horaria para el robot:"
echo -e "  ${YELLOW}1)${NC} Zona Centro / CDMX (America/Mexico_City)"
echo -e "  ${YELLOW}2)${NC} Zona Montaña / Chihuahua (America/Chihuahua)"
echo -e "  ${YELLOW}3)${NC} Zona Pacífico / Tijuana (America/Tijuana)"
echo -e "  ${YELLOW}4)${NC} Mantener actual / Saltar"
echo ""

while true; do
    read -rp "$(echo -e "${CYAN}Selecciona una opción [1-4]: ${NC}")" TIME_OPTION
    case "$TIME_OPTION" in
        1) TZ_ZONE="America/Mexico_City"; break ;;
        2) TZ_ZONE="America/Chihuahua";   break ;;
        3) TZ_ZONE="America/Tijuana";     break ;;
        4) TZ_ZONE="";                    break ;;
        *) echo -e "${RED}  Opción inválida. Escribe un número del 1 al 4.${NC}" ;;
    esac
done

if [[ -n "$TZ_ZONE" ]]; then
    echo -e "${YELLOW}[1.5/6]${NC} Aplicando zona horaria ${BOLD}${TZ_ZONE}${NC}..."
    
    # 1. Ajustar la zona horaria del sistema
    timedatectl set-timezone "$TZ_ZONE"
    
    # 2. Habilitar la sincronización de red NTP
    timedatectl set-ntp true
    
    # 3. Forzar el reinicio del demonio de tiempo para que busque internet con la nueva zona
    systemctl restart systemd-timesyncd
    
    echo -e "${GREEN}  ✔ Zona horaria establecida correctamente a $TZ_ZONE${NC}"
else
    echo -e "${YELLOW}  · Configuración de zona horaria omitida.${NC}"
fi
echo ""

# ==============================================================================
# 2. INSTALAR DEPENDENCIAS DEL SISTEMA
# ==============================================================================

echo -e "${YELLOW}[2/6]${NC} Instalando ffmpeg y python3.8-venv (sin actualizar paquetes existentes)..."
apt install --no-upgrade -y ffmpeg python3.8-venv
echo -e "${GREEN}  ✔ Paquetes del sistema instalados${NC}"
echo ""

# ==============================================================================
# 3. CREAR ENTORNO VIRTUAL DE PYTHON
# ==============================================================================

echo -e "${YELLOW}[3/6]${NC} Creando entorno virtual en ${XVR_DIR}..."

if [[ ! -d "$XVR_DIR" ]]; then
    echo -e "${RED}[ERROR] No se encontró el directorio ${XVR_DIR}${NC}"
    echo -e "${RED}        Asegúrate de que el proyecto unitree-xvr-stream esté clonado ahí.${NC}"
    exit 1
fi

cd "$XVR_DIR"
sudo -u "$REAL_USER" python3 -m venv venv
echo -e "${GREEN}  ✔ Entorno virtual creado en ${XVR_DIR}/venv${NC}"
echo ""

# ==============================================================================
# 4. INSTALAR DEPENDENCIAS DE PYTHON
# ==============================================================================

echo -e "${YELLOW}[4/6]${NC} Instalando dependencias de Python (requirements.txt)..."

if [[ ! -f "${XVR_DIR}/requirements.txt" ]]; then
    echo -e "${RED}[ERROR] No se encontró ${XVR_DIR}/requirements.txt${NC}"
    exit 1
fi

sudo -u "$REAL_USER" bash -c "
    source '${XVR_DIR}/venv/bin/activate'
    pip install --upgrade pip
    pip install -r '${XVR_DIR}/requirements.txt'
"
echo -e "${GREEN}  ✔ Dependencias de Python instaladas${NC}"
echo ""

# ==============================================================================
# 5. DEMONIO: mediamtx (debe existir antes de go2-xvr-stream)
# ==============================================================================

echo -e "${YELLOW}[5/6]${NC} Creando servicio systemd para mediamtx..."

MEDIAMTX_DIR="${XVR_DIR}/config"
MEDIAMTX_BIN="${MEDIAMTX_DIR}/mediamtx"
MEDIAMTX_CFG="${MEDIAMTX_DIR}/mediamtx.yml"

if [[ ! -f "$MEDIAMTX_BIN" ]]; then
    echo -e "${RED}[ERROR] No se encontró ${MEDIAMTX_BIN}${NC}"
    echo -e "${RED}        El binario mediamtx debe estar en config/mediamtx${NC}"
    exit 1
fi

chmod +x "$MEDIAMTX_BIN"

cat > /etc/systemd/system/go2-mediamtx.service <<EOF
[Unit]
Description=Go2 — MediaMTX RTSP Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${MEDIAMTX_DIR}
ExecStart=${MEDIAMTX_BIN} ${MEDIAMTX_CFG}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now go2-mediamtx.service

echo -e "${GREEN}  ✔ Servicio go2-mediamtx.service habilitado e iniciado${NC}"
echo ""

# ==============================================================================
# 6. DEMONIO: unitree-xvr-stream (run.py → app_fastapi compilado)
# ==============================================================================

echo -e "${YELLOW}[6/6]${NC} Creando servicio systemd para run.py..."

cat > /etc/systemd/system/go2-xvr-stream.service <<EOF
[Unit]
Description=Go2 — XVR Stream (run.py)
After=network-online.target go2-mediamtx.service
Wants=network-online.target
Requires=go2-mediamtx.service

[Service]
Type=simple
User=${REAL_USER}
WorkingDirectory=${XVR_DIR}
ExecStart=${XVR_DIR}/venv/bin/python3 ${XVR_DIR}/run.py
Restart=always
RestartSec=5
Environment=PATH=${XVR_DIR}/venv/bin:/usr/local/bin:/usr/bin:/bin
Environment=SYSCOM_PORTAL_URL=https://unitree.syscom.mx

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now go2-xvr-stream.service

echo -e "${GREEN}  ✔ Servicio go2-xvr-stream.service habilitado e iniciado${NC}"
echo ""

# ==============================================================================
# RESUMEN FINAL
# ==============================================================================

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║                  Instalación completada                      ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Red${NC}"
echo -e "    Interfaz:  ${GREEN}${NET_IFACE}${NC}"
echo -e "    Gateway:   ${GREEN}${GATEWAY}${NC}"
echo -e "    Ruta:      ip route add default via ${GATEWAY} dev ${NET_IFACE} metric 50"
echo ""
echo -e "  ${BOLD}Servicios systemd${NC}"
echo -e "    ${GREEN}●${NC} go2-default-route.service  — Ruta por defecto al arranque"
echo -e "    ${GREEN}●${NC} go2-default-route.timer    — Reaplicar ruta cada 5 min"
echo -e "    ${GREEN}●${NC} go2-xvr-stream.service     — run.py (siempre encendido)"
echo -e "    ${GREEN}●${NC} go2-mediamtx.service       — MediaMTX RTSP (siempre encendido)"
echo ""
echo -e "  ${BOLD}Comandos útiles${NC}"
echo -e "    Ver estado:    ${CYAN}sudo systemctl status go2-xvr-stream${NC}"
echo -e "    Ver logs:      ${CYAN}sudo journalctl -u go2-xvr-stream -f${NC}"
echo -e "    Reiniciar:     ${CYAN}sudo systemctl restart go2-xvr-stream${NC}"
echo -e "    Parar todo:    ${CYAN}sudo systemctl stop go2-xvr-stream go2-mediamtx${NC}"
echo ""
echo -e "  ${BOLD}Reconfigurar red${NC}"
echo -e "    Editar:        ${CYAN}sudo nano ${ROUTE_SCRIPT}${NC}"
echo -e "    Reaplicar:     ${CYAN}sudo systemctl restart go2-default-route${NC}"
echo ""
