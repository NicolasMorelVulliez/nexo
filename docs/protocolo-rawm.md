# Protocolo HID de los mouses RAWM

Fuente: ingeniería inversa, por interoperabilidad, del configurador web oficial
(`https://www.rawmtech.com/hub.html` → `https://hub.miracletek.net/hub/js/library.min.js`, ofuscado con
obfuscator.io; se desofusca con `tools/rawm-deob/deob.cjs`), más la tabla de dispositivos embebida en
RAWMHUB 2.0.0.3. Lo marcado **[hardware]** se verificó contra el receptor real 1915:233C; lo demás sale del
código del configurador.

Código: `src/protocol/rawm.ts` (códec), `src/devices/rawm.ts` (driver), `src/devices/rawm-models.ts`
(modelos), `src-tauri/src/hid.rs` (`mod rawm`, solo el pedido de estado para la bandeja).

## Dispositivo

- VID `0x1915`. Receptores (`233C` "RAWM Receiver", `233B`/`2346`/`234B` "HS", `232A`, `232B`, `2335`…) y
  mouses por cable (`2333` ES21, `2341` ES11, `233A` G11…). Tabla completa en `rawm-models.ts`.
- Colección vendor: **usagePage `0xFF00`, usage `0x01`** (interfaz 2 del receptor) **[hardware]**.
- Reportes **sin report ID** (WebHID `sendReport(0, data)`; hidapi antepone `0x00`), de **64 bytes** en las dos
  direcciones **[hardware]**.

## Paquetes (reportes de 64 bytes)

```
directo (cable o el propio receptor):  [0x80 | n] [n bytes de flujo]            n ≤ 63
al mouse detrás del receptor:          [0xC0 | canal] [0x80 | n] [n bytes]       n ≤ 62, canal 0 = mouse
```

Byte de tipo: `0x00` crudo · `0x40` tamaño de buffer · `0x80` datos de evento · `0xC0` extendido (lleva canal).

Entrada: mismo formato. El receptor manda continuamente `C0 52 <free u32 LE> … <total u32 LE en [15..18]>`
para el canal 0 **[hardware]** (≈1000 por segundo). `free` = bytes libres en su buffer hacia el mouse.

**Control de flujo** (receptores con `limit_memory`, como el 233C): después de mandar un paquete al canal 0 no se
manda otro hasta recibir un aviso con `free ≥ 240` (`(32 − 2) × 8`). Con el mouse enlazado el receptor **no avisa
solo**: hay que preguntarle con `[0xC0 | canal] [0x40]` (el configurador lo hace cada 25 ms) y responde
`C0 52 F0 00 00 00 …` = 240 libres **[hardware]**. Con el mouse dormido/apagado/por cable informa `free = 0` sin
parar (~1000 avisos por segundo) **[hardware]**.

## Flujo de eventos

Los paquetes transportan un flujo de bytes. Cada evento:

```
[cmd | ((len >> 4) & 0xF0)] [len & 0xFF] [cuerpo…]      len = longitud total, cabecera incluida (12 bits)
```

En la dirección dispositivo → host cada mensaje va precedido por `FF FF FF FF` **[hardware]**. Si el buffer no
arranca con ese marcador, el configurador descarta y se resincroniza tras 1 s sin datos.

Comandos (nibble bajo): `1` QUERY · `2` QUERY_RESULT · `3` CONFIG · `6` ACTION · `7` SYNC · `B` NOTIFY ·
`C` RAW_DATA · `D` LOG · `E` PING.

**CRC**: si el estado trae `"crc":1`, cada evento se envuelve como
`[3 | ((L>>4)&0xF0)] [L & 0xFF] [0x24] [crc lo] [crc hi] [evento original]` con `L = len + 5` y
CRC-16/CCITT-FALSE (init `0xFFFF`) del evento original.

## Leer el estado

Pedido: `CMD_QUERY` = `[01 0D] [03 = OS_PC] [00 00] [segundos Unix, 8 bytes LE]` **[hardware]**.

Respuesta: `CMD_QUERY_RESULT` con **JSON de texto** (terminado en `\0`). Receptor real **[hardware]**:

```json
{"r":"1.0.2","rc":3,"hw":3,"dn":"RAWM Receiver","pi":9020,"vi":6421,"esb_addr":"2f4c0153304400000000000000000000"}
```

Claves del mouse (según `parse_device_info`): `dn` nombre, `pi`/`vi` PID/VID, `r` firmware, `battery` %,
`chr` cargando, `cpi` CPI activo, `cpi_l` 8 niveles, `cpi_l_c` color por nivel, `polling` Hz, `pm` modo de
energía, `lod` (1 bajo, 2 alto / 3), `kd` debounce por botón, `ms` motion sync, `at` ajuste de ángulo (con signo),
`as` angle snapping, `rctrl` ripple, `light` byte de LED, `lbn` brillo, `st` suspensión (s), `crc`, `wired`,
`sst` sensor, `ob`, `ocs`, `gm`, `top`/`atp` potencia de TX.

CPI: `x | (y << 16)`; `y = 0` → igual a `x`.

Después del estado el mouse puede mandar `CMD_NOTIFY` (`[0B len] [tipo] [datos]`): `00` CPI (u16), `06` CPI
(u32), `01` polling, `02` luz, `05` modo de energía, `07` LOD, `08` debounce (bytes), `0D` motion sync, `0E` ángulo,
`0F` angle snap, `10` ripple, `16` tabla de batería (u16 mV), `17` batería `[%, cargando]`, `1A` suspensión (u16).
También llegan cuando se cambia algo desde el mouse (botón de DPI).

## Escribir

