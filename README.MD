# Guía de instalación y activación: Unitree Go2 XVR Stream

Esta guía detalla el proceso completo para solicitar su licencia, descargar el software y desplegar el sistema de transmisión de video en el robot Unitree Go2. Siga los pasos en el orden indicado.

> ⚠️ **Importante:** No actualice el software del robot bajo ninguna circunstancia. Ignore y cierre cualquier alerta de actualización del sistema operativo. Actualizar el firmware puede romper por completo la compatibilidad de esta instalación.

---

## 1. Proceso de Licenciamiento y Obtención de Software

El software **Unitree XVR Stream** se distribuye de forma gratuita pero exclusiva para dispositivos adquiridos a través de SYSCOM. El flujo consta de 3 etapas autogestionadas desde nuestro portal central.

### Etapa 1: Solicitud de Acceso a Licencia
Antes de tocar el robot, debe registrar los datos de su compra en nuestro portal de validación corporativo. SYSCOM revisará los datos fiscales e internos para certificar que el número de serie corresponda a una distribución oficial de la empresa.

Para iniciar la solicitud, ingrese al portal web e introduzca:
* **Empresa:** Nombre fiscal o comercial registrado en su compra.
* **Folio de Factura:** El identificador oficial de su documento de venta de SYSCOM.
* **Modelo del Artículo:** El modelo exacto del robot (Ej: `GO2EDUU1`).
* **Número de Serie del Robot:** El número de serie físico grabado en el chasis del dispositivo (visible también en su factura de compra).
* **Correo Electrónico:** Dirección donde recibirá las notificaciones y accesos del sistema.

*Una vez aprobada la solicitud por nuestro equipo de ingeniería, se le enviará automáticamente una **Clave de Acceso** única a su correo electrónico.*

### Etapa 2: Descarga e Instalación del Software
Cuando reciba la confirmación por correo electrónico, ingrese a la sección de descargas del portal:
1. Introduzca su **Clave de Acceso** autorizada.
2. Si la clave es válida, el sistema liberará la descarga del paquete comprimido **`unitree-xvr-stream.zip`** junto con sus dependencias básicas.

### Etapa 3: Vincular Licencia al Robot (Cierre Criptográfico)
Una vez que haya ejecutado el instalador en el perro (Pasos detallados en las secciones 2 y 3 de esta guía), la interfaz web local del robot (puerto `5503`) le mostrará una **Llave Encriptada** única (Hardware ID). 

Para finalizar la activación, vuelva al portal de licencias de SYSCOM y complete el formulario de cruce:
* **Clave de Acceso Recibida:** Su código autorizado por correo.
* **Llave encriptada del robot:** El Hardware ID copiado directamente desde la pantalla local del perro.

> 🔳 *Marque la casilla de verificación:* **"Confirmo que la llave encriptada corresponde a mi dispositivo. No puede transferirse después de vincular."**

Al dar clic en el botón **[Vincular y generar licencia]**, el servidor calculará su firma criptográfica final de 5 partes. Cópiela, péguela en la interfaz local del robot y el sistema iniciará la transmisión de inmediato hacia sus grabadores de CCTV.

> ❌ **IMPORTANTE:** La licencia queda ligada de forma permanente e inalterable al Hardware del robot indicado. Verifique minuciosamente que el Hardware ID coincida antes de confirmar la vinculación.

---

## 2. Preparación física del robot

1. **Enciende** la unidad Go2 (W).
2. **Bloquea al perro (modo PRONE):** En el control remoto, presiona **L2 + A**. El perro se acostará y desactivará los motores.
3. **Conecta los periféricos** con un HUB USB:
   - Monitor (HDMI)
   - Teclado y ratón
   - Memoria USB (con el proyecto extraído del .zip descargado)
4. **Inicia sesión** en el sistema operativo Ubuntu del Go2.
   - Contraseña por defecto: `123`

---

## 3. Transferir el proyecto al robot

1. Abre el explorador de archivos en el escritorio de Ubuntu.
2. Abre la memoria USB y **copia la carpeta del proyecto**.
3. Pégala en esta ruta exacta (el nombre de la carpeta debe coincidir):

   ```text
   /home/unitree/Documents/unitree-xvr-stream
   ```

---

---

*(Los pasos 3.5 y las referencias a `rebuild.sh` se omiten intencionalmente: la compilación Cython y el build del frontend los realiza el administrador mediante `release.sh` antes de distribuir el .zip. El cliente solo necesita descomprimir y ejecutar `sudo ./init.sh`.)*

---

## 4. Conexión a internet (temporal)

El robot necesita internet para descargar dependencias (Ethernet al router o Wi‑Fi por USB).

1. Si usas Wi‑Fi, conéctate desde el icono de red (SSID y contraseña).
2. Abre una **terminal** (`Ctrl + Alt + T`).
3. Si tu entorno lo requiere, entra al entorno de ROS que uses en tu imagen (por ejemplo el menú numérico del fabricante) y continúa.
4. Lista rutas e interfaces:

   ```bash
   ip route show
   ```

   Identifica la interfaz de salida a internet: suele ser `wlan0` (Wi‑Fi) o `eth1` (cable Ethernet al router).

5. Añade la ruta por defecto (sustituye `GATEWAY` por la IP del router, p. ej. `192.168.1.1`, y `IFACE` por `wlan0` o `eth1`):

   ```bash
   sudo ip route add default via GATEWAY dev IFACE metric 50
   ```

