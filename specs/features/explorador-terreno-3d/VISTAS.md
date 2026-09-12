# Explorador Terria — Propuesta de vistas (3 features)

> Estado: **IMPLEMENTADO en `feat/explorador-terreno-3d`** — verificación visual en curso.

Objetivo: una interfaz donde el mapa **es** la pantalla. Relieve y terreno como único lenguaje visual, sin cajas sobre cajas, y una vista 3D **real** modelada con `vgpu` (WebGPU) al tocar un pin.

---

## Contexto (qué hay hoy)

La captura corresponde a `master` en `~/hackathon/terria-frontend`. Sobre el mapa conviven hoy:

- Pill "Ver en 3D" + pill de nivel de zoom + leyenda NDVI (arriba-izq)
- Selector de 5 estilos de mapa (arriba-der)
- `FieldHectaresInspector`: card oscura grande con switcher de campos, barra de hectáreas y lista de lotes (abajo-izq)
- Controles de zoom + reset (abajo-der)
- `TimelapseController`: dock completo flotando sobre el mapa cuando hay campo activo
- Markers de campos como pills con nombre + ha, y badges flotantes por lote
- Popup hover con ~8 líneas de datos
- Panel derecho: detalle con 4 tabs (Resumen / Timelapse / Futuro / Solana) + barra sticky "Solicitar Arrendamiento / PDF / Link"

Es demasiado: hay 6–8 elementos flotantes pisándose entre sí sobre el mapa.

## Principios anti-slop (aplicar a todo)

Skill de referencia: `lazo-design-ui` — **solo por sus reglas estructurales** (jerarquía de superficies, radios, sombras, números tabulares). **No** adoptamos su paleta: los colores siguen siendo los tokens Terria (`bosque`, `musgo`, `tierra`, `nube`, `papel`, `piedra`, `cielo`).

1. **Una superficie por capa.** Nada de cards dentro de cards dentro de panels. La jerarquía se da con tipografía y espaciado, no con bordes anidados.
2. **Máximo un elemento flotante por esquina** del mapa.
3. **El mapa manda.** Todo overlay es delgado, translúcido (`bg-papel/80 backdrop-blur`), sin sombras pesadas.
4. **Un acento por pantalla.** Verde musgo para lo activo; el resto neutro (bosque/piedra).
5. **Números tabulares** (`font-variant-numeric: tabular-nums`) en ha, NDVI, fechas.
6. **Si no agrega decisión, se va.** Pills informativos, breadcrumbs, hints de "arrastrá para navegar": afuera.

---

## Feature 1 — Vista mapa: solo relieve y terreno

**Qué se ve:** el mapa a pantalla completa en estilo único "Relieve & Terreno": Esri World Topo como base + capa `hillshade` (sombras de relieve, fuente `raster-dem` gratuita) + `terrain` 3D nativo de MapLibre siempre activo. Sin selector de estilos — hay **un solo modo**, el de relieve.

**Encima del mapa, solo:**

| Elemento               | Posición         | Detalle                                                                                                                              |
| ---------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Pins de campos         | sobre el terreno | Punto simple (dot verde + halo), sin pill con nombre ni ha. El nombre aparece solo en hover (tooltip mínimo: nombre + ha).           |
| Lotes del campo activo | sobre el terreno | Polígonos NDVI planos sobre el relieve + línea de perímetro. Sin badges flotantes por lote (se leen en el polígono o en el tooltip). |
| `+` `−` zoom           | abajo-der        | Solo eso. El botón "reset a globo" se va (el reset es alejarse).                                                                     |

**Se elimina del mapa:**

- `FieldHectaresInspector` completo (la card oscura) → su info útil (nombre, ha, lotes) ya vive en el panel derecho y en los polígonos.
- Pill de nivel de zoom ("Órbita Global…"), leyenda NDVI flotante (queda a lo sumo un `i` chiquito expandible), pill "Ver en 3D" (la vista 3D pasa a ser el resultado natural de tocar un pin — ver Feature 2).
- Selector de estilos de mapa (5 → 1: relieve).
- Hint "Arrastrá para navegar…".
- `WebGpuCosmicGrid` de fondo (shader decorativo detrás de una app que es 95% mapa no se ve; simplifica).

**Alrededor del mapa (fuera del viewport):**

- Header se achica a una barra fina: marca `TERRA` + buscador + contador de parcelas. Sin botón "Registra tu campo" (no hace nada hoy).
- Columna derecha: lista de campos simplificada (nombre, localidad, ha, punto NDVI — una fila escaneable, no una card con 5 secciones).
- `TimelapseController` deja de flotar sobre el mapa: vive dentro del tab "Timelapse" del panel derecho.

## Feature 2 — Tap en pin → vista 3D real modelada con `vgpu`

