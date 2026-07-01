# CLAUDE.md

Contexto para trabajar en este proyecto: un grupo de agentes que ayudan a una empresa a participar en
procesos de contratación pública en SECOP II (Colombia) — identificar procesos, decidir cuánto cotizar,
preparar documentos, y dar seguimiento al estado de cada proceso en un dashboard.

Visión a futuro: este sistema debe poder replicarse y venderse a otras empresas que participan en SECOP II.
Por eso, todo lo que sea específico de la empresa actual (perfil, reglas de margen, plantillas de documentos)
debe estar separado de lo genérico/reusable (cliente de datos, motor de matching, dashboard).

---

## 1. Restricción crítica de diseño: captcha en SECOP II

- **Datos Abiertos** (`datos.gov.co`, datasets de SECOP II vía API SODA/Socrata) son públicos, sin login,
  **sin captcha**. Sirven para triage masivo y para histórico de adjudicaciones.
- **Plataforma transaccional** (`community.secop.gov.co`) pide captcha **incluso solo para ver el detalle
  de un proceso**, no únicamente al postularse.
- Por esto, la lectura se divide en dos capas:
  - **Capa 1 (autónoma)**: filtrado/triage sobre Datos Abiertos → lista corta de procesos candidatos.
  - **Capa 2 (asistida por humano — `sesion-asistida/`, Playwright)**: el agente controla un Chrome
    **visible** (nunca headless/oculto) con `playwright.chromium.launchPersistentContext`, navega al login
    real y llena usuario/contraseña desde `.env`. Al llegar al captcha, **el script se detiene y le pide al
    humano resolverlo directamente en la ventana** (el agente nunca lee, escribe ni hace clic en el
    captcha). Solo cuando el humano confirma en la terminal, el agente continúa navegando y leyendo
    contenido (`leerProceso.ts`) — selectores reales verificados contra el HTML público del login
    (`#txtUserName`, `#txtPassword`, `#btnLoginButton`, `#txttxtCaptcha`) sin necesidad de loguearse para
    obtenerlos.
  - **Los requisitos de experiencia/perfiles profesionales viven en documentos adjuntos, no en la
    página** (confirmado en vivo 2026-06-27): `leerProceso.ts` descarga el Estudio Previo y la
    Invitación desde la grilla de documentos del proceso (`descargarDocumentos.ts`, sigue el
    redirect real de SECOP `DownloadFile` → `RetrieveFile`) y luego se leen con la herramienta
    `Read` (soporta PDF) para extraer esos datos — no hace falta visión/OCR.
- La radicación final (login + captcha + clic de "enviar oferta") siempre la ejecuta un humano. El agente
  puede llegar a controlar el navegador hasta el formulario de oferta (`cargarOferta.ts`, fase 2, aún sin
  selectores reales) y adjuntar archivos, pero **nunca hace clic en el botón final de enviar/radicar** —
  eso es zona gris legal/ToS de un sitio gubernamental y una decisión contractual vinculante que requiere
  control humano explícito en cada paso sensible (incluyendo si el captcha reaparece más adelante).
- **Confirmado con el dueño del proceso (2026-06-27):** el captcha NO aparece todo el tiempo — solo pide
  verificación si se abre el proceso en una pestaña nueva o si pasa un tiempo determinado sin uso. Por eso
  `sesion-asistida/` usa un perfil de Chrome persistente (guardado en
  `~/secop-documentos/<nit>/sesion-chrome/`, fuera del repo) — si la sesión sigue vigente, scripts nuevos no
  vuelven a pedir login ni captcha.

---

## 2. Arquitectura de agentes

1. **Scout/Analista** (`scout/`) — consulta Datos Abiertos SECOP II, filtra por perfil de la empresa
   (UNSPSC, ubicación, modalidad, rango de presupuesto, entidad), produce lista corta priorizada.
2. **Puerta de aprobación humana #1** — antes de cotizar, el humano aprueba o descarta cada proceso desde
   el dashboard (estado `por_revisar` → `aprobado_cotizar` / `descartado`).