6. Comprueba conectividad:

   ```bash
   ping google.com
   ```

   Si hay respuesta, detén con `Ctrl + C`.

---

## 5. Instalación del software

Con internet activo:

1. Ve al directorio del proyecto:

   ```bash
   cd ~/Documents/unitree-xvr-stream
   ```

2. Da permisos de ejecución a los scripts:

   ```bash
   chmod +x init.sh uninstall.sh status.sh
   ```

3. Ejecuta el instalador:

   ```bash
   sudo ./init.sh
   ```

   Sigue las indicaciones en pantalla. El script configura red persistente, dependencias, entorno virtual Python, habilita servicios systemd para arranque automático y deja todo listo para funcionar.

---

## 5.5 Validación remota de licencia (SYSCOM)

El robot consulta periódicamente `https://unitree.syscom.mx/api/robot/license-status` con su Hardware ID. Si el portal indica que **no hay licencia activa** (`not_found`, `revocada` o `expirada`), el robot detiene el bridge, elimina `config/license.lic` y el panel vuelve a la pantalla de activación. Sin internet no se modifica la licencia local.

**Actualizar solo el guardián remoto** (plain Python, no requiere Cython):

```bash
cd ~/Documents/unitree-xvr-stream
# Copiar src/license_remote_guard.py actualizado
rm -f src/license_remote_guard.cpython-*.so   # evitar .so obsoleto
sudo systemctl restart go2-xvr-stream
```

Si también cambió `app_fastapi.py`, recompilar antes del restart:

```bash
./release.sh
sudo systemctl restart go2-xvr-stream
```

Variables opcionales en `go2-xvr-stream.service`:

- `SYSCOM_PORTAL_URL` — URL del validador (default: `https://unitree.syscom.mx`)
- `SYSCOM_LICENSE_CHECK_DELAY` — segundos antes del primer chequeo (default: 60)
- `SYSCOM_LICENSE_CHECK_INTERVAL` — intervalo entre chequeos en segundos (default: 900)

Ver logs: `sudo journalctl -u go2-xvr-stream -f | grep license_remote_guard`

---

## 6. Panel de control (`status.sh`)

Panel interactivo para ver el estado del sistema, diagnosticar fallos y gestionar los servicios asociados.

```bash
cd ~/Documents/unitree-xvr-stream
sudo ./status.sh
```

### ¿Cómo funciona `status.sh`?

El script actúa como una consola de administración centralizada que interactúa con el sistema operativo Ubuntu del robot. Al ejecutarse, realiza las siguientes tareas de forma dinámica:

#### A. Verificación de Privilegios y Rutas
* Valida que se esté ejecutando con permisos de superusuario (`sudo`).
* Resuelve dinámicamente el usuario real del entorno (`SUDO_USER`) para determinar correctamente la ruta del proyecto (`~/Documents/unitree-xvr-stream`).

#### B. Diagnóstico y Monitoreo en Tiempo Real
1. **Estado de los Servicios Systemd:** Comprueba e indica mediante indicadores de color si los servicios críticos están activos (● verde), inactivos (○ amarillo), deshabilitados (○ rojo) o no instalados (✗ gris).
2. **Chequeo de Software:** Verifica la instalación de la versión de `ffmpeg` y la integridad del entorno virtual de Python (`venv`).
3. **Chequeo de Red:** Extrae y muestra la interfaz de red y el Gateway configurados en la ruta persistente, además de listar las rutas por defecto activas en la tabla de ruteo del kernel (`ip route`).
4. **Puertos en Uso:** Escanea el sistema mediante `ss` y muestra los puertos TCP de escucha asociados a los servicios del Stream (`mediamtx`, `python3` / FastAPI en puerto `5503`).

#### C. Servicios Controlados por el Panel
* **App Web (`go2-xvr-stream.service`):** Gestiona `run.py` → FastAPI (`app_fastapi`), panel web en puerto `5503` y control del puente de video.
* **MediaMTX RTSP (`go2-mediamtx.service`):** Controla el servidor RTSP/RTMP MediaMTX encargado de recibir el flujo de video codificado por FFmpeg y distribuirlo a los grabadores de video (NVR/XVR).
* **Ruta por defecto arranque (`go2-default-route.service`):** Configura la métrica de la interfaz seleccionada en el arranque para garantizar la salida a internet necesaria.
* **Ruta por defecto timer (`go2-default-route.timer`):** Un programador de systemd que corre cada 5 minutos el reajuste de la ruta del robot, previniendo que el sistema operativo del robot borre o altere la conexión por defecto.

#### D. Acciones Disponibles en el Menú
* **Gestión Individual (Opciones 1-4):** Permite controlar cada servicio de forma aislada:
  * **Iniciar / Detener / Reiniciar:** Controla el ciclo de vida del servicio.
  * **Ver logs:** Muestra las últimas 20 líneas de registro del servicio mediante `journalctl`.
  * **Seguimiento en vivo:** Realiza un seguimiento interactivo de la salida estándar del servicio en tiempo real (equivalente a `journalctl -f`).
* **Acciones Masivas (Opciones 5-7):** Inicia, detiene o reinicia todos los servicios del ecosistema del stream de manera secuencial y simultánea.

---

## 7. Desinstalación

Para detener procesos, quitar servicios y limpiar configuración del proyecto (conservando el código en disco):

```bash
cd ~/Documents/unitree-xvr-stream
sudo ./uninstall.sh
```

Confirma con **SI** cuando lo pida el script.
