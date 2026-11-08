# Guion del video (máximo 10 minutos)

**Qué grabar:** la pantalla con una terminal (PowerShell o la de VS Code) ejecutando los scripts reales, con la cámara o la voz del integrante que presenta cada parte. Grabar con OBS Studio o con la grabadora de Windows (`Win + Alt + R`) o Xbox Game Bar. Subir a YouTube como **no listado** o a Drive con enlace de lectura, y pegar el enlace en `informe_fuente/config.json` → `video_url`, luego regenerar el PDF.

Antes de grabar: abrir la terminal en la carpeta `Grupo_AE3_U3_Entrega` y subir el tamaño de letra (Ctrl + rueda del ratón) para que se lea.

| Tiempo | Quién | Qué se muestra (comando) | Qué se dice |
|---|---|---|---|
| 0:00–0:40 | Todos (presentación) | Portada del informe PDF | Nombres, curso, reto: HCE de hospitalización de la Gobernación de Antioquia en MongoDB. |
| 0:40–1:40 | Integrante 1 | `capturas/00_diagrama_modelo.png` y `mongosh --file scripts/01_crear_esquema.js` | Modelo híbrido: qué se embebe y qué se referencia; nuevas colecciones `camas` y `auditoria`; validación `$jsonSchema`; índices. |
| 1:40–2:20 | Integrante 1 | `mongosh --file scripts/02_carga_datos.js` | 24 pacientes de 6 subregiones, 35 hospitalizaciones desde perfiles clínicos; datos ficticios. |
| 2:20–4:30 | Integrante 2 | `mongosh --file scripts/03_crud.js` (ir parando en cada bloque) | C1–C3: inserción y rechazo del validador. R1–R2: lecturas con filtros anidados y `$slice`. U1–U6: `$set` anidado, `$push $each`, **`arrayFilters`** para suspender el AINE, operador posicional, `updateMany` con pipeline (SIVIGILA), alta con liberación de cama. D1–D3: borrado lógico, `$pull`, borrado definitivo justificado. Mostrar la auditoría al final. |
| 4:30–7:30 | Cada integrante su consulta | `mongosh --file scripts/04_consultas_avanzadas.js` | Para cada consulta: la pregunta clínica, las etapas del pipeline y qué revela el resultado (ver tabla de abajo). |
| 7:30–8:30 | Integrante 3 | Bloque O1 y `ia_evidencia/EVIDENCIA_IA.md` | Cómo se usó la IA: errores reales que ayudó a resolver y la optimización verificada con `explain` (72 → 16 documentos). |
| 8:30–9:40 | Integrante 4 | Sección 6 del informe | Reflexión ética: reidentificación con conteos pequeños (A1), trazabilidad (auditoría), borrado lógico vs. Resolución 1995/839, sesgos (NEWS2 en adultos, alergias en texto libre). |
| 9:40–10:00 | Todos | Repositorio | Cierre y dónde están los scripts. |

## Qué decir en cada consulta (30–40 s cada una)

- **A1 Perfil epidemiológico:** «El dengue se concentra en Urabá, Bajo Cauca y Magdalena Medio; en el Valle de Aburrá predominan las enfermedades respiratorias y circulatorias.»
- **A2 Reingresos a 30 días:** «Usamos `$setWindowFields` con `$shift` para comparar cada ingreso con el anterior del mismo paciente: 4 reingresos sobre 29 egresos (13,8 %), 3 por la misma causa.»
- **A3 Ocupación de camas:** «Medicina Interna está al 54,5 % y se ve qué paciente está en cada cama y cuántos días lleva.»
- **A4 Antibióticos:** «Filtramos por código ATC J01 y calculamos días de terapia; la neumonía es la que más antibiótico consume.»
- **A5 NEWS2:** «Con la última toma de signos vitales calculamos un puntaje de alerta temprana: dos pacientes en riesgo alto que requieren valoración inmediata.»
- **A6 Alergias:** «Cruzamos alergias del paciente con la familia del medicamento: hay dos órdenes activas peligrosas; la del ibuprofeno ya la suspendimos en el CRUD.»
- **A7 Estancia:** «EPOC es el diagnóstico que más días-cama consume; el infarto tiene la única muerte del periodo.»

Si el trabajo es individual, la misma persona presenta todos los bloques; la rúbrica pide evidenciar la participación de todos los integrantes, así que en grupo cada uno debe aparecer (voz o cámara) en su parte.
