#!/bin/bash
# ==============================================================================
# status.sh — Panel de estado y gestión de servicios Go2
# Plataforma: Unitree Go2 · Ubuntu 20.04 · ARM64
#
# Ejecutar como:  chmod +x status.sh && sudo ./status.sh
# ==============================================================================

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
    echo -e "${RED}[ERROR] Este script debe ejecutarse como root (sudo ./status.sh)${NC}"
    exit 1
fi

REAL_USER="${SUDO_USER:-$USER}"
REAL_HOME=$(eval echo "~${REAL_USER}")
XVR_DIR="${REAL_HOME}/Documents/unitree-xvr-stream"

# ── Servicios gestionados ─────────────────────────────────────────────────────
SERVICES=(
    "go2-xvr-stream.service"
    "go2-mediamtx.service"
    "go2-default-route.service"
    "go2-default-route.timer"
    "go2-repo-updater.timer"
)

SERVICE_LABELS=(
    "FastAPI (run.py)"
    "MediaMTX RTSP"
    "Ruta por defecto (arranque)"
    "Ruta por defecto (timer 5min)"
    "Auto-Updater GitHub (timer 10min)"
)

# ==============================================================================
# FUNCIONES
# ==============================================================================

print_header() {
    clear
    echo ""
    echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}${BOLD}║     Unitree Go2 — Panel de Estado                           ║${NC}"
    echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

get_service_status() {
    local svc="$1"
    if ! systemctl list-unit-files "$svc" &>/dev/null 2>&1; then
        echo "no-existe"
    elif systemctl is-active "$svc" &>/dev/null; then
        echo "activo"
    elif systemctl is-enabled "$svc" &>/dev/null; then
        echo "inactivo"
    else
        echo "deshabilitado"
    fi
}

format_status() {
    local status="$1"
    case "$status" in
        activo)        echo -e "${GREEN}● activo${NC}" ;;
        inactivo)      echo -e "${YELLOW}○ inactivo${NC}" ;;
        deshabilitado) echo -e "${RED}○ deshabilitado${NC}" ;;
        no-existe)     echo -e "${GRAY}✗ no instalado${NC}" ;;
    esac
}

show_dashboard() {
    print_header

    # ── Servicios ─────────────────────────────────────────────────────────────
    echo -e "  ${BOLD}Servicios systemd${NC}"
    echo -e "  ${GRAY}──────────────────────────────────────────────────────${NC}"

    for i in "${!SERVICES[@]}"; do
        local svc="${SERVICES[$i]}"
        local label="${SERVICE_LABELS[$i]}"
        local status
        status=$(get_service_status "$svc")
        local fmt
        fmt=$(format_status "$status")
        printf "  %-4s %-35s %b\n" "[$((i+1))]" "$label" "$fmt"
    done

    echo ""

    # ── FFmpeg ────────────────────────────────────────────────────────────────
    echo -e "  ${BOLD}Software${NC}"
    echo -e "  ${GRAY}──────────────────────────────────────────────────────${NC}"

    if command -v ffmpeg &>/dev/null; then
        local ffver
        ffver=$(ffmpeg -version 2>/dev/null | head -n1 | awk '{print $3}')
        echo -e "  ffmpeg                              ${GREEN}● instalado${NC} (${ffver})"
    else
        echo -e "  ffmpeg                              ${RED}✗ no instalado${NC}"
    fi

    if [[ -d "${XVR_DIR}/venv" ]]; then
        echo -e "  Python venv                         ${GREEN}● existe${NC}"
    else
        echo -e "  Python venv                         ${RED}✗ no existe${NC}"
    fi

    echo ""

    # ── Red ───────────────────────────────────────────────────────────────────
    echo -e "  ${BOLD}Red${NC}"
    echo -e "  ${GRAY}──────────────────────────────────────────────────────${NC}"

    if [[ -f /usr/local/bin/go2-default-route.sh ]]; then
        local iface gw
        iface=$(grep '^IFACE=' /usr/local/bin/go2-default-route.sh 2>/dev/null | cut -d'"' -f2)
        gw=$(grep '^GW=' /usr/local/bin/go2-default-route.sh 2>/dev/null | cut -d'"' -f2)
        echo -e "  Interfaz configurada:  ${GREEN}${iface:-?}${NC}"
        echo -e "  Gateway configurado:   ${GREEN}${gw:-?}${NC}"
    else
        echo -e "  ${YELLOW}  Ruta no configurada (ejecutar init.sh primero)${NC}"
    fi

    local default_route
    default_route=$(ip route show default 2>/dev/null | head -n3)
    if [[ -n "$default_route" ]]; then
        echo -e "  Rutas default activas:"
        while IFS= read -r line; do
            echo -e "    ${CYAN}${line}${NC}"
        done <<< "$default_route"
    else
        echo -e "  ${RED}  Sin ruta default activa${NC}"
    fi

    echo ""

    # ── Puertos ───────────────────────────────────────────────────────────────
    echo -e "  ${BOLD}Puertos en uso (servicios Go2)${NC}"
    echo -e "  ${GRAY}──────────────────────────────────────────────────────${NC}"

    local ports
    ports=$(ss -tlnp 2>/dev/null | grep -E '(mediamtx|python3|run\.py)' || true)
    if [[ -n "$ports" ]]; then
        while IFS= read -r line; do
            echo -e "    ${CYAN}${line}${NC}"
        done <<< "$ports"
    else
        echo -e "    ${GRAY}Ninguno detectado${NC}"
    fi

    echo ""
}

