"""Exporta las colecciones a JSON (Extended JSON relajado) para el repositorio. Requiere: pip install pymongo"""
import os
from pymongo import MongoClient
from bson import json_util

SALIDA = os.path.join(os.path.dirname(__file__), "..", "datos_json")
db = MongoClient("mongodb://127.0.0.1:27017")["hce_hospitalizacion_u3"]
os.makedirs(SALIDA, exist_ok=True)
for nombre in sorted(db.list_collection_names()):
    docs = list(db[nombre].find().sort("_id", 1))
    with open(os.path.join(SALIDA, f"{nombre}.json"), "w", encoding="utf-8") as f:
        f.write(json_util.dumps(docs, indent=2, ensure_ascii=False, json_options=json_util.RELAXED_JSON_OPTIONS))
    print(f"{nombre}: {len(docs)} documentos")
