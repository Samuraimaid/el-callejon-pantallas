# Red local — IP fija del servidor y Smart TVs

Objetivo: que las TVs siempre abran la misma dirección, por ejemplo:

```text
http://192.168.1.50:5173
http://192.168.1.50:5173/tv/1
…
http://192.168.1.50:5173/tv/6
```

sin tener que reconfigurar favoritos cada día.

---

## Recomendación (la más estable)

### 1) Reserva DHCP en el router (mejor opción)

En lugar de “inventar” la IP solo en Windows, dígale al **router** que el PC servidor **siempre** reciba la misma IP.

1. En un navegador del PC: `http://192.168.1.1` (o la IP del gateway de su red).
2. Inicie sesión (admin del router; a veces está en la etiqueta del aparato).
3. Busque algo como:
   - **DHCP Reservation** / **Reserva de direcciones**
   - **Static Lease** / **IP fija por MAC**
   - **Address Reservation**
4. Agregue el PC del servidor:
   - **MAC del Wi‑Fi o del Ethernet** del PC (en Windows: `ipconfig /all` → *Physical Address*).
   - **IP fija**, por ejemplo: `192.168.1.50`  
     (use un número **fuera del rango dinámico** si el router lo permite, o uno que el menú de reserva acepte).
5. Guarde y reinicie el Wi‑Fi del PC (o reinicie el PC).
6. Verifique: `ipconfig` → IPv4 debe ser siempre `192.168.1.50`.

Ventajas: si reinstalas Windows o cambias de adaptador, en el router solo actualizas la MAC. Las TVs no cambian favoritos.

### 2) IP estática en Windows (alternativa)

Si el router no tiene reserva DHCP:

1. `Win + I` → **Red e Internet** → **Wi‑Fi** (o Ethernet) → la red conectada → **Editar** en *Asignación de IP*.
2. Cambie de **Automático (DHCP)** a **Manual**.
3. Active **IPv4** y use valores de ejemplo (ajuste a su red):

| Campo | Ejemplo (su red actual es 192.168.1.x) |
|--------|----------------------------------------|
| Dirección IP | `192.168.1.50` |
| Longitud de prefijo / máscara | `24` / `255.255.255.0` |
| Puerta de enlace | `192.168.1.1` (su router) |
| DNS preferido | `192.168.1.1` o `8.8.8.8` |
| DNS alternativo | `1.1.1.1` |

4. **Importante:** elija una IP que **nadie más** use. Evite el rango que el router reparte al azar (p. ej. si el DHCP es 100–200, use `.50`).

5. Guarde. En las TVs configure favoritos con esa IP fija.

---

## Cable vs Wi‑Fi en el PC servidor

| Conexión del PC | Recomendación |
|-----------------|---------------|
| **Ethernet al router** | Ideal para el servidor (más estable). |
| Solo Wi‑Fi | Funciona; fije la IP de la interfaz **Wi‑Fi**. |

Si puede, conecte el PC servidor **por cable** al router y reserve/fije la IP de **Ethernet**.

---

## TVs del VIP con repetidor Wi‑Fi (cable al router)

Esquema típico bueno:

```text
Router ──cable──> Repetidor/AP  ))) Wi‑Fi ))) TVs VIP
   │
   └── (Wi‑Fi o cable) PC servidor
```

Para que las TVs VIP vean el servidor **sin drama**:

1. El repetidor debe estar en modo **Access Point / AP / Bridge / Extensor en la misma LAN**,  
   **no** en modo “router” con NAT propio (eso crea otra red tipo `192.168.10.x` y las TVs no ven el PC).
2. Las TVs VIP deben tener IP del **mismo rango** que el servidor, p. ej. todas `192.168.1.x`.
3. En una TV VIP, abra el navegador y pruebe:
   ```text
   http://192.168.1.50:5173
   ```
   (use la IP fija real del servidor).
4. Si no carga:
   - El repetidor está en red aislada (cambie a modo AP).
   - Firewall de Windows bloquea el puerto **5173** (regla entrante TCP 5173).
   - El PC está apagado o dormido (desactive suspensión en el servidor).

### Cómo comprobar en 30 segundos

En una TV o celular conectado al **Wi‑Fi del repetidor**:

- ¿Puede abrir `http://IP_DEL_SERVIDOR:5173`?
- Si **sí** → misma red; favoritos listos.
- Si **no** → el repetidor o el firewall separan redes; revise modo AP y firewall.

---

## Firewall de Windows (una sola vez)

1. Panel de control → Firewall de Windows Defender → **Configuración avanzada**.
2. **Reglas de entrada** → **Nueva regla** → Puerto → TCP → **5173** → Permitir.
3. Aplique a redes **Privadas** (y de dominio si aplica).
4. Nombre: `El Callejon Pantallas 5173`.

(Opcional: también 8000 si usa la API directa; con el proxy del hub basta **5173**.)

---

## Favoritos en las TVs (después de fijar la IP)

| TV | URL de favorito / inicio |
|----|---------------------------|
| #1 | `http://IP_FIJA:5173/tv/1` |
| #2 | `http://IP_FIJA:5173/tv/2` |
| #3 | `http://IP_FIJA:5173/tv/3` |
| #4 | `http://IP_FIJA:5173/tv/4` |
| #5 | `http://IP_FIJA:5173/tv/5` |
| #6 | `http://IP_FIJA:5173/tv/6` |

Si un día cambia la IP del servidor, **todos** los favoritos fallan. Por eso la reserva DHCP o la IP estática son obligatorias en producción.

---

## Checklist del local

- [ ] IP del PC servidor fija (router o Windows).
- [ ] Anotada en un papel/etiqueta: `http://192.168.1.xx:5173`.
- [ ] Firewall permite TCP 5173.
- [ ] PC no se suspende / hiberna (opciones de energía).
- [ ] Docker / `docker compose up -d` arranca al encender (opcional: reinicio automático de contenedores ya está con `restart: unless-stopped`).
- [ ] Repetidor VIP en modo **AP / misma red**, no router doble.
- [ ] Cada TV con su favorito `/tv/1` … `/tv/6`.

---

## Valores de ejemplo (red 192.168.1.x)

| Equipo | IP sugerida |
|--------|-------------|
| Router | `192.168.1.1` |
| **PC servidor** | `192.168.1.50` (fija) |
| Impresoras / otros fijos | `.51`–`.59` |
| DHCP normal (celulares, etc.) | `.100`–`.200` |

Ajuste el `.50` si ya está ocupado; lo importante es que **no cambie**.