show_logs() {
    local svc="$1"
    local label="$2"
    echo ""
    echo -e "  ${BOLD}Últimas 20 líneas de log — ${label}${NC}"
    echo -e "  ${GRAY}──────────────────────────────────────────────────────${NC}"
    journalctl -u "$svc" --no-pager -n 20 2>/dev/null || echo -e "  ${GRAY}Sin logs disponibles${NC}"
    echo ""
    read -rp "$(echo -e "${GRAY}  Presiona Enter para volver al menú...${NC}")" _
}

manage_service() {
    local svc="$1"
    local label="$2"

    while true; do
        local status
        status=$(get_service_status "$svc")
        local fmt
        fmt=$(format_status "$status")

        echo ""
        echo -e "  ${BOLD}Gestionar: ${label}${NC}"
        echo -e "  Estado actual: ${fmt}"
        echo -e "  ${GRAY}──────────────────────────────────────────────────────${NC}"
        echo -e "  ${YELLOW}1)${NC} Iniciar"
        echo -e "  ${YELLOW}2)${NC} Detener"
        echo -e "  ${YELLOW}3)${NC} Reiniciar"
        echo -e "  ${YELLOW}4)${NC} Ver logs (últimas 20 líneas)"
        echo -e "  ${YELLOW}5)${NC} Ver logs en tiempo real (Ctrl+C para salir)"
        echo -e "  ${YELLOW}0)${NC} Volver"
        echo ""

        read -rp "$(echo -e "${CYAN}  Opción: ${NC}")" action
        case "$action" in
            1)
                systemctl start "$svc" && echo -e "  ${GREEN}✔ Iniciado${NC}" || echo -e "  ${RED}✗ Error al iniciar${NC}"
                sleep 1
                ;;
            2)
                systemctl stop "$svc" && echo -e "  ${GREEN}✔ Detenido${NC}" || echo -e "  ${RED}✗ Error al detener${NC}"
                sleep 1
                ;;
            3)
                systemctl restart "$svc" && echo -e "  ${GREEN}✔ Reiniciado${NC}" || echo -e "  ${RED}✗ Error al reiniciar${NC}"
                sleep 1
                ;;
            4)
                show_logs "$svc" "$label"
                ;;
            5)
                echo -e "  ${GRAY}Presiona Ctrl+C para volver...${NC}"
                journalctl -u "$svc" -f 2>/dev/null || true
                ;;
            0) break ;;
            *) echo -e "  ${RED}Opción inválida${NC}"; sleep 0.5 ;;
        esac
    done
}

