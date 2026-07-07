#!/usr/bin/env python3
import uvicorn
from app_fastapi import app, handle_remote_license_revocation, start_announcer_if_needed
from src.license_remote_guard import start_license_remote_guard
from src.network_time_guard import start_network_time_guard
from src.go2_test_feed import go2_test_binary_available, go2_test_binary_path

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
