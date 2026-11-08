# Unidad 3 · Manipulación y consultas avanzadas en NoSQL (MongoDB)

HCE básica de Antioquia, subsistema de hospitalización. Modelo documental híbrido (continúa el de la Unidad 2). **Datos 100 % ficticios.**

## Reproducir (MongoDB 8.x + mongosh)

```
mongosh --file scripts/01_crear_esquema.js          # crea la base hce_hospitalizacion_u3 (la borra si existe)
mongosh --file scripts/02_carga_datos.js            # 24 pacientes, 35 hospitalizaciones, 30 camas
mongosh --file scripts/03_crud.js                   # Create / Read / Update / Delete con auditoría
mongosh --file scripts/04_consultas_avanzadas.js    # A1–A7 + O1 (optimización con explain)
```

Los scripts se ejecutan en ese orden; `03` y `04` dependen del estado que dejan los anteriores.

Regenerar evidencias (Python 3 con `pymongo`, `matplotlib`, `Pillow`, `reportlab`):

```
python scripts/exportar_json.py        # datos_json/
python scripts/generar_diagrama.py     # capturas/00_diagrama_modelo.png
python scripts/generar_capturas.py     # capturas/ a partir de resultados/
python informe_fuente/generar_informe.py
```

## Contenido

| Carpeta | Qué hay |
|---|---|
| `Grupo1_AE3_U3.pdf` | informe técnico (se regenera con `informe_fuente/generar_informe.py`) |
| `scripts/` | creación, inserción, CRUD, consultas avanzadas y utilidades Python |
| `datos_json/` | las 7 colecciones exportadas después de ejecutar todo |
| `resultados/` | salidas reales de mongosh (.txt) |
| `capturas/` | diagrama y capturas de ejecución (.png) |
| `ia_evidencia/` | prompts, resultados y aporte de la IA |
| `video/` | guion del video (≤ 10 min) |
| `informe_fuente/` | código que genera el PDF y `config.json` (grupo, integrantes, enlace del video) |