bulk_action() {
    local action="$1"
    local label="$2"

    echo ""
    echo -e "  ${BOLD}${label} todos los servicios...${NC}"

    for i in "${!SERVICES[@]}"; do
        local svc="${SERVICES[$i]}"
        local slabel="${SERVICE_LABELS[$i]}"
        printf "  %-35s " "$slabel"
        if systemctl "$action" "$svc" 2>/dev/null; then
            echo -e "${GREEN}✔${NC}"
        else
            echo -e "${RED}✗${NC}"
        fi
    done

    echo ""
    read -rp "$(echo -e "${GRAY}  Presiona Enter para volver al menú...${NC}")" _
}

edit_route_config() {
    local route_script="/usr/local/bin/go2-default-route.sh"
    echo ""
    echo -e "  ${BOLD}Editar configuración de ruta por defecto${NC}"
    echo -e "  ${GRAY}──────────────────────────────────────────────────────${NC}"
    
    if [[ ! -f "$route_script" ]]; then
        echo -e "  ${RED}✗ El script de ruta no existe. Ejecuta init.sh primero.${NC}"
        read -rp "$(echo -e "${GRAY}  Presiona Enter para volver...${NC}")" _
        return
    fi
    
    local current_iface current_gw
    current_iface=$(grep '^IFACE=' "$route_script" 2>/dev/null | cut -d'"' -f2)
    current_gw=$(grep '^GW=' "$route_script" 2>/dev/null | cut -d'"' -f2)
    
    echo -e "  Valores actuales:"
    echo -e "  Interfaz: ${CYAN}${current_iface}${NC}"
    echo -e "  Gateway:  ${CYAN}${current_gw}${NC}"
    echo ""
    
    read -rp "  Nueva Interfaz (Ej: wlan0, eth1) [Enter para mantener]: " new_iface
    read -rp "  Nuevo Gateway  (Ej: 192.168.1.1) [Enter para mantener]: " new_gw
    
    new_iface=${new_iface:-$current_iface}
    new_gw=${new_gw:-$current_gw}
    
    if [[ -z "$new_iface" || -z "$new_gw" ]]; then
        echo -e "  ${RED}✗ Datos inválidos. No se aplicaron cambios.${NC}"
        sleep 1
        return
    fi
    
    # Reemplazar valores
    sed -i "s/^IFACE=\".*\"/IFACE=\"${new_iface}\"/" "$route_script"
    sed -i "s/^GW=\".*\"/GW=\"${new_gw}\"/" "$route_script"
    sed -i "s/^# Interfaz:.*/# Interfaz: ${new_iface} | Gateway: ${new_gw}/" "$route_script"
    
    if [[ -f /etc/systemd/system/go2-default-route.service ]]; then
        sed -i "s/^Description=Go2 — Ruta por defecto via .*/Description=Go2 — Ruta por defecto via ${new_iface}/" /etc/systemd/system/go2-default-route.service
        systemctl daemon-reload
    fi
    
    echo -e "  ${GREEN}✔ Configuración actualizada.${NC}"
    
    if systemctl restart go2-default-route.service; then
        echo -e "  ${GREEN}✔ Servicio go2-default-route reiniciado y ruta aplicada.${NC}"
    else
        echo -e "  ${RED}✗ Fallo al reiniciar el servicio.${NC}"
    fi
    
    echo ""
    read -rp "$(echo -e "${GRAY}  Presiona Enter para volver al menú...${NC}")" _
}