3. **Financiero** (`financiero/`) — para cada proceso aprobado, cruza histórico de adjudicaciones similares
   con reglas de costos/margen de la empresa y recomienda valor a cotizar, margen esperado y riesgo.
4. **Puerta de aprobación humana #2** — antes de radicar, el humano revisa la recomendación y documentos
   (estado `cotizado` → `aprobado_radicar`).
5. **Documental** (`documental/`) — lee `~/secop-documentos/<nit>/manifest.json` (documentos de empresa,
   fuera del repo) y `financiero/` para generar carta de presentación + oferta económica por proceso, y
   detecta qué documentos de empresa faltan o están vencidos antes de intentar nada. La carga real al
   formulario de SECOP la hace `sesion-asistida/cargarOferta.ts` (fase 2, ver sección 1) — siempre se
   detiene antes del clic final de enviar, que lo da un humano.
6. **Dashboard** (`dashboard/`) — registra procesos detectados y su estado: `por_revisar` → `aprobado_cotizar`
   / `descartado` → `cotizado` → `aprobado_radicar` → `radicado` → `en_evaluacion` → `adjudicado` / `rechazado`.
   Ya construido como mínimo funcional (ver sección 6).

Cada carpeta debe ser autocontenida: módulo + su propia lógica, sin mezclar agentes entre sí.

---

## 3. Stack

| Capa | Elegido | Notas |
|---|---|---|
| Scout / Financiero | Node.js + TypeScript | cliente HTTP contra API SODA de datos.gov.co |
| Documental | Node.js + TypeScript | generación de documentos desde plantillas |
| Sesión asistida (`sesion-asistida/`) | Node.js + TypeScript + **Playwright** | controla un Chrome real y visible — nueva dependencia agregada el 2026-06-27, justificada explícitamente para esta tarea (login asistido + lectura de pliego + carga de documentos, ver sección 1) |
| Dashboard frontend | React + TypeScript + Vite + TailwindCSS + TanStack Query | mismo patrón usado en otros proyectos del usuario |
| Dashboard backend | Node.js + Express + TypeScript + Prisma | **Postgres (Railway)** — mismo `DATABASE_URL` en dev y producción (ver `docs/despliegue-dashboard.md`). El backend sirve también el build del frontend (`dashboard/backend/public`) para desplegar como un solo servicio. |
| Validación | Zod | |

`financiero/` sigue el mismo patrón de `scout/` (Node+TS, sin librerías externas todavía).

Sin librerías nuevas fuera de esta lista sin justificarlo antes.

Puertos fijos en desarrollo (para no chocar con el otro proyecto del usuario, la app de mascotas, que
ocupa 5173): backend `4000`, frontend `5180`.

---

## 4. Datasets de Datos Abiertos relevantes

- **SECOP II - Procesos de Contratación**: `p6dx-8zbt` (datos.gov.co) — procesos publicados, adjudicados o no.
- **SECOP II - Contratos Electrónicos**: `jbjy-vk9h` (datos.gov.co) — contratos derivados, valores finales.

API SODA: `https://www.datos.gov.co/resource/<dataset-id>.json` con parámetros `$where`, `$limit`, `$q`, etc.

---

## 5. Perfil real de la empresa (Verde Ecológico) — confirmado 2026-06-27

**Nicho:** procesos de **mínima cuantía** cuyo objeto sea interventoría técnica, administrativa y contable
(ver `scout/src/index.ts`, filtro ya implementado y probado contra datos reales).

- **Filtro del Scout:** modalidad = "Mínima cuantía" · objeto contiene INTERVENTOR + TECNIC + ADMINISTRATIV
  + CONTABLE · publicado en los últimos 30 días · precio base ≤ $200.000.000 COP.
- **Alcance geográfico:** nacional, sin restricción de departamento/ciudad.
- **Meta de negocio:** hasta 50 procesos **adjudicados** (no solo propuestos) por mes — es la meta a la que
  apunta automatizar, no la capacidad actual.