**`CONFIG_TYPE_MOUSE_PARAM` (0x15)** lleva TODO el estado (se lee, se modifica y se reenvía entero):

```
03 len 15
cpi u16 (0 si es de 32 bits) · polling u16 · light (| 0x08 LED_FLAG)
n + n × u16 niveles (n = 0 si alguno es de 32 bits)
onboard · powerMode
cpi u32 (0 si entra en 16) · n + n × u32 niveles (n = 0 si entran en 16)
lod · n + n × keyDelay · motionSync · angleTuning · angleSnapping · rippleControl
n + n × (color de nivel & 7) · txOutputPower · n + n × u16 batteryLevels · autoTxPower
n + n × onboardStatus · glassModeEnabled
```

Otros: `CONFIG 0x21` suspensión (u16 segundos, 10–1800) · `CONFIG 0x31` brillo (u8) · `CONFIG 0x12` luz del
receptor.

## Botones (perfiles en flash)

El mouse tiene `ocn` perfiles (ES21: 4) y usa el `oci`. Después del estado manda `NOTIFY 0x14`: un byte = empieza
el perfil N (`FF` = fin); más bytes = un registro del perfil. Perfil 0 del ES21 real **[hardware]**:

```
03 08 16 01 0a 00 01 01   M1 (10) → MOUSE_KEY tipo 1 (botón) código 1 = izquierdo
03 08 16 01 0b 00 01 02   M2 (11) → derecho          03 08 16 01 0c 00 01 03   M3 (12) → medio
03 08 18 01 0d 02 0e 00   M4 (13, oculto) → MOUSE_FUNCTION press, 0x0E mostrar batería
03 08 16 01 0e 00 01 04   M5 (14, lateral trasero) → 4 atrás
03 08 16 01 0f 00 01 05   M6 (15, lateral delantero) → 5 adelante
03 08 18 01 10 02 01 00   M7 (16, DPI) → función 0x01 ciclar DPI
```

- `MOUSE_KEY` (0x16): `[03 len 16 n ids… mod tipo código mod2 00]`. Tipos: 0 teclado (usage HID; `mod` = usage del
  modificador, `E0` Ctrl, `E2` Alt), 1 botón (1 izq, 2 der, 3 medio, 4 atrás, 5 adelante), 3 rueda (`0x40 ± n`),
  4 multimedia (1 silencio, 2 vol+, 3 vol−, 4 play, 5 stop, 6 anterior, 7 siguiente, 8 correo, 9 calculadora),
  5 rueda horizontal.
- `MOUSE_FUNCTION` (0x18): `[03 len 18 n ids… toque función dato_lo dato_hi 00 txtlen_lo txtlen_hi txt…]`, toque 2 =
  al presionar. Funciones: 1 ciclar DPI, 2 DPI+, 3 DPI−, 9 DPI mientras se mantiene, 0x0E batería, 0x11–0x14 perfiles.
- Sin registro = botón desactivado. Macros: tipos 0x05 / 0x2B (Nexo los conserva sin tocarlos).
- **Guardar** (reescribe el perfil entero): `CONFIG 03` (reset) → `ACTION 0x34 = 1 | perfil<<8` → todos los
  registros → `ACTION 0x34 = 0`.

Byte `light`: bit0-2 B/G/R · 3 FLAG · 4 CPI (color según nivel de DPI) · 5 AUTO_OFF · 6 ROTATE (arcoíris) ·
7 BLINK. Modos del configurador: 1 = ROTATE, 2 = color fijo, 3 = CPI.

Debounce (`keyDelay`): nibble bajo = retardo al presionar, 1–10 ms; el nibble alto se conserva.

## Estado de verificación

- Verificado en hardware (receptor 233C y ES21 por cable, firmware 1.0.0): colección, tamaño de reportes,
  `CMD_QUERY` y respuesta JSON, marcador `FF FF FF FF`, avisos de buffer del canal 0, NOTIFY de batería y tabla de
  batería, y **`MOUSE_PARAM` con CRC** (reenvío sin cambios + polling 1000 → 500 → 1000; el JSON completo de
  43 campos quedó idéntico al original). Prueba: `tools/hid-probe/rawm-write-test.mjs`.
- El primer `CMD_QUERY` después de un rato sin actividad a veces no tiene respuesta: el driver reintenta (3 × 1,2 s).
- Con el cable enchufado el mouse anda por USB y el receptor queda sin enlace (`free = 0`): se prefiere el cable.
- **Por el receptor 2.4G (canal 0, control de flujo)**: lectura y 11 escrituras con ida y vuelta — reenvío sin
  cambios, polling, 3 niveles de DPI + nivel activo, LOD, modo de energía, debounce, motion sync / angle snap /
  ripple, suspensión, brillo, luz fija roja sin apagado en reposo, arcoíris. Todas se aplicaron y el mouse quedó con
  la configuración original (31 campos idénticos). Prueba: `tools/hid-probe/rawm-write-suite.mjs --pid=233c`.
- Rust (`hid.rs`): `cargo test --lib -- --ignored rawm_real` lee el ES21 real por el receptor (solo lectura).
- Remapeo: `tools/hid-probe/rawm-remap-test.mjs` (ida y vuelta, con respaldo del perfil en JSON).
- Ajuste de ángulo (`at`) y perfiles distintos del activo: se conservan tal cual.

ES21 real por cable (`{"dn":"ES21","pi":9011,"r":"1.0.0","crc":1,"sst":"PAW3395","cpi_l":[800,0,…],"kd":[8×7],
"light":48,"lbn":128,"st":60,"pm":2,"lod":2,"top":7,"atp":0,"ocs":[129,130,134,132],"gm":[0,0],…}`).