force_update_check() {
    echo ""
    echo -e "  ${BOLD}Buscar actualización en GitHub ahora${NC}"
    echo -e "  ${GRAY}──────────────────────────────────────────────────────${NC}"

    if ! systemctl list-unit-files "go2-repo-updater.service" &>/dev/null 2>&1; then
        echo -e "  ${RED}✗ El Auto-Updater no está instalado. Ejecuta init.sh primero.${NC}"
        read -rp "$(echo -e "${GRAY}  Presiona Enter para volver...${NC}")" _
        return
    fi

    echo -e "  ${CYAN}Ejecutando comprobación (git fetch + comparación de commits)...${NC}"
    echo -e "  ${GRAY}Si hay cambios, se aplicará el pull y se reiniciará el servicio.${NC}"
    echo ""

    systemctl start go2-repo-updater.service

    echo -e "  ${BOLD}Resultado (últimas líneas de log):${NC}"
    echo -e "  ${GRAY}──────────────────────────────────────────────────────${NC}"
    journalctl -u go2-repo-updater.service --no-pager -n 15 2>/dev/null || echo -e "  ${GRAY}Sin logs disponibles${NC}"
    echo ""
    read -rp "$(echo -e "${GRAY}  Presiona Enter para volver al menú...${NC}")" _
}

# ==============================================================================
# MENÚ PRINCIPAL
# ==============================================================================

while true; do
    show_dashboard

    echo -e "  ${BOLD}Acciones${NC}"
    echo -e "  ${GRAY}──────────────────────────────────────────────────────${NC}"
    echo -e "  ${YELLOW}1)${NC} Gestionar: FastAPI (run.py)"
    echo -e "  ${YELLOW}2)${NC} Gestionar: MediaMTX RTSP"
    echo -e "  ${YELLOW}3)${NC} Gestionar: Ruta por defecto (arranque)"
    echo -e "  ${YELLOW}4)${NC} Gestionar: Ruta por defecto (timer)"
    echo -e "  ${YELLOW}5)${NC} Gestionar: Auto-Updater GitHub (timer)"
    echo -e "  ${GRAY}──────────────────────────────────────────────────────${NC}"
    echo -e "  ${YELLOW}6)${NC} Iniciar TODOS los servicios"
    echo -e "  ${YELLOW}7)${NC} Detener TODOS los servicios"
    echo -e "  ${YELLOW}8)${NC} Reiniciar TODOS los servicios"
    echo -e "  ${GRAY}──────────────────────────────────────────────────────${NC}"
    echo -e "  ${YELLOW}9)${NC} Editar Interfaz y Gateway (Ruta por defecto)"
    echo -e "  ${YELLOW}10)${NC} Buscar actualización en GitHub AHORA"
    echo -e "  ${GRAY}──────────────────────────────────────────────────────${NC}"
    echo -e "  ${YELLOW}0)${NC} Salir"
    echo ""

    read -rp "$(echo -e "${CYAN}  Selecciona una opción: ${NC}")" choice

    case "$choice" in
        1) manage_service "go2-xvr-stream.service"     "FastAPI (run.py)"              ;;
        2) manage_service "go2-mediamtx.service"        "MediaMTX RTSP"                 ;;
        3) manage_service "go2-default-route.service"   "Ruta por defecto (arranque)"   ;;
        4) manage_service "go2-default-route.timer"     "Ruta por defecto (timer 5min)" ;;
        5) manage_service "go2-repo-updater.timer"      "Auto-Updater GitHub (timer 10min)" ;;
        6) bulk_action "start"   "Iniciando"   ;;
        7) bulk_action "stop"    "Deteniendo"  ;;
        8) bulk_action "restart" "Reiniciando" ;;
        9) edit_route_config ;;
        10) force_update_check ;;
        0)
            echo ""
            echo -e "  ${CYAN}Hasta luego.${NC}"
            echo ""
            exit 0
            ;;
        *) echo -e "  ${RED}Opción inválida${NC}"; sleep 0.5 ;;
    esac
done