- **Volumen actual (manual):** 2 procesos por semana, de principio a fin (~8/mes).
- **RUP:** no se exige en mínima cuantía. Documentos de la empresa al día.
- **Reglas de cotización (Agente Financiero):**
  - Mínima cuantía se adjudica al menor valor presentado.
  - Descuento máximo aceptable sobre el presupuesto oficial: **18%**.
  - **Confirmado (2026-06-27): el % de utilidad e imprevistos NO es fijo** — varía por proceso. El Agente
    Financiero debe recibirlo como parámetro de entrada (con un valor sugerido editable), nunca hardcodeado.
  - **Recibido (2026-06-27): formato económico real** — ver
    `docs/empresa/formula-cotizacion-interventoria.md` (transcrito y limpiado del Excel original). Define
    personal profesional + prestaciones + impuestos/pólizas + otros costos administrativos → subtotal →
    + utilidad% + imprevistos% (parámetros variables) → + IVA 19% → costo total.
- **Firma electrónica/digital:** sí existe, se proporcionará la imagen.
- **Credenciales de SECOP:** las proporciona el usuario. **Nunca deben guardarse en el código ni en git** —
  van en variables de entorno (`.env`, ya en `.gitignore`) o un gestor de secretos.
- **Confirmado (2026-06-27): "empresas" en plural es literal.** Hay varias razones sociales presentándose
  en paralelo. El dashboard ya modela esto: modelo `Empresa` (`nombre`, `nit`, sin campo de contraseña — las
  credenciales de SECOP de cada una viven solo en `.env`/gestor de secretos) relacionado 1-a-muchos con
  `Proceso`.
- **Flujo de aprobación (dos puertas, vía correo a `gerente@verdeecologico.com.co`):**
  1. Después de cotizar: se envía costeo interno, ganancia esperada y confirmación de carga de documentos.
  2. Antes de publicar la participación (después de cargar documentos): segunda notificación.
  - **Confirmado (2026-06-27): el correo es solo aviso — la aprobación real se hace en el dashboard**, igual
    que los botones de aprobación que ya existían. Implementado en
    `dashboard/backend/src/modules/procesos/procesos.notificaciones.ts` + `config/email.ts` (si no hay SMTP
    configurado en `.env`, simula el envío con un log en consola en vez de fallar).

---

## 6. Estado del proyecto

- [x] Estructura de carpetas creada.
- [x] Cliente de Datos Abiertos (Agente Scout) — `scout/`, probado contra la API real (`p6dx-8zbt`).
- [x] Dashboard mínimo — `dashboard/backend` (Express+Prisma+SQLite, modelo `Proceso`, endpoints CRUD +
      cambio de estado) y `dashboard/frontend` (React+Vite+Tailwind+TanStack Query, tabla de procesos +
      detalle con las dos puertas de aprobación). Sembrado con datos de ejemplo (`prisma/seed.ts`),
      verificado end-to-end (backend `:4000` ↔ frontend `:5180`).
- [x] Perfil de negocio confirmado y filtro del Scout actualizado en código (sección 5).
- [x] Modelo `Empresa` (varias razones sociales en paralelo) + notificación por correo (aviso) en las dos
      puertas de aprobación — ver sección 5.
- [x] Formato económico real recibido y transcrito — `docs/empresa/formula-cotizacion-interventoria.md`.
      Confirmado que utilidad/imprevistos son parámetros por proceso, no valores fijos — listo para
      implementar el cálculo en `financiero/` cuando se priorice esa fase.
- [ ] Hoja de vida Persona Jurídica (Función Pública) — solo se recibió el **instructivo** (sin datos
      diligenciados), ver `docs/empresa/hoja-vida-funcion-publica-instructivo.md`. El usuario confirmó que
      todavía no tiene el formato diligenciado — no es bloqueante, queda pendiente para la fase del Agente
      Documental.
