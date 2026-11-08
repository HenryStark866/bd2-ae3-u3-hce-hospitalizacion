"""Diagrama del modelo documental hibrido de la Unidad 3 (embebido + referenciado + camas + auditoria)."""
import os
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

fig, ax = plt.subplots(figsize=(14, 8.2)); ax.set_xlim(0, 14); ax.set_ylim(0, 8.2); ax.axis("off")


def caja(x, y, w, h, titulo, lineas, fc, ec):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.12", fc=fc, ec=ec, lw=1.6))
    ax.text(x + w / 2, y + h - 0.25, titulo, ha="center", va="center", fontsize=11, fontweight="bold", color=ec)
    for i, l in enumerate(lineas):
        ax.text(x + 0.15, y + h - 0.6 - i * 0.27, l, fontsize=8, va="center", family="monospace")


# Nucleo
ax.add_patch(FancyBboxPatch((4.4, 0.55), 5.0, 7.3, boxstyle="round,pad=0.02,rounding_size=0.15", fc="#eef6ff", ec="#1f5fa8", lw=2.2))
ax.text(6.9, 7.6, "hospitalizaciones  (documento raiz)", ha="center", fontsize=12, fontweight="bold", color="#1f5fa8")
raiz = ["_id 'HOSP-2026-0001'", "paciente_id  ---> pacientes", "medico_tratante_id ---> profesionales",
        "cama ---> camas,  servicio, ips", "fecha_admision, motivo_ingreso, estado",
        "notificacion_sivigila {}   eliminado {}"]
for i, l in enumerate(raiz): ax.text(4.55, 7.2 - i * 0.27, l, fontsize=8, family="monospace")
emb = [("diagnosticos[]", "cie10 --> catalogo_cie10, tipo, fecha"),
       ("notas_evolucion[]", "fecha, profesional_id, S-O-A-P"),
       ("signos_vitales[]", "fecha, fc, fr, TA, temp, spo2"),
       ("notas_enfermeria[]", "fecha, enfermera_id, turno, nota"),
       ("ordenes_medicamentos[]", "medicamento_id --> catalogo, estado"),
       ("alta {}", "fecha, condicion, destino, dx egreso")]
for i, (t, d) in enumerate(emb):
    y = 5.0 - i * 0.72
    ax.add_patch(FancyBboxPatch((4.6, y), 4.6, 0.6, boxstyle="round,pad=0.01,rounding_size=0.08", fc="#fff8e1", ec="#c98a00", lw=1.2))
    ax.text(4.7, y + 0.4, t, fontsize=9, fontweight="bold", color="#8a5d00"); ax.text(4.7, y + 0.14, d, fontsize=7.6, family="monospace")
ax.text(6.9, 0.3, "EMBEBIDO: nace y muere con la hospitalizacion", ha="center", fontsize=8.5, style="italic", color="#8a5d00")

caja(0.2, 5.3, 3.6, 2.5, "pacientes", ["_id 'PAC-001'", "tipo_documento, documento", "nombres, apellidos, sexo", "contacto{municipio, subregion}",
                                       "aseguramiento{eps, regimen}", "alergias[], antecedentes[]", "eliminado{} (borrado logico)"], "#e9f7ef", "#1e8449")
caja(0.2, 3.2, 3.6, 1.7, "profesionales", ["_id 'PRO-001' / 'ENF-001'", "nombre, rol, especialidad", "registro_medico"], "#e9f7ef", "#1e8449")
caja(0.2, 0.9, 3.6, 1.9, "camas", ["_id 'MI-201'", "ips, servicio, temporal", "estado DISPONIBLE|OCUPADA|", "      MANTENIMIENTO", "hospitalizacion_id"], "#e9f7ef", "#1e8449")
caja(10.1, 5.9, 3.7, 1.9, "catalogo_cie10", ["_id 'A90'", "descripcion, capitulo", "notificacion_obligatoria"], "#f4ecf7", "#7d3c98")
caja(10.1, 3.5, 3.7, 2.0, "catalogo_medicamentos", ["_id 'MED-001'", "nombre_generico, atc", "forma, concentracion", "familia_alergia"], "#f4ecf7", "#7d3c98")
caja(10.1, 0.9, 3.7, 2.2, "auditoria", ["fecha, usuario", "accion INSERT|UPDATE|", "  SOFT_DELETE|HARD_DELETE|PULL", "coleccion, documento_id", "detalle   (solo se agrega)"], "#fdecea", "#b03a2e")

kw = dict(arrowprops=dict(arrowstyle="->", color="#444", lw=1.5))
ax.annotate("", xy=(3.8, 6.6), xytext=(4.4, 7.1), **kw); ax.text(3.85, 7.25, "REF N:1", fontsize=8, color="#444")
ax.annotate("", xy=(3.8, 4.1), xytext=(4.4, 6.85), **kw)
ax.annotate("", xy=(3.8, 1.9), xytext=(4.4, 6.6), **kw); ax.text(3.82, 2.25, "REF 1:1\n(activa)", fontsize=7.5, color="#444")
ax.annotate("", xy=(10.1, 6.8), xytext=(9.2, 5.3), **kw)
ax.annotate("", xy=(10.1, 4.2), xytext=(9.2, 2.42), **kw)   # desde ordenes_medicamentos[]
ax.annotate("", xy=(10.1, 1.4), xytext=(9.4, 0.85), arrowprops=dict(arrowstyle="->", color="#b03a2e", lw=1.3, ls="--"))
ax.text(9.48, 1.25, "cada\nCRUD\nescribe\naqui", fontsize=7, color="#b03a2e")
ax.text(0.2, 0.15, "Verde = colecciones referenciadas   Morado = catalogos   Amarillo = subdocumentos embebidos   Rojo = bitacora de auditoria", fontsize=8.5)
ax.set_title("Modelo documental hibrido - HCE basica, hospitalizacion (MongoDB) - Unidad 3", fontsize=12.5, pad=6)
plt.savefig(os.path.join(os.path.dirname(__file__), "..", "capturas", "00_diagrama_modelo.png"), dpi=160, bbox_inches="tight")
print("diagrama generado")
