# Evidencia del uso de IA — Unidad 3 (CRUD y consultas avanzadas en MongoDB)

**Herramienta:** Claude Code (Anthropic, modelo Claude Opus 5.5), ejecutándose en el equipo del autor con acceso a la terminal, al sistema de archivos y al servidor MongoDB 8.3.7 local.
**Fecha de la sesión:** 8 de noviembre de 2026.
**Regla de trabajo:** todo lo que la IA propuso se ejecutó contra la base real; los resultados del informe son salidas de `mongosh`, no texto inventado.

## Interacción 1 — Prompt inicial

> «hazme esta tarea y mira las anteriores para que sigas el patrón: [enunciado completo de la tarea de la Unidad 3 con su rúbrica]»

**Resultado:** la IA leyó la entrega de la Unidad 2 (`Grupo_AE2_U2_Entrega/`: scripts, informe, evidencia de IA) y propuso *evolucionar* ese modelo documental en lugar de empezar de cero: agregar `camas`, `auditoria`, borrado lógico (`eliminado`), `familia_alergia` en el catálogo de medicamentos, `subregion` del paciente y notificación SIVIGILA. También propuso pasar de 7 hospitalizaciones escritas a mano a 35 generadas desde **perfiles clínicos** para que las agregaciones tengan algo que revelar.

**Cómo mejoró el trabajo:** continuidad con la U2 (el modelo se justifica una vez y se amplía) y datos con volumen suficiente para reingresos, ocupación y perfiles por subregión.

## Interacción 2 — Error real: índice parcial rechazado

**Lo que pasó:** el primer `01_crear_esquema.js` falló:
```
MongoServerError: Expression not supported in partial index: $not  eliminado exists
```
**Respuesta de la IA:** explicó que los índices parciales solo admiten `$exists: true`, igualdades, rangos, `$type` y `$and`, no `$exists: false` (que internamente es un `$not`). Convirtió el índice en uno normal y dejó la explicación como comentario en el script.

**Cómo mejoró:** se documenta una limitación real del borrado lógico con subdocumento `eliminado` (alternativa: un campo booleano `vigente: true`, que sí admite índice parcial).

## Interacción 3 — Revisión crítica de los datos generados

**Lo que pasó:** los datos se cargaron sin error, pero al revisar una muestra la IA encontró una incoherencia clínica: la niña de 10 años con dengue (HOSP-2026-0030, Pediatría) tenía órdenes con **dosis de adulto** (Lactato de Ringer 1000 mL, acetaminofén 500 mg).
**Respuesta de la IA:** agregó `DOSIS_PEDIATRICA` para que en menores de 15 años la dosis quede expresada por peso («15 mg/kg», «mantenimiento según peso (Holliday-Segar)»).

**Cómo mejoró:** pasar la validación de esquema no significa que el dato tenga sentido; se revisó el contenido, no solo la sintaxis.

## Interacción 4 — Mensajes de error útiles en la validación

**Lo que pasó:** el intento de insertar un paciente inválido imprimía `codigo 121 (undefined)`.
**Respuesta de la IA:** leyó `e.errInfo.details.schemaRulesNotSatisfied` y ahora la salida dice qué regla falló en cada campo (`documento (pattern)`, `fecha_nacimiento (bsonType)`, `sexo (enum)`, `contacto (required)`, `aseguramiento (required)`).

## Interacción 5 — Formato de resultados (`Long`)

**Lo que pasó:** los resultados de `$dateDiff` salían como `{high: 0, low: 23, unsigned: false}` porque son enteros de 64 bits (`Long`).
**Respuesta de la IA:** escribió un formateador (`val`/`fila`) que convierte `Long` a número y fechas a texto corto. En el proceso, una sustitución automática por expresión regular dañó tres etapas `$sort` (`{ total: -1, _id: "$_id" }`); la IA lo detectó al revisar el archivo con `grep` y las restauró antes de volver a ejecutar.

**Cómo mejoró:** salidas legibles para el informe y el video; y una lección: todo cambio automático se revisa.

## Interacción 6 — Optimización de pipeline verificada con `explain()`

**Propuesta de la IA:** «poner el `$match` antes del `$lookup` para que use el índice `ix_diagnostico`».
**Verificación:** `explain("executionStats")` mostró que la versión escrita «mal» (con `$lookup` primero) **ya usaba el índice**: el optimizador de MongoDB movió solo la parte del filtro que no depende del `$lookup` (`parsedQuery: {"diagnosticos.cie10": {"$in": ["A90","A91"]}}`). Las dos versiones examinan 16 documentos. El ahorro real aparece frente a un filtro que solo existe después del `$lookup` (72 documentos, `COLLSCAN`): **−78 %** gracias al índice.
**Cómo mejoró:** la IA corrigió su propia afirmación con evidencia y el informe explica lo que de verdad pasa dentro del motor (consulta O1).

## Interacción 7 — Diseño de consultas con sentido clínico

**Aporte de la IA:** propuso las consultas A1–A7 a partir de preguntas reales de un hospital (perfil epidemiológico por subregión, reingresos a 30 días, ocupación de camas, uso de antibióticos, NEWS2, conflictos alergia–medicamento, estancia por diagnóstico) y señaló sus límites: NEWS2 solo es válido en mayores de 16 años (los niños se excluyen y requerirían PEWS) y se omiten conciencia y oxígeno suplementario.

## Interacción 8 — Revisión final antes de entregar

**Prompt:** «hazme esta tarea siguiendo lo que ya hemos hecho en la misma asignatura» (segunda sesión, para cerrar la entrega).
**Resultado:** la IA volvió a ejecutar los cuatro scripts desde cero y comparó con `diff` las salidas contra `resultados/` (idénticas). Al revisar el contenido encontró dos errores que no rompían nada pero eran incorrectos:
- U5 asignaba el código de evento 210 (dengue) también a los casos de **dengue grave**, que en el INS es 220. Se corrigió con un `$cond` dentro de la actualización con pipeline y se verificó: HOSP-2026-0004 y HOSP-2026-0012 (A91) quedaron con ficha `220-…`.
- En el diagrama, la flecha hacia `catalogo_medicamentos` salía de `alta {}` en lugar de `ordenes_medicamentos[]`.

Después regeneró datos JSON, capturas y el informe PDF (`informe_fuente/generar_informe.py`, que extrae los fragmentos de código directamente de los scripts para que el informe no se desincronice del repositorio) y lo revisó página por página.

## Prompts reutilizables para cada integrante

| Para | Prompt |
|---|---|
| Entender un pipeline | «Explícame etapa por etapa qué hace este pipeline y qué documentos salen de cada etapa: [pegar pipeline]» |
| Depurar | «Este comando de mongosh falla con [error]. Explícame la causa y propón la corrección mínima» |
| Optimizar | «Ejecuta explain('executionStats') de este pipeline e indícame si usa índice y cuántos documentos examina» |
| Comparar modelos | «Compara cómo resolverías la consulta A2 (reingresos) en MongoDB, en SQL y en Neo4j (Cypher)» |
| Ética | «¿Qué riesgos de reidentificación tiene publicar el resultado de A1 con conteos por subregión?» |

## Responsabilidad humana

- Los 25 pacientes y sus datos son **ficticios**; ningún dato clínico real se envió a la IA.
- El autor revisó y debe poder explicar cada script (lo exige el video).
- Las decisiones clínicas simuladas (dosis, esquemas, puntajes) son ilustrativas y **no** son una guía médica.