- [ ] Documentos de la empresa (RUT, Cámara de Comercio, certificaciones, firma digital) y credenciales
      reales de SECOP por cada empresa — **pendiente de que el usuario los comparta**. Cuando lleguen:
      credenciales solo en `.env`, nunca en git; el resto se modela como datos reusables del Agente Documental.
- [x] SMTP real configurado y verificado (Brevo) — las notificaciones de las dos puertas ya se envían de
      verdad a `gerente@verdeecologico.com.co`. Notas de configuración:
      - Usar `SMTP_HOST=smtp-relay.sendinblue.com` (no `smtp-relay.brevo.com`): el certificado TLS del
        servidor de Brevo en este momento no incluye el dominio nuevo en sus SAN, solo el legado.
      - El servidor Express necesitaba `import "dotenv/config"` al inicio de `server.ts` — antes no se
        estaba leyendo `.env` en absoluto (solo Prisma lo carga automáticamente por su cuenta).
      - Brevo restringe por IP autorizada por defecto (Settings → SMTP & API → IP Access); hay que activar
        la IP desde donde corre el backend.
- [x] Agente Financiero (`financiero/`) construido y calibrado — replica la fórmula real
      (`docs/empresa/formula-cotizacion-interventoria.md`) con utilidad/imprevistos como
      parámetro de entrada, y evalúa el resultado contra el límite del 18% de descuento sobre
      presupuesto oficial (`evaluarFrenteAPresupuesto`, con clasificación de riesgo bajo/medio/alto).
- [x] Calibración del Scout (2026-06-27): se encontraron y corrigieron dos problemas reales:
      1) faltaba excluir procesos ya adjudicados o con plazo de recepción de ofertas vencido
         (`soloVigentes`, usa `adjudicado` y `fecha_de_recepcion_de`) — antes el Scout podía
         devolver procesos en los que ya no se puede ofertar.
      2) el filtro de palabras clave exigía las 4 palabras a la vez (AND), excluyendo
         interventorías reales que no usan literalmente "contable" o "técnica" juntas. Ahora es
         `palabraClaveObligatoria: "INTERVENTOR"` + `palabrasClaveAlguna` (OR) para el resto.
- [x] **Ejemplo real end-to-end verificado (2026-06-27)**: proceso `CO1.REQ.10532988` (CENAC
      INGENIEROS, interventoría mantenimiento baterías sanitarias, presupuesto $59.524.000)
      encontrado por el Scout calibrado → cargado al dashboard → aprobado en puerta #1 →
      Agente Financiero calculó costo real $42.885.774 → recomendó ofertar $48.809.680 (18% de
      descuento, margen 13.8%, riesgo bajo) → notificación enviada (marcada como calibración) →
      aprobado en puerta #2 → notificación de "listo para radicar" enviada (también marcada).
      Las credenciales reales de SECOP de Verde Ecológico ya están en `.env` (solo para uso
      manual humano al loguearse — nunca para automatizar el login/captcha).
- [x] **Sesión asistida construida (2026-06-27)** — `sesion-asistida/` con Playwright (Chrome real,
      visible, nueva dependencia explícitamente justificada y aprobada). `iniciarSesion.ts` llega
      al login real con selectores verificados, llena usuario/contraseña, y se detiene si aparece
      el captcha esperando confirmación humana en la terminal. `leerProceso.ts` navega a un proceso
      ya autenticado y extrae fragmentos de experiencia/perfiles profesionales del pliego.
      `cargarOferta.ts` queda diseñado (fase 2, selectores reales pendientes — solo se pueden ver
      con sesión autenticada) y **nunca** debe hacer clic en el botón final de enviar/radicar.
