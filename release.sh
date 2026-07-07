#!/bin/bash
# ==============================================================================
# release.sh — Compila módulos Cython + frontend (dist/)
# Ejecutar en el Go2 (ARM64).
# Uso:  chmod +x release.sh && ./release.sh
# ==============================================================================

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# ── Colores ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Fuentes Cython (deben coincidir con compile_project.py → targets)
SOURCES=(
    app_fastapi.py
    launcher.py
    src/licence_utils.py
    src/clock_guard.py
    src/license_activation.py
    src/main.py
    src/go2_test_feed.py
    src/license_remote_guard.py
    src/network_time_guard.py
    src/announcer_fastapi.py
)

# Módulos bajo src/ cuyo .so se mueve a src/ tras compilar
SRC_MODULES=(
    clock_guard
    licence_utils
    license_activation
    main
    go2_test_feed
    license_remote_guard
    network_time_guard
    announcer_fastapi
)

# Plain Python en runtime (no compilar): run.py, run_bridge.py, compile_project.py

setup_node_toolchain() {
    export PATH="/usr/local/bin:/usr/bin:${HOME}/.local/bin:${PATH}"
    if [[ -d "${HOME}/.nvm/versions/node" ]]; then
        local latest_node=""
        latest_node="$(ls -1 "${HOME}/.nvm/versions/node" 2>/dev/null | sort -V | tail -1 || true)"
        if [[ -n "$latest_node" ]]; then
            export PATH="${HOME}/.nvm/versions/node/${latest_node}/bin:${PATH}"
        fi
    fi
    if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
        # shellcheck disable=SC1091
        source "${HOME}/.nvm/nvm.sh" >/dev/null 2>&1 || true
    fi
}

resolve_npm() {
    setup_node_toolchain
    if command -v npm >/dev/null 2>&1; then
        command -v npm
        return 0
    fi
    local candidate
    for candidate in "${HOME}/.nvm/versions/node/"*/bin/npm; do
        if [[ -x "$candidate" ]]; then
            export PATH="$(dirname "$candidate"):${PATH}"
            echo "$candidate"
            return 0
        fi
    done
    return 1
}

resolve_pnpm() {
    setup_node_toolchain
    command -v pnpm 2>/dev/null || true
}

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     Unitree XVR Stream — Release (Cython + frontend)        ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Verificar requisitos
if [[ ! -f src/__init__.py ]]; then
    echo -e "${RED}[ERROR] Falta src/__init__.py (requerido para imports src.*)${NC}"
    exit 1
fi
for f in "${SOURCES[@]}"; do
    if [[ ! -f "$f" ]]; then
        echo -e "${RED}[ERROR] Falta $f${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✔ Todos los fuentes .py existen (${#SOURCES[@]} módulos Cython)${NC}"

# Activar/crear venv
if [[ ! -d venv ]]; then
    echo -e "  Creando entorno virtual..."
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip -q
pip install -q -r requirements.txt cython

# Compilar
echo -e "${YELLOW}[*]${NC} Compilando módulos Cython..."
python3 compile_project.py build_ext --inplace

# Mover .so generados en raíz hacia src/
for mod in "${SRC_MODULES[@]}"; do
    shopt -s nullglob
    for so in "${mod}".cpython-*.so; do
        [[ -f "$so" ]] && mv -f "$so" "src/"
    done
    shopt -u nullglob
done

# Limpiar artefactos de compilación
rm -rf build/
rm -f app.c app_fastapi.c launcher.c src/*.c
shopt -s nullglob
for legacy in app.cpython-*.so; do rm -f "$legacy"; done
shopt -u nullglob

# Verificar layout
ERRORS=0
for mod in app_fastapi launcher; do
    if ! compgen -G "${mod}.cpython-*.so" > /dev/null; then
        echo -e "${RED}  ✗ Falta ${mod}.cpython-*.so en raíz${NC}"
        ERRORS=1
    fi
done
for mod in "${SRC_MODULES[@]}"; do
    if ! compgen -G "src/${mod}.cpython-*.so" > /dev/null; then
        echo -e "${RED}  ✗ Falta src/${mod}.cpython-*.so${NC}"
        ERRORS=1
    fi
done

if [[ "$ERRORS" -ne 0 ]]; then
    echo -e "${RED}[ERROR] Layout de binarios .so incompleto${NC}"
    deactivate
    exit 1
fi

echo -e "${YELLOW}[*]${NC} Verificando imports..."
python3 - <<'PY'
import importlib
import sys

modules = [
    "app_fastapi",
    "launcher",
    "src.licence_utils",
    "src.clock_guard",
    "src.license_activation",
    "src.main",
    "src.go2_test_feed",
    "src.license_remote_guard",
    "src.network_time_guard",
    "src.announcer_fastapi",
]

failed = []
for name in modules:
    try:
        importlib.import_module(name)
        print(f"  OK  {name}")
    except Exception as exc:
        failed.append((name, exc))
        print(f"  FAIL {name}: {exc}")

if failed:
    sys.exit(1)
PY

deactivate

echo -e "${GREEN}✔ ${#SOURCES[@]} módulos Cython compilados correctamente${NC}"
echo -e "${GREEN}  Plain Python en runtime: run.py, run_bridge.py${NC}"

# ── Frontend (dist/) ──────────────────────────────────────────────────────────
if [[ -d frontend ]]; then
    echo -e "${YELLOW}[*]${NC} Compilando frontend → dist/ ..."
    NPM_BIN="$(resolve_npm || true)"
    PNPM_BIN="$(resolve_pnpm || true)"
    if [[ -z "$NPM_BIN" && -z "$PNPM_BIN" ]]; then
        echo -e "${RED}[ERROR] npm/pnpm no encontrado.${NC}"
        echo -e "${YELLOW}       PATH actual: ${PATH}${NC}"
        echo -e "${YELLOW}       Instale Node.js o cargue nvm antes de ejecutar release.sh.${NC}"
        exit 1
    fi
    pushd frontend >/dev/null
    if [[ -f pnpm-lock.yaml && -n "$PNPM_BIN" ]]; then
        echo -e "  Usando pnpm: ${PNPM_BIN}"
        "$PNPM_BIN" install --frozen-lockfile
        "$PNPM_BIN" run build
    else
        echo -e "  Usando npm: ${NPM_BIN}"
        if [[ -f package-lock.json ]]; then
            "$NPM_BIN" ci
        else
            "$NPM_BIN" install
        fi
        "$NPM_BIN" run build
    fi
    popd >/dev/null
    if [[ ! -f dist/index.html ]]; then
        echo -e "${RED}[ERROR] dist/index.html no generado${NC}"
        exit 1
    fi
    echo -e "${GREEN}✔ Frontend compilado en dist/${NC}"
else
    echo -e "${YELLOW}[!]${NC} Sin carpeta frontend/ — se omite build del panel web"
fi

echo ""
