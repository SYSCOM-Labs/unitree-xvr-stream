#!/bin/bash
# ==============================================================================
# go2-repair.sh — Repara permisos y materializa la configuración del cliente
#
# Fuente única de verdad para:
#   · Crear config/settings.yaml y config/mediamtx.yml desde las plantillas
#     .example si todavía no existen (instalación limpia o rescate).
#   · Devolver el bit de ejecución a scripts y binarios.
#   · Devolver la propiedad de los archivos al usuario del servicio, para que el
#     panel web pueda reescribir settings.yaml.
#
# Lo invocan init.sh, go2-repo-updater.sh y status.sh.
#
# Ejecutar como:  sudo bash scripts/go2-repair.sh
# ==============================================================================

set -uo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
NC='\033[0m'

XVR_DIR="${XVR_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$XVR_DIR" || { echo -e "${RED}[ERROR] No se pudo entrar a ${XVR_DIR}${NC}"; exit 1; }

# Usuario dueño del proyecto: el que lanzó sudo, o el dueño actual del directorio.
REAL_USER="${REAL_USER:-${SUDO_USER:-$(stat -c '%U' "$XVR_DIR" 2>/dev/null || echo "$USER")}}"

IS_ROOT=0
[[ $EUID -eq 0 ]] && IS_ROOT=1

# Archivos que deben ser ejecutables. Se listan aquí y no se confía en el modo
# que traiga git: los commits hechos desde Windows llegan como 644.
EXECUTABLES=(
    init.sh
    status.sh
    uninstall.sh
    release.sh
    scripts/go2-repair.sh
    scripts/go2-repo-updater.sh
    scripts/install-updater.sh
    config/mediamtx
    bin/go2_video_test
    bin/go2_video_client
)

# Plantilla → archivo real del cliente (nunca versionado).
declare -A TEMPLATES=(
    ["config/settings.yaml"]="config/settings.example.yaml"
    ["config/mediamtx.yml"]="config/mediamtx.example.yml"
)

echo -e "${YELLOW}[*]${NC} Reparando proyecto en ${XVR_DIR} (usuario: ${REAL_USER})"

# ── 1. Configuración del cliente ──────────────────────────────────────────────
for target in "${!TEMPLATES[@]}"; do
    template="${TEMPLATES[$target]}"
    if [[ -f "$target" ]]; then
        echo -e "  ${GRAY}· ${target} ya existe, no se toca${NC}"
    elif [[ -f "$template" ]]; then
        cp -a "$template" "$target"
        echo -e "  ${GREEN}✔${NC} ${target} creado desde ${template}"
    else
        echo -e "  ${RED}✗${NC} Falta la plantilla ${template} y no existe ${target}"
    fi
done

# ── 2. Bit de ejecución ───────────────────────────────────────────────────────
for f in "${EXECUTABLES[@]}"; do
    if [[ -f "$f" ]]; then
        if [[ ! -x "$f" ]]; then
            chmod +x "$f" && echo -e "  ${GREEN}✔${NC} +x aplicado a ${f}"
        fi
    fi
done
echo -e "  ${GREEN}✔${NC} Permisos de ejecución verificados"

# ── 3. Carpeta de logs ────────────────────────────────────────────────────────
mkdir -p "${XVR_DIR}/logs"

# ── 4. Propiedad de los archivos ──────────────────────────────────────────────
# El servicio corre como ${REAL_USER} y necesita reescribir config/settings.yaml
# desde el panel. Un sudo mal puesto puede dejar archivos de root.
if [[ $IS_ROOT -eq 1 ]] && id "$REAL_USER" &>/dev/null; then
    chown -R "${REAL_USER}:${REAL_USER}" "$XVR_DIR"
    echo -e "  ${GREEN}✔${NC} Propiedad de ${XVR_DIR} asignada a ${REAL_USER}"
else
    echo -e "  ${GRAY}· chown omitido (se requiere root)${NC}"
fi

echo -e "${GREEN}[✔]${NC} Reparación completada"