- [x] **Sesión asistida verificada en vivo (2026-06-27)** — login real exitoso (sin necesitar
      captcha esta vez, consistente con que solo aparece tras inactividad). Se descubrieron y
      corrigieron dos comportamientos reales de SECOP no documentados antes:
      1) si la sesión guardada sigue válida, SECOP redirige automáticamente fuera del login con
         un retraso variable (2s a 25s+) e independiente de cuándo el script intenta llenar el
         formulario — `iniciarSesion.ts` ahora trata cualquier interrupción del llenado como
         "ya estaba logueado" en vez de fallar, en lugar de adivinar el tiempo de espera exacto.
      2) **Los requisitos de experiencia y perfiles profesionales NO están en el texto de la
         página del proceso** — viven en documentos PDF adjuntos (Estudio Previo, Invitación)
         dentro de una grilla `#grdGridDocumentList_tbl`. Cada fila tiene un link con
         `documentFileId` + `mkey` que apunta a `/Public/Tendering/.../DownloadFile`, el cual a
         su vez devuelve un stub JS que redirige a `/Public/Archive/RetrieveFile/Index?...` (la
         URL real del archivo) — `descargarDocumentos.ts` ya implementa ambos saltos y descarga
         el PDF real usando las cookies de la sesión (sin clics simulados). Verificado con el
         proceso real `CO1.REQ.10532988`: se descargaron y leyeron el Estudio Previo y la
         Invitación, extrayendo el personal mínimo exigido (Residente de Interventoría: Ing.
         Civil/Arquitecto, posgrado Hidrosanitaria, 10 años exp. general/4 específica; Residente
         SST) y la experiencia habilitante de empresa (≥1 contrato de interventoría de baterías
         sanitarias/redes hidrosanitarias, ≥30% del presupuesto oficial).
- [x] **Agente Documental construido (2026-06-27)** — `documental/` lee
      `~/secop-documentos/<nit>/manifest.json` (documentos de empresa, **fuera del repo por
      decisión del usuario**), detecta documentos faltantes/vencidos, y genera carta de
      presentación + oferta económica (texto plano por ahora; PDF con el formato exacto del
      pliego queda pendiente hasta que un caso real lo exija). Probado con el proceso de ejemplo
      `CO1.REQ.10532988` — detectó correctamente que faltan los 6 documentos de empresa (ninguno
      ha sido compartido aún).
- [x] Modelo `DocumentoProceso` agregado a `schema.prisma` (tipo, ruta del archivo en
      `~/secop-documentos/...`, estado generado/cargado/confirmado) + módulo backend
      `dashboard/backend/src/modules/documentos/` + checklist real en `ProcesoDetail.tsx`.
- [x] **Campo `resumenPliego` en `Proceso` (2026-06-27)**: texto con experiencia, perfiles
      profesionales, plazo, alcance y garantías extraídos del Estudio Previo real — se muestra en
      `ProcesoDetail.tsx` (sección colapsable) para que el humano apruebe con contexto completo
      sin tener que abrir el pliego. Cargado para `CO1.REQ.10532988` como ejemplo real.
      **Nota técnica:** el esquema volvió temporalmente a `provider = "sqlite"` (se había puesto
      `postgresql` para el despliegue) porque no hay Postgres local — `prisma db push` en vez de
      `migrate dev` (no hay migraciones formales todavía, solo dev). Cambiar a `postgresql` recién
      antes de desplegar en Railway (ver `docs/despliegue-dashboard.md`, paso 0).
- [ ] Abstracción para replicar a otras empresas (solo después de validar con la empresa propia).
- [x] Preparado para despliegue permanente (2026-06-27): backend sirve el build del frontend,
      Postgres en vez de SQLite, `package.json` raíz con build/start, guía paso a paso en
      `docs/despliegue-dashboard.md` (Railway). **Decisión explícita del usuario: sin login por
      ahora**, aunque se recomendó agregar autenticación antes de compartir la URL ampliamente.

Seguir el orden de prioridad indicado por el usuario en cada sesión, no avanzar de fase sin que se pida.

Cómo correr el dashboard en desarrollo:

```bash
# backend
cd dashboard/backend
npm install
cp .env.example .env   # completar SMTP si se quiere correo real; si no, se simula en consola
npx prisma migrate dev
npm run seed   # empresas y procesos de ejemplo
npm run dev    # http://localhost:4000

# frontend
cd dashboard/frontend
npm install
npm run dev    # http://localhost:5180
```
