from src.licence_utils import verify_license_key
from src.clock_guard import enforce_clock_integrity
from src.network_time_guard import start_network_time_guard
import os
import threading
import time
import sys
import socket
import yaml
from src.announcer_fastapi import start_announcer_thread
from src.main import run_bridge, run_bridge_go2


LICENSE_PATH = "config/license.lic"


def is_port_in_use(port):
    """Check if a port is already bound (announcer started by app_fastapi)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(("0.0.0.0", port))
        s.close()
        return False
    except OSError:
        return True


def _on_network_time_violation(result: dict) -> None:
    print("\n[!] SEGURIDAD: Reloj desincronizado respecto a internet.")
    print(f"[*] {result['message']}")
    print("[*] Apagando bridge por seguridad.")
    os._exit(1)


def security_heartbeat():
    """
    Comprueba cada 5 minutos que el reloj no fue retrocedido y que la
    licencia sigue vigente. Fuerza el cierre inmediato si detecta fraude.
    """
    while True:
        time.sleep(300)

        clock_check = enforce_clock_integrity()
        if not clock_check["valid"]:
            print("\n[!] SEGURIDAD: Manipulación del reloj detectada en ejecución.")
            print(f"[*] {clock_check['message']}")
            print("[*] Apagando bridge por seguridad.")
            os._exit(1)

        if os.path.exists(LICENSE_PATH):
            try:
                with open(LICENSE_PATH, "r", encoding="utf-8") as f:
                    stored_key = f.read().strip()
                result = verify_license_key(stored_key)
                if not result["valid"]:
                    print("\n[!] SEGURIDAD: Licencia inválida o expirada detectada en ejecución.")
                    print(f"[*] {result['message']}")
                    print("[*] Apagando bridge por seguridad.")
                    os._exit(1)
            except OSError:
                print("\n[!] SEGURIDAD: No se pudo leer la licencia en ejecución.")
                os._exit(1)
        else:
            print("\n[!] SEGURIDAD: Archivo de licencia eliminado durante la ejecución.")
            os._exit(1)


def main():
    print("==========================================")
    print("   UNITREE NVR/DVR BRIDGE - CORPORATE     ")
    print("==========================================")

    clock_check = enforce_clock_integrity()
    if not clock_check["valid"]:
        print("[!] Error crítico: Manipulación del reloj del sistema detectada.")
        print(f"[*] {clock_check['message']}")
        sys.exit(1)

    if not os.path.exists(LICENSE_PATH):
        print("[!] Error crítico: El sistema no cuenta con una licencia activa.")
        print("[*] Por favor, ingrese al panel web (puerto 5503) para activar el producto.")
        sys.exit(1)

    with open(LICENSE_PATH, "r", encoding="utf-8") as f:
        stored_key = f.read().strip()

    if not verify_license_key(stored_key)["valid"]:
        print("[!] Error crítico: La licencia de este dispositivo es inválida o ha expirado.")
        sys.exit(1)

    try:
        with open("config/settings.yaml", "r") as f:
            config = yaml.safe_load(f)
    except FileNotFoundError:
        print("Error: No se encontró config/settings.yaml")
        sys.exit(1)

    threading.Thread(target=security_heartbeat, daemon=True).start()
    start_network_time_guard(on_violation=_on_network_time_violation)
    print("[*] Heartbeat de seguridad activo (intervalo: 5 min).")
    print("[*] Verificación de hora por internet activa (solo si hay red).")

    if config["device"]["type"] != "rtsp_only":
        onvif_port = config["device"].get("onvif_port", 8000)
        if is_port_in_use(onvif_port):
            print(f"[*] Announcer ONVIF ya activo en :{onvif_port}, reutilizando.")
        else:
            print(f"[*] Iniciando Announcer para modo: {config['device']['type']}...")
            start_announcer_thread(config)
    else:
        print("[*] Modo RTSP detectado. Announcer ONVIF desactivado.")

    time.sleep(2)

    camera_source = config["device"].get("camera_source", "usb")
    try:
        if camera_source == "go2":
            print("[*] Fuente de vídeo: Cámara integrada Go2 (binary)")
            run_bridge_go2(config)
        else:
            print("[*] Fuente de vídeo: Cámara USB/externa (OpenCV)")
            run_bridge(config)
    except KeyboardInterrupt:
        print("\n[!] Apagando sistema...")


if __name__ == "__main__":
    main()