**Interacción:** tocar un pin (o un polígono) → el viewport izquierdo hace una transición cinematográfica y se convierte en una **maqueta de terreno real** del campo, renderizada con `vgpu` (WebGPU). Ya no es un plano con pitch — es una escena 3D propia.

### Cómo modelamos el terreno real (respuesta a "como vamos a modelar el terreno real?")

Pipeline con `vgpu` (la lib ya instalada — expone `draw`, `geometry`, `uniforms`, `sampler`, `frameLoop`):

1. **Datos de elevación reales:** fetch de tiles `raster-dem` gratuitos que cubren el bbox del campo + entorno — Mapterhorn (`tiles.mapterhorn.com`) o AWS Terrarium (`elevation-tiles-prod`, z≤15). Se decodifican a un heightmap `Float32` (Terrarium: `R*256 + G + B/256 − 32768`).
2. **Malla de terreno:** grid de ~256×256 vértices creado con `geometry()`; el vertex shader WGSL samplea el heightmap y desplaza cada vértice en Y con **exageración 2.5–4×** (la pampa es plana — sin exagerar no se lee nada).
3. **Shading "bien marcado y lindo":** normales por diferencias finitas → sol direccional cálido + ambiente suave; tinte hipsométrico (verde bajo → tierra/rostizos alto) que se **mezcla con el ramp NDVI** dentro del perímetro del campo; curvas de nivel opcionales calculadas en el fragment shader; bordes de lotes como cintas extruidas que siguen el relieve; halo en el perímetro del campo.
4. **Cámara:** orbit propia (drag = rotar, wheel/pinch = zoom, damping suave) — ~100 líneas, matrices via `uniforms`.
5. **Atmósfera:** niebla de horizonte suave + pedestal/borde del diorama con el color `nube` de fondo. Sin post-procesado pesado.
6. **Fallback:** si el browser no tiene WebGPU → `Field3DIsoViewer` se reemplaza igual por una vista MapLibre con `terrain`+`pitch` (no volvemos a Three.js).

**Info mínima encima:** una sola tira fina abajo — nombre del campo, ha, NDVI, y `‹ Volver` que restaura el mapa. Nada más flota sobre la escena.

**Panel derecho:** muestra el detalle del campo (versión liviana de Feature 3). El estado "campo activo" es una sola cosa: terreno 3D + panel de datos.

**Decisión de diseño (confirmada):** `Field3DIsoViewer` actual (Three.js, estratos de suelo fake, pins, dock de KPIs) **se jubila** — la escena `vgpu` con elevación real la reemplaza. Más honesto, más lindo, y queda toda la visualización en WebGPU (`vgpu` ya es dependencia del proyecto).

## Feature 3 — Panel de detalle liviano + chau "Solicitar Arrendamiento"

**Se elimina entera la barra sticky inferior:** `Solicitar Arrendamiento`, `PDF` y `Link` — los tres afuera (confirmado: "si chau").

**El panel queda así:**

- Header: `‹` volver + nombre del campo + localidad. Un badge (Verificado) como mucho.
- Tabs visibles: **2** — `Resumen` (superficie, aptitud, suelo, napas, historial) y `Timelapse` (NDVI, clima, slider temporal que ya no tapa el mapa).
- **`Futuro` (valuación) y `Solana` (auditoría) no desaparecen** — son vistas propias. El panel suma un botón **"Ampliar datos"** que abre una vista expandida (sheet/modal a pantalla amplia) con esos contenidos completos, en vez de apretarlos en tabs chiquitos.
- Contenido de Resumen: en vez de 4 `MetricStatBox` + cards anidadas, una lista plana de definiciones (`Superficie — 246.4 ha`, `NDVI — 0.34`, `Suelo — Argiudol…`) con separadores finos. Menos boxes, más aire.

---

## Decisiones — ya respondidas

1. **Repo:** trabajo sobre la base de `master` (la versión de la captura, con el rebrand) y pusheo al **fork** `JMReader/terria-frontend` — es donde sos dueño.
2. **Maqueta 3D:** se reemplaza por terreno real en `vgpu` — pipeline arriba en Feature 2.
3. **PDF / Link / Solicitar Arrendamiento:** los tres afuera.
4. **Futuro / Solana:** quedan como vistas expandidas vía botón "Ampliar datos" — no se fusionan ni se borran.
5. **Selector de estilos:** eliminado — solo relieve/terreno.
6. **Leyenda NDVI:** `i` chiquito expandible o nada (el color ya se explica en el tooltip).
7. **Timelapse:** dentro del tab Timelapse del panel, nunca flotando sobre el mapa.

## Fuera de alcance (por ahora)

- Landing (Hero, CertificateSection, SiteFooter) — no se toca.
- Backend, timelapse engine, datos NDVI — no se toca.
- Mobile/responsive fino — se revisa después de acordar el desktop.
