#!/bin/bash
# ==============================================================================
# go2-repo-updater.sh — Auto-actualización desde GitHub
#
# Vive DENTRO del repositorio a propósito: así las mejoras a esta lógica llegan
# a los equipos por la propia actualización. /usr/local/bin/go2-repo-updater.sh
# es solo un wrapper que exporta XVR_DIR / REAL_USER / BRANCH y ejecuta una
# copia de este archivo (ver scripts/install-updater.sh).
#
# Garantías frente a `git reset --hard`:
#   1. config/settings.yaml y config/mediamtx.yml NO están versionados
#      (ver .gitignore), por lo que el reset ni los ve.
#   2. Aun así se respaldan antes del reset y se restauran después si el reset
#      los borró o cambió. Esto cubre el caso de que alguien vuelva a versionar
#      la config por error: cuando un archivo rastreado desaparece del índice,
#      `git reset --hard` lo BORRA del disco.
#   3. Tras el reset se llama a scripts/go2-repair.sh, que devuelve el bit de
#      ejecución y la propiedad de los archivos (el reset revierte `chmod +x`
#      en cualquier archivo commiteado como 644).
# ==============================================================================

set -uo pipefail

XVR_DIR="${XVR_DIR:-}"
REAL_USER="${REAL_USER:-}"
BRANCH="${BRANCH:-main}"

BACKUP_ROOT="/var/backups/go2-xvr"
BACKUP_KEEP=10
LOCK_FILE="/var/lock/go2-repo-updater.lock"

# Archivos del cliente que jamás deben perderse en una actualización.
PRESERVE=(
    config/settings.yaml
    config/mediamtx.yml
    config/license.lic
    config/.device_fingerprint
    config/.clock_state
    config/.license_activated_at
    .env
)

log() { echo "$(date '+%Y-%m-%d %H:%M:%S'): $*"; }

if [[ -z "$XVR_DIR" || -z "$REAL_USER" ]]; then
    log "ERROR: faltan XVR_DIR o REAL_USER. Reinstala el wrapper con: sudo bash scripts/install-updater.sh"
    exit 1
fi

cd "$XVR_DIR" || { log "ERROR: no existe $XVR_DIR"; exit 1; }

# ── Cerrojo: el timer y la opción 10 de status.sh pueden coincidir ────────────
exec 9>"$LOCK_FILE" 2>/dev/null || true
if ! flock -n 9 2>/dev/null; then
    log "Ya hay una actualización en curso. Se omite esta ejecución."
    exit 0
fi

as_user() { sudo -u "$REAL_USER" "$@"; }

# ── 1. Traer metadatos de GitHub sin modificar el código local ────────────────
if ! as_user git fetch origin "$BRANCH" &>/dev/null; then
    log "No se pudo contactar a GitHub (sin red). Se reintentará luego."
    exit 0
fi

# ── 2. Comparar el commit local contra el de GitHub ───────────────────────────
LOCAL=$(as_user git rev-parse HEAD)
REMOTE=$(as_user git rev-parse "origin/$BRANCH")

if [[ "$LOCAL" == "$REMOTE" ]]; then
    exit 0
fi

log "¡Nueva actualización detectada en GitHub! Aplicando cambios..."

# Qué cambia (se calcula ANTES del reset, después ya no hay diferencia)
CHANGED=$(as_user git diff --name-only HEAD "origin/$BRANCH" || true)
REQ_CHANGED=$(echo "$CHANGED" | grep -x "requirements.txt" || true)
MTX_CHANGED=$(echo "$CHANGED" | grep -x "config/mediamtx" || true)

# ── 3. Respaldo de los archivos del cliente ───────────────────────────────────
BACKUP_PATH="${BACKUP_ROOT}/$(date '+%Y%m%d-%H%M%S')"
mkdir -p "$BACKUP_PATH"
for rel in "${PRESERVE[@]}"; do
    if [[ -f "$rel" ]]; then
        mkdir -p "${BACKUP_PATH}/$(dirname "$rel")"
        cp -a "$rel" "${BACKUP_PATH}/${rel}"
    fi
done
log "Respaldo de configuración en ${BACKUP_PATH}"

# ── 4. Forzar la actualización local ──────────────────────────────────────────
if ! as_user git reset --hard "origin/$BRANCH"; then
    log "ERROR al aplicar git reset --hard. Se aborta la actualización."
    exit 1
fi

# ── 5. Restaurar lo que el reset se haya llevado ──────────────────────────────
for rel in "${PRESERVE[@]}"; do
    src="${BACKUP_PATH}/${rel}"
    [[ -f "$src" ]] || continue
    if [[ ! -f "$rel" ]] || ! cmp -s "$src" "$rel"; then
        mkdir -p "$(dirname "$rel")"
        cp -a "$src" "$rel"
        log "Restaurado desde el respaldo: ${rel}"
    fi
done

# ── 6. Permisos, propiedad y config faltante ──────────────────────────────────
if [[ -f "${XVR_DIR}/scripts/go2-repair.sh" ]]; then
    XVR_DIR="$XVR_DIR" REAL_USER="$REAL_USER" bash "${XVR_DIR}/scripts/go2-repair.sh" || \
        log "AVISO: go2-repair.sh terminó con errores."
else
    log "AVISO: no se encontró scripts/go2-repair.sh; permisos sin verificar."
fi

# ── 7. Dependencias de Python ─────────────────────────────────────────────────
if [[ -n "$REQ_CHANGED" ]]; then
    log "requirements.txt modificado. Actualizando entorno virtual..."
    as_user bash -c "
        source '${XVR_DIR}/venv/bin/activate'
        pip install -r '${XVR_DIR}/requirements.txt'
    " || log "AVISO: falló la actualización de dependencias."
fi

# ── 8. Reiniciar servicios ────────────────────────────────────────────────────
if [[ -n "$MTX_CHANGED" ]]; then
    log "El binario de mediamtx cambió. Reiniciando go2-mediamtx.service..."
    systemctl restart go2-mediamtx.service || log "AVISO: falló el reinicio de go2-mediamtx."
fi

log "Reiniciando go2-xvr-stream.service..."
systemctl restart go2-xvr-stream.service || log "AVISO: falló el reinicio de go2-xvr-stream."

# ── 9. Conservar solo los últimos respaldos ───────────────────────────────────
if [[ -d "$BACKUP_ROOT" ]]; then
    # shellcheck disable=SC2012
    ls -1dt "${BACKUP_ROOT}"/*/ 2>/dev/null | tail -n +$((BACKUP_KEEP + 1)) | xargs -r rm -rf
fi

log "Actualización completada (${LOCAL} -> ${REMOTE})."
