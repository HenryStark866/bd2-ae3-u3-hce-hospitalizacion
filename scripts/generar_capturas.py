"""Renderiza como imagenes (estilo consola) las salidas REALES de mongosh guardadas en resultados/.
Las lineas largas se parten para que el texto sea legible en el PDF."""
import os, textwrap
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.join(os.path.dirname(__file__), "..")
RES, CAP = os.path.join(BASE, "resultados"), os.path.join(BASE, "capturas")
FONT = ImageFont.truetype(r"C:\Windows\Fonts\consola.ttf", 15)
BG, FG, TIT, ACC, OK = (30, 30, 30), (212, 212, 212), (56, 56, 56), (78, 201, 176), (220, 220, 170)
ANCHO = 128   # caracteres por linea


def render(titulo, lineas, destino):
    partidas = []
    for l in lineas:
        partidas += textwrap.wrap(l, ANCHO, subsequent_indent="    ", drop_whitespace=False) or [""]
    lh, pad = 19, 14
    w = max(900, int(max(FONT.getlength(l) for l in partidas)) + pad * 2)
    h = 34 + pad * 2 + lh * len(partidas)
    im = Image.new("RGB", (w, h), BG); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, w, 30], fill=TIT)
    for i, c in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        d.ellipse([10 + i * 20, 9, 22 + i * 20, 21], fill=c)
    d.text((80, 7), titulo, font=FONT, fill=FG)
    y = 34 + pad
    for l in partidas:
        col = ACC if l.startswith(("mongosh>", "====", "PS>")) else OK if l.startswith(("Rechazado", "Mismo resultado")) else FG
        d.text((pad, y), l, font=FONT, fill=col); y += lh
    im.save(destino)


def leer(n): return open(os.path.join(RES, n), encoding="utf-8").read().rstrip().splitlines()


def bloques(nombre):
    """Separa una salida en bloques que empiezan con la linea '==== titulo ===='."""
    out, actual = {}, None
    for l in leer(nombre):
        if l.startswith("===================="):
            clave = l.strip("= ").split(".")[0]
            actual = out.setdefault(clave, []); actual.append(l)
        elif actual is not None and l.strip():
            actual.append(l)
    return out


render("mongosh - entorno y estructura de un documento", leer("salida_00_entorno.txt")[:60], os.path.join(CAP, "01_entorno_mongodb.png"))
render("mongosh --file scripts/01_crear_esquema.js", leer("salida_01_crear_esquema.txt"), os.path.join(CAP, "02_creacion_esquema.png"))
render("mongosh --file scripts/02_carga_datos.js", leer("salida_02_carga_datos.txt"), os.path.join(CAP, "03_carga_datos.png"))

crud = bloques("salida_03_crud.txt")
grupos_crud = {"04_crud_create": ["C1", "C2", "C3"], "05_crud_read": ["R1", "R2"],
               "06_crud_update_1": ["U1", "U2", "U3"], "07_crud_update_2": ["U4", "U5", "U6"],
               "08_crud_delete": ["D1", "D2", "D3", "Resumen: trazabilidad en la coleccion auditoria"]}
for nombre, claves in grupos_crud.items():
    render("mongosh --file scripts/03_crud.js", [x for k in claves for x in crud[k]], os.path.join(CAP, nombre + ".png"))

cons = bloques("salida_04_consultas_avanzadas.txt")
for i, k in enumerate(["A1", "A2", "A3", "A4", "A5", "A6", "A7", "O1"]):
    render("mongosh --file scripts/04_consultas_avanzadas.js", cons[k], os.path.join(CAP, f"{9 + i:02d}_consulta_{k}.png"))
print(sorted(os.listdir(CAP)))
