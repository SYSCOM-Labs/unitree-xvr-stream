# Unitree Go2 XVR Stream

## ¿Qué es y para qué sirve?

**Unitree XVR Stream** es un puente de video que permite enviar la imagen del robot **Unitree Go2** hacia grabadores de videovigilancia (DVR/NVR/XVR) de forma compatible con los protocolos **RTSP** y **ONVIF**.

Con este sistema usted puede:

- **Integrar el robot a su CCTV existente**, como si fuera una cámara IP más en su red de grabación.
- **Elegir la fuente de video**: cámara USB conectada al Go2 o la cámara integrada del robot.
- **Probar la cámara antes de transmitir**, con una vista previa desde el panel web.
- **Configurar los parámetros de red y del grabador** (IP, puertos, canales) desde una interfaz local en el robot.
- **Transmitir dos flujos simultáneos** (principal y secundario) para adaptarse a las necesidades de su grabador.
- **Facilitar el descubrimiento automático** del robot por parte de los NVR que soporten ONVIF.

El panel de control web corre en el robot en el puerto **5503**. Una vez activada la licencia y configurado el sistema, el video queda disponible para que su grabador lo registre de forma continua.

> Este producto requiere una licencia válida emitida por SYSCOM para dispositivos adquiridos a través de la empresa. Sin licencia activa, la transmisión de video no se habilita.

> ⚠️ **Importante:** No actualice el software del robot bajo ninguna circunstancia. Ignore y cierre cualquier alerta de actualización del sistema operativo. Actualizar el firmware puede romper por completo la compatibilidad de esta instalación.

---

# Guía de instalación y activación

Esta guía detalla el proceso completo para solicitar su licencia, descargar el software y desplegar el sistema de transmisión de video en el robot Unitree Go2. Siga los pasos en el orden indicado.

---

## 1. Proceso de licenciamiento y obtención de software

El software **Unitree XVR Stream** se distribuye de forma gratuita pero exclusiva para dispositivos adquiridos a través de SYSCOM. El flujo consta de 3 etapas autogestionadas desde el portal de SYSCOM.

### Etapa 1: Solicitud de acceso a licencia

Antes de tocar el robot, registre los datos de su compra en el portal de validación de SYSCOM. El equipo revisará la información para certificar que el número de serie corresponda a una distribución oficial.

Para iniciar la solicitud, ingrese al portal web e introduzca:

* **Empresa:** Nombre fiscal o comercial registrado en su compra.
* **Folio de factura:** El identificador oficial de su documento de venta de SYSCOM.
* **Modelo del artículo:** El modelo exacto del robot (Ej: `GO2EDUU1`).
* **Número de serie del robot:** El número de serie físico grabado en el chasis del dispositivo (visible también en su factura de compra).
* **Correo electrónico:** Dirección donde recibirá las notificaciones y accesos del sistema.

*Una vez aprobada la solicitud, se le enviará automáticamente una **Clave de Acceso** única a su correo electrónico.*

### Etapa 2: Descarga e instalación del software

Cuando reciba la confirmación por correo electrónico, ingrese a la sección de descargas del portal:

1. Introduzca su **Clave de Acceso** autorizada.
2. Si la clave es válida, el sistema liberará la descarga del paquete comprimido **`unitree-xvr-stream.zip`**.

### Etapa 3: Vincular licencia al robot

Una vez que haya ejecutado el instalador en el robot (pasos detallados en las secciones 2 y 3 de esta guía), la interfaz web local del robot (puerto `5503`) le mostrará un **identificador único del dispositivo** (Hardware ID).

Para finalizar la activación, vuelva al portal de licencias de SYSCOM y complete el formulario de vinculación:

* **Clave de acceso recibida:** Su código autorizado por correo.
* **Identificador del robot:** El Hardware ID copiado directamente desde la pantalla local del robot.

> Marque la casilla de verificación: **"Confirmo que el identificador corresponde a mi dispositivo. No puede transferirse después de vincular."**

Al confirmar la vinculación, el portal generará su **licencia de activación**. Cópiela, péguela en la interfaz local del robot y el sistema quedará listo para transmitir hacia sus grabadores de CCTV.

> ❌ **IMPORTANTE:** La licencia queda ligada de forma permanente al hardware del robot indicado. Verifique minuciosamente que el identificador coincida antes de confirmar la vinculación.

---

## 2. Preparación física del robot

