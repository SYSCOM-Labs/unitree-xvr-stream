#!/usr/bin/env python3
import os
import shutil
import sys

_PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))

_CONFIG_TEMPLATES = (
    ("config/settings.yaml", "config/settings.example.yaml"),
    ("config/mediamtx.yml", "config/mediamtx.example.yml"),
)


def _bootstrap_config() -> None:
    for rel_target, rel_template in _CONFIG_TEMPLATES:
        target = os.path.join(_PROJECT_DIR, rel_target)
        template = os.path.join(_PROJECT_DIR, rel_template)
        if os.path.exists(target) or not os.path.exists(template):
            continue
        try:
            os.makedirs(os.path.dirname(target), exist_ok=True)
            shutil.copyfile(template, target)
            print(f"[*] {rel_target} creado desde {rel_template}")
        except OSError as e:
            print(f"[!] No se pudo crear {rel_target}: {e}", file=sys.stderr)


_bootstrap_config()

import uvicorn  # noqa: E402
from app_fastapi import (  # noqa: E402
    app,
    handle_remote_license_revocation,
    start_announcer_if_needed,
)
from src.license_remote_guard import start_license_remote_guard  # noqa: E402
from src.network_time_guard import start_network_time_guard  # noqa: E402
from src.go2_test_feed import go2_test_binary_available, go2_test_binary_path  # noqa: E402

if __name__ == "__main__":
    start_announcer_if_needed()
    start_network_time_guard()
    start_license_remote_guard(on_revoked=handle_remote_license_revocation)
    print("[*] Guardián remoto de licencia iniciado.")
    if go2_test_binary_available():
        print(f"[*] Go2 camera test: binario listo ({go2_test_binary_path()})")
    else:
        print(f"[!] Go2 camera test: binario no encontrado ({go2_test_binary_path()})")
    uvicorn.run(app, host="0.0.0.0", port=5503)
