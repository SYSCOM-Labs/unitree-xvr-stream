#!/bin/bash
# ==============================================================================
# install-updater.sh — Instala el Auto-Updater de GitHub (wrapper + service + timer)
#
# El wrapper que queda en /usr/local/bin es intencionalmente mínimo: toda la
# lógica vive en scripts/go2-repo-updater.sh, dentro del repositorio, para que
# las correcciones al updater lleguen a los equipos por GitHub.
#
# Lo llama init.sh, y también sirve para migrar un equipo ya instalado sin
# volver a crear el venv ni responder las preguntas de red:
#   sudo bash scripts/install-updater.sh
#
# Variables opcionales: BRANCH (por defecto "main")
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}[ERROR] Este script debe ejecutarse como root (sudo bash scripts/install-updater.sh)${NC}"
    exit 1
fi

XVR_DIR="${XVR_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
REAL_USER="${REAL_USER:-${SUDO_USER:-$(stat -c '%U' "$XVR_DIR")}}"
BRANCH="${BRANCH:-main}"

UPDATER_WRAPPER="/usr/local/bin/go2-repo-updater.sh"
UPDATER_SRC="${XVR_DIR}/scripts/go2-repo-updater.sh"

if [[ ! -f "$UPDATER_SRC" ]]; then
    echo -e "${RED}[ERROR] No se encontró ${UPDATER_SRC}${NC}"
    exit 1
fi

echo -e "${YELLOW}[*]${NC} Instalando Auto-Updater (rama '${BRANCH}', usuario '${REAL_USER}')..."

# ── Wrapper ───────────────────────────────────────────────────────────────────
# Copia el script a /tmp antes de ejecutarlo: durante la actualización el propio
# `git reset --hard` reescribe scripts/go2-repo-updater.sh, y no se debe tocar el
# archivo que bash está leyendo en ese momento.
cat > "$UPDATER_WRAPPER" <<WRAPEOF
#!/bin/bash
# ------------------------------------------------------------------------------
# Generado por scripts/install-updater.sh — no editar a mano.
# La lógica real está en \${XVR_DIR}/scripts/go2-repo-updater.sh (versionada).
# ------------------------------------------------------------------------------
export XVR_DIR="${XVR_DIR}"
export REAL_USER="${REAL_USER}"
export BRANCH="${BRANCH}"

SRC="\${XVR_DIR}/scripts/go2-repo-updater.sh"

if [[ ! -f "\$SRC" ]]; then
    echo "\$(date): ERROR: no se encontró \$SRC"
    exit 1
fi

TMP="\$(mktemp /tmp/go2-repo-updater.XXXXXX.sh)"
cp "\$SRC" "\$TMP"
bash "\$TMP"
RC=\$?
rm -f "\$TMP"
exit \$RC
WRAPEOF

chmod +x "$UPDATER_WRAPPER"

# ── Servicio ──────────────────────────────────────────────────────────────────
cat > /etc/systemd/system/go2-repo-updater.service <<EOF
[Unit]
Description=Go2 — Ejecutor de Auto-Updater de Git
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=${UPDATER_WRAPPER}
EOF

# ── Timer ─────────────────────────────────────────────────────────────────────
cat > /etc/systemd/system/go2-repo-updater.timer <<EOF
[Unit]
Description=Go2 — Temporizador para buscar actualizaciones cada 30 min

[Timer]
OnBootSec=2min
OnUnitActiveSec=30min
AccuracySec=1min

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now go2-repo-updater.timer

echo -e "${GREEN}  ✔ Auto-Updater instalado${NC}"
echo -e "${GREEN}    · Wrapper: ${UPDATER_WRAPPER}${NC}"
echo -e "${GREEN}    · Lógica:  ${UPDATER_SRC}${NC}"
echo -e "${GREEN}    · Revisión cada 30 minutos en la rama '${BRANCH}'${NC}"