1. **Encienda** la unidad Go2 (W).
2. **Bloquee al robot (modo PRONE):** En el control remoto, presione **L2 + A** dos veces. El robot se acostará y desactivará los motores.
3. **Conecte los periféricos** con un HUB USB:
   - Monitor (HDMI)
   - Teclado y ratón
   - Memoria USB (con el proyecto extraído del .zip descargado)
4. **Inicie sesión** en el sistema operativo Ubuntu del Go2 con las credenciales proporcionadas por el fabricante o su integrador.

---

## 3. Transferir el proyecto al robot

1. Abra el explorador de archivos en el escritorio de Ubuntu.
2. Abra la memoria USB y **copie la carpeta del proyecto**.
3. Péguela en esta ruta exacta (el nombre de la carpeta debe coincidir):

   ```text
   /home/unitree/Documents/unitree-xvr-stream
   ```

---

## 4. Conexión a internet (temporal)

El robot necesita internet para descargar dependencias (Ethernet al router o Wi‑Fi por USB).

1. Si usa Wi‑Fi, conéctese desde el icono de red (SSID y contraseña).
2. Abra una **terminal** (`Ctrl + Alt + T`).
3. Si su entorno lo requiere, entre al entorno de ROS que use en su imagen (por ejemplo el menú numérico del fabricante) y continúe.
4. Liste rutas e interfaces:

   ```bash
   ip route show
   ```

   Identifique la interfaz de salida a internet: suele ser `wlan0` (Wi‑Fi) o `eth1` (cable Ethernet al router).

5. Añada la ruta por defecto (sustituya `GATEWAY` por la IP del router, p. ej. `192.168.1.1`, y `IFACE` por `wlan0` o `eth1`):

   ```bash
   sudo ip route add default via GATEWAY dev IFACE metric 50
   ```

6. Compruebe conectividad:

   ```bash
   ping google.com
   ```

   Si hay respuesta, detenga con `Ctrl + C`.

---

## 5. Instalación del software

Con internet activo:

1. Vaya al directorio del proyecto:

   ```bash
   cd ~/Documents/unitree-xvr-stream
   ```

2. Dé permisos de ejecución a los scripts:

   ```bash
   chmod +x init.sh uninstall.sh status.sh
   ```

3. Ejecute el instalador:

   ```bash
   sudo ./init.sh
   ```

   Siga las indicaciones en pantalla. El script configura red persistente, dependencias, servicios de arranque automático y deja todo listo para funcionar.

4. Abra el panel web en un navegador conectado a la misma red del robot:

   ```text
   http://<IP-del-robot>:5503
   ```

   Desde ahí podrá activar su licencia, probar la cámara y configurar la transmisión hacia su grabador.

---

## 6. Panel de control (`status.sh`)

Panel interactivo para ver el estado del sistema, diagnosticar fallos y gestionar los servicios asociados.

```bash
cd ~/Documents/unitree-xvr-stream
sudo ./status.sh
```

### ¿Qué puede hacer con `status.sh`?

El script funciona como una consola de administración centralizada en el robot. Al ejecutarse:

#### A. Verificación inicial

* Valida que se esté ejecutando con permisos de superusuario (`sudo`).
* Localiza automáticamente la ruta del proyecto en `~/Documents/unitree-xvr-stream`.

#### B. Diagnóstico en tiempo real

1. **Estado de los servicios:** Indica si los servicios del sistema están activos, inactivos o no instalados.
2. **Chequeo de software:** Verifica que `ffmpeg` y el entorno de Python estén correctamente instalados.
3. **Chequeo de red:** Muestra la interfaz de red y el gateway configurados, además de las rutas activas.
4. **Puertos en uso:** Comprueba que los puertos del panel web (`5503`) y del servidor de video (`554`) estén escuchando.

#### C. Servicios gestionados

* **Aplicación web:** Panel de control, activación de licencia y gestión de la transmisión (puerto `5503`).
* **Servidor de video:** Recibe el flujo codificado y lo distribuye a los grabadores vía RTSP.
* **Ruta de red:** Mantiene la conexión a internet necesaria para validación de licencia y descarga de dependencias.

#### D. Acciones disponibles en el menú

* **Gestión individual:** Iniciar, detener, reiniciar cada servicio por separado; ver logs recientes o seguimiento en vivo.
* **Acciones masivas:** Iniciar, detener o reiniciar todos los servicios del sistema de una sola vez.

---

## 7. Desinstalación

Para detener procesos, quitar servicios y limpiar configuración del proyecto (conservando el código en disco):

```bash
cd ~/Documents/unitree-xvr-stream
sudo ./uninstall.sh
```

Confirme con **SI** cuando lo pida el script.
