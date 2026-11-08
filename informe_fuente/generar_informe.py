"""Genera Grupo<N>_AE3_U3.pdf a partir de config.json, los scripts, las salidas reales y las capturas.
Uso:  python informe_fuente/generar_informe.py      (requiere reportlab y Pillow)
Edite config.json (grupo, integrantes, enlaces del video y del repositorio) y vuelva a ejecutar.
Los fragmentos de codigo se extraen de los scripts, asi el informe no se desincroniza del repositorio."""
import json, os, re
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak, Table, TableStyle,
                                Preformatted, KeepTogether, CondPageBreak)
from PIL import Image as PILImage

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
cfg = json.load(open(os.path.join(BASE, "informe_fuente", "config.json"), encoding="utf-8"))
SALIDA = os.path.join(BASE, f"Grupo{cfg['grupo']}_{cfg['actividad']}.pdf")

F = r"C:\Windows\Fonts"
pdfmetrics.registerFont(TTFont("Body", os.path.join(F, "arial.ttf")))
pdfmetrics.registerFont(TTFont("Body-B", os.path.join(F, "arialbd.ttf")))
pdfmetrics.registerFont(TTFont("Body-I", os.path.join(F, "ariali.ttf")))
pdfmetrics.registerFont(TTFont("Mono", os.path.join(F, "consola.ttf")))
pdfmetrics.registerFontFamily("Body", normal="Body", bold="Body-B", italic="Body-I", boldItalic="Body-B")

AZUL, GRIS = colors.HexColor("#1f4e8c"), colors.HexColor("#f2f4f8")
s_body = ParagraphStyle("b", fontName="Body", fontSize=10, leading=14, spaceAfter=6, alignment=4)
s_h1 = ParagraphStyle("h1", fontName="Body-B", fontSize=16, leading=20, textColor=AZUL, spaceBefore=4, spaceAfter=8)
s_h2 = ParagraphStyle("h2", fontName="Body-B", fontSize=12, leading=16, textColor=AZUL, spaceBefore=8, spaceAfter=4)
s_cap = ParagraphStyle("c", fontName="Body-I", fontSize=8.5, leading=11, textColor=colors.HexColor("#555555"), spaceAfter=8)
s_cell = ParagraphStyle("t", fontName="Body", fontSize=8.5, leading=11)
s_cellb = ParagraphStyle("tb", fontName="Body-B", fontSize=8.5, leading=11, textColor=colors.white)
s_code = ParagraphStyle("code", fontName="Mono", fontSize=7.2, leading=9, backColor=GRIS, borderPadding=5,
                        spaceAfter=8, leftIndent=4)
s_bul = ParagraphStyle("bul", parent=s_body, leftIndent=14, bulletIndent=2, spaceAfter=3, alignment=0)
s_box = ParagraphStyle("box", parent=s_body, backColor=colors.HexColor("#eaf2fb"), borderColor=AZUL, borderWidth=0.6,
                       borderPadding=6, spaceBefore=4, spaceAfter=10, alignment=0)

def P(t, st=s_body): return Paragraph(t, st)
def H1(t): return Paragraph(t, s_h1)
def H2(t): return Paragraph(t, s_h2)
def B(t): return Paragraph(t, s_bul, bulletText="•")
def M(t): return f"<font name='Mono'>{t}</font>"
def leer(*ruta): return open(os.path.join(BASE, *ruta), encoding="utf-8").read()

def code(t, max_ancho=118):
    """Bloque de codigo; parte lineas muy largas para que no se salgan de la pagina."""
    out = []
    for l in t.strip("\n").splitlines():
        while len(l) > max_ancho:
            corte = l.rfind(" ", 0, max_ancho)
            corte = corte if corte > 40 else max_ancho
            out.append(l[:corte]); l = "      " + l[corte:].lstrip()
        out.append(l)
    return Preformatted("\n".join(out), s_code)

def entre(texto, ini, fin=None):
    """Fragmento de `texto` desde la linea que contiene `ini` hasta (sin incluir) la siguiente que contiene `fin`."""
    i = texto.index(ini); i = texto.rfind("\n", 0, i) + 1
    j = texto.index(fin, i + len(ini)) if fin else len(texto)
    j = texto.rfind("\n", 0, j) + 1 if fin else j
    return texto[i:j].rstrip()

def img(nombre, ancho=17 * cm, tope=19 * cm):
    ruta = os.path.join(BASE, "capturas", nombre)
    w, h = PILImage.open(ruta).size
    esc = min(ancho / w, tope / h)
    return Image(ruta, width=w * esc, height=h * esc)

def tabla(filas, anchos, cab=True):
    data = [[Paragraph(str(c), s_cellb if (cab and i == 0) else s_cell) for c in f] for i, f in enumerate(filas)]
    t = Table(data, colWidths=anchos, repeatRows=1 if cab else 0)
    est = [("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#b8c2d3")), ("VALIGN", (0, 0), (-1, -1), "TOP"),
           ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]
    if cab: est += [("BACKGROUND", (0, 0), (-1, 0), AZUL)] + [("BACKGROUND", (0, i), (-1, i), GRIS) for i in range(2, len(filas), 2)]
    t.setStyle(TableStyle(est)); return t

def figura(nombre, pie_txt, tope=19 * cm):
    return KeepTogether([img(nombre, tope=tope), P(pie_txt, s_cap)])

nfig = [0]
def fig(nombre, txt, tope=19 * cm):
    nfig[0] += 1
    return figura(nombre, f"Figura {nfig[0]}. {txt}", tope)

def enlace(url, pendiente):
    return f"<link href='{url}' color='#1f4e8c'><u>{url}</u></link>" if url else f"<font color='#b03a2e'>{pendiente}</font>"

AUTORES = [i["nombre"] for i in cfg["integrantes"]]
INDIVIDUAL = len(AUTORES) == 1
def responsable(consulta):
    for i in cfg["integrantes"]:
        if consulta in i.get("consultas", []): return i["nombre"]
    return "—"

def pie(c, d):
    c.saveState(); c.setFont("Body", 8); c.setFillColor(colors.HexColor("#666666"))
    c.drawString(2 * cm, 1.2 * cm, f"{' · '.join(AUTORES)} · AE3-U3 · Bases de Datos II · 2026-2")
    c.drawRightString(letter[0] - 2 * cm, 1.2 * cm, f"Página {d.page}"); c.restoreState()

crud = leer("scripts", "03_crud.js")
cons = leer("scripts", "04_consultas_avanzadas.js")
carga = leer("scripts", "02_carga_datos.js")
res_carga = leer("resultados", "salida_02_carga_datos.txt")
res_cons = leer("resultados", "salida_04_consultas_avanzadas.txt")

S = []
# =================================================================== Portada
S += [Spacer(1, 2.6 * cm),
      Paragraph("Tarea. Manipulación y consultas avanzadas en un sistema NoSQL",
                ParagraphStyle("t", fontName="Body-B", fontSize=22, leading=28, textColor=AZUL)),
      Spacer(1, .4 * cm),
      Paragraph("Historia Clínica Electrónica Básica — Subsistema de Hospitalización<br/>Gobernación de Antioquia · "
                "Modelo documental en MongoDB", ParagraphStyle("t2", fontName="Body", fontSize=14, leading=19)),
      Spacer(1, 1.1 * cm),
      tabla([["Asignatura", "Bases de Datos II (G101) — Tecnología en Desarrollo de Software"],
             ["Profesora", "Oralia Cortés Grajales"],
             ["Actividad", "AE3 · Unidad 3 · Informe técnico"],
             ["Modalidad", cfg["modalidad"]],
             ["Autor" if INDIVIDUAL else "Integrantes", "<br/>".join(AUTORES)],
             ["SGBD", "MongoDB Community 8.3.7 + mongosh (modelo documental híbrido)"],
             ["Base de datos", "hce_hospitalizacion_u3"],
             ["Repositorio", enlace(cfg.get("repositorio_url"), "Pendiente: agregar enlace en config.json")],
             ["Video", enlace(cfg.get("video_url"), "Pendiente: agregar enlace en config.json")],
             ["Fecha", cfg["fecha"]]], [3.6 * cm, 13.4 * cm], cab=False),
      Spacer(1, .9 * cm),
      P("<b>Contenido:</b> 1. Modelo documental · 2. Datos simulados · 3. Operaciones CRUD · 4. Consultas avanzadas "
        "(A1–A7) y optimización (O1) · 5. Integración de IA · 6. Reflexión ética · 7. Distribución del trabajo, "
        "repositorio y video · 8. Conclusiones."),
      P("<b>Nota:</b> todos los datos de este trabajo son <b>ficticios</b>. Las salidas que se muestran son copias exactas de la "
        "ejecución real de los scripts sobre MongoDB (carpeta " + M("resultados/") + ")."),
      PageBreak()]

# =================================================================== 1. Modelo
S += [H1("1. Descripción del modelo documental"),
      H2("1.1 De la Unidad 2 a la Unidad 3"),
      P("En la Unidad 2 se construyó un modelo <b>documental híbrido</b> en MongoDB: la hospitalización es el documento raíz y "
        "<b>embebe</b> lo que nace y muere con ella (diagnósticos, evolución, signos vitales, notas de enfermería, órdenes de "
        "medicamentos y alta), mientras que paciente, profesionales y catálogos se <b>referencian</b> porque se reutilizan entre "
        "muchas hospitalizaciones. Para este reto ese modelo no se reemplaza: se <b>amplía</b> con lo que exigen las operaciones "
        "CRUD complejas y el análisis clínico."),
      tabla([["Cambio", "Para qué se necesita"],
             ["Colección " + M("camas") + " (30 camas en 4 servicios, estado y hospitalización que la ocupa)",
              "La admisión y el alta cambian dos colecciones; permite medir ocupación (A3)."],
             ["Colección " + M("auditoria") + " (solo se agrega, nunca se modifica)",
              "Trazabilidad: cada operación CRUD deja quién, qué, cuándo y por qué."],
             ["Subdocumento " + M("eliminado {fecha, por, motivo}") + " en pacientes y hospitalizaciones",
              "Borrado lógico: la historia clínica no se destruye (Res. 1995/1999)."],
             [M("familia_alergia") + " en el catálogo de medicamentos",
              "Cruzar alergias del paciente con lo que se le ordena (A6)."],
             [M("contacto.subregion") + " del paciente y " + M("notificacion_sivigila") + " en la hospitalización",
              "Análisis epidemiológico territorial (A1) y vigilancia en salud pública (U5)."],
             ["De 7 a 35 hospitalizaciones generadas desde perfiles clínicos",
              "Volumen suficiente para que las agregaciones revelen patrones (reingresos, estancias)."]],
            [8 * cm, 9 * cm]),
      Spacer(1, 6),
      fig("00_diagrama_modelo.png", "Modelo documental híbrido de la Unidad 3: núcleo embebido (amarillo), colecciones "
          "referenciadas (verde), catálogos (morado) y bitácora de auditoría (rojo).", tope=11 * cm),
      CondPageBreak(6 * cm), H2("1.2 Embebido vs. referenciado (decisiones)"),
      tabla([["Elemento", "Estrategia", "Justificación"],
             ["Diagnósticos, evolución, signos vitales, enfermería, órdenes, alta", "Embebido (arrays / objeto)",
              "Se leen siempre con la hospitalización; su volumen por ingreso es acotado (~3 tomas de signos/día). "
              "Una sola lectura trae el episodio completo."],
             ["Paciente", "Referenciado", "Un paciente tiene varias hospitalizaciones (hay 4 reingresos). Los datos de identificación "
              "quedan aparte y se pueden proteger o seudonimizar por separado."],
             ["Profesionales y catálogos (CIE-10, medicamentos)", "Referenciado", "Datos maestros compartidos: se corrigen una vez. "
              "Se copia la descripción en el documento para lectura rápida (desnormalización controlada)."],
             ["Camas", "Referenciado (1:1 mientras está activa)", "Su estado cambia con independencia del episodio y se consulta "
              "por servicio para gestionar capacidad."],
             ["Auditoría", "Colección propia", "Si se embebiera, quien edita la historia podría alterar su propio rastro."]],
            [4.3 * cm, 3.6 * cm, 9.1 * cm]),
      Spacer(1, 6),
      H2("1.3 Validación e índices"),
      P("Cada colección tiene un validador " + M("$jsonSchema") + " (tipos, enumeraciones, patrones, campos obligatorios y rangos "
        "fisiológicos: FC 20–250, SpO<sub>2</sub> 50–100, temperatura 30–45 °C). Índices creados: " + M("ux_documento") + " (único por tipo y "
        "número de documento), " + M("ix_territorio") + ", " + M("ix_paciente_fecha") + ", " + M("ix_diagnostico") +
        " (multikey sobre " + M("diagnosticos.cie10") + "), " + M("ix_estado_servicio") + ", " + M("ix_medicamento") + ", " +
        M("ix_cama_servicio_estado") + " e " + M("ix_auditoria_doc") + "."),
      code(entre(leer("scripts", "01_crear_esquema.js"), "// ---------- Camas", "// ---------- Hospitalizaciones") + "\n" +
           entre(leer("scripts", "01_crear_esquema.js"), "// ---------- Auditoria", "// ---------- Indices")),
      P("<b>Limitación encontrada:</b> se intentó un índice parcial que indexara solo registros vigentes "
        "(" + M("{eliminado: {$exists: false}}") + "); MongoDB lo rechaza porque los índices parciales no admiten negaciones. "
        "Se dejó un índice normal y la explicación en el script. Alternativa para producción: un booleano " + M("vigente: true") +
        ", que sí admite índice parcial."),
      fig("02_creacion_esquema.png", "Ejecución de 01_crear_esquema.js: siete colecciones y sus índices.", tope=6.5 * cm),
      PageBreak()]

# =================================================================== 2. Datos
S += [H1("2. Datos simulados"),
      P("El script " + M("02_carga_datos.js") + " carga 13 códigos CIE-10, 17 medicamentos (con código ATC y familia de alergia), "
        "9 profesionales, 24 pacientes de 6 subregiones de Antioquia y 30 camas. Las 35 hospitalizaciones no se escribieron una "
        "por una: se generan desde <b>perfiles clínicos</b> (neumonía, EPOC, dengue, dengue grave, falla cardiaca, infarto, "
        "cetoacidosis diabética, apendicitis, etc.), cada uno con su servicio, medicamentos y la trayectoria de signos vitales "
        "desde el ingreso hasta el alta. Así los datos son coherentes: un paciente con neumonía ingresa con fiebre y SpO<sub>2</sub> baja y "
        "mejora; el dengue se concentra en Urabá y Bajo Cauca; los menores de 15 años van a Pediatría con dosis por peso."),
      code(entre(carga, "const PERFILES = {", "  EPOC:") + "\n  ...  (12 perfiles en total; ver archivo completo)"),
      fig("03_carga_datos.png", "Resultado de la carga: 491 tomas de signos vitales, 104 notas de evolución, 86 órdenes y "
          "114 diagnósticos embebidos.", tope=5 * cm),
      fig("01_entorno_mongodb.png", "Servidor MongoDB 8.3.7, colecciones después de ejecutar todos los scripts y estructura "
          "de un documento de hospitalización (proyección con " + "$slice" + ").", tope=12 * cm),
      PageBreak()]

# =================================================================== 3. CRUD
S += [H1("3. Operaciones CRUD"),
      P("El script " + M("03_crud.js") + " ejecuta 14 operaciones sobre la base cargada. Cada operación que modifica datos escribe "
        "un registro en " + M("auditoria") + ". El servidor es <i>standalone</i> (sin réplica), por lo que no hay transacciones "
        "multidocumento; donde dos colecciones cambian juntas (cama y hospitalización) se usa " + M("findOneAndUpdate") +
        ", que es atómico por documento, y un orden de escritura que no deja estados huérfanos."),
      tabla([["Op.", "Operación MQL", "Estructura manipulada", "Qué demuestra"],
             ["C1", "insertOne", "Paciente con subdocumentos contacto y aseguramiento", "Inserción validada por $jsonSchema"],
             ["C2", "findOneAndUpdate + insertOne", "Cama (estado) + hospitalización completa", "Admisión: reserva atómica de cama libre"],
             ["C3", "insertOne (inválido)", "Paciente con 5 errores", "El validador rechaza (código 121) y dice qué regla falló"],
             ["R1", "find + filtros anidados + $regex", "diagnosticos.cie10 dentro del array", "Pacientes activos de M. Interna con diabetes"],
             ["R2", "findOne + $slice: -2", "signos_vitales[]", "Leer solo las últimas tomas sin traer todo el array"],
             ["U1", "$set anidado + $addToSet", "contacto.telefono, contacto.acudiente, alergias[]", "Campo simple, subdocumento y array sin duplicados"],
             ["U2", "$push + $each", "notas_evolucion[], diagnosticos[], ordenes[]", "Tres arrays embebidos en una sola operación"],
             ["U3", "$set con arrayFilters $[o]", "Solo las órdenes que cumplen el filtro", "Suspender el AINE del paciente alérgico"],
             ["U4", "Operador posicional $", "El diagnóstico tipo INGRESO", "Corregir un elemento identificado por la consulta"],
             ["U5", "updateMany con pipeline", "notificacion_sivigila{} calculado", "Notificar a SIVIGILA los 8 casos de dengue"],
             ["U6", "$set + $[] + $push + findOneAndUpdate", "alta{}, todas las órdenes, cama", "Alta: cierra órdenes y libera la cama"],
             ["D1", "updateOne (eliminado{})", "Paciente duplicado", "Borrado lógico: se oculta pero se conserva"],
             ["D2", "$pull", "Un elemento de signos_vitales[]", "Retirar una toma registrada en la historia equivocada"],
             ["D3", "deleteOne / deleteMany", "Duplicado sin historia, camas temporales", "Borrado definitivo solo donde es legítimo"]],
            [1 * cm, 4.2 * cm, 5.6 * cm, 6.2 * cm]),
      Spacer(1, 4),
      H2("3.1 Create"),
      P("La admisión (C2) reserva la primera cama disponible de Medicina Interna y, en el mismo paso, la marca ocupada: si dos "
        "admisiones llegaran a la vez, " + M("findOneAndUpdate") + " impide que ambas tomen la misma cama."),
      code(entre(crud, 'titulo("C2.', 'titulo("C3.')),
      fig("04_crud_create.png", "C1–C3: paciente insertado, cama MI-206 asignada, hospitalización creada y documento inválido "
          "rechazado con el detalle de cada regla incumplida.", tope=8 * cm),
      H2("3.2 Read"),
      code(entre(crud, 'titulo("R1.', "// =====================================================================\n// UPDATE")),
      fig("05_crud_read.png", "R1 encuentra dos pacientes hospitalizados con diabetes como diagnóstico relacionado; R2 trae "
          "solo las dos últimas tomas de signos vitales.", tope=11 * cm),
      H2("3.3 Update"),
      P("Las actualizaciones trabajan sobre la estructura compleja del documento. La más representativa es <b>U3</b>: el paciente "
        "nuevo es alérgico a los AINE y tiene dengue (los AINE están contraindicados por riesgo de sangrado), pero en U2 se le "
        "ordenó ibuprofeno. Con " + M("arrayFilters") + " se suspende <i>solo</i> la orden conflictiva, dejando el acetaminofén "
        "activo, y se registra el motivo."),
      code(entre(crud, 'titulo("U3.', 'titulo("U4.')),
      P("<b>U5</b> usa una actualización con <i>pipeline</i>: el número de ficha se calcula a partir del propio documento "
        "(código de evento del INS: 210 dengue, 220 dengue grave) y la lista de diagnósticos notificables se lee del catálogo, "
        "no se escribe a mano."),
      code(entre(crud, 'titulo("U5.', 'titulo("U6.')),
      P("<b>U6</b> registra el alta: llena el subdocumento " + M("alta") + ", finaliza todas las órdenes con el operador " +
        M("$[]") + ", agrega el diagnóstico de egreso y libera la cama."),
      code(entre(crud, 'titulo("U6.', "// =====================================================================\n// DELETE")),
      fig("06_crud_update_1.png", "U1–U3: actualización anidada, $push con $each y suspensión selectiva con arrayFilters.", tope=10 * cm),
      fig("07_crud_update_2.png", "U4–U6: corrección posicional, notificación masiva (8 casos) y alta con liberación de cama.", tope=6 * cm),
      H2("3.4 Delete: lógico, $pull y definitivo"),
      P("La historia clínica tiene obligación de conservación (Res. 1995/1999, modificada por la Res. 839/2017), por eso el "
        "borrado por defecto es <b>lógico</b>: el documento recibe " + M("eliminado {fecha, por, motivo}") + " y todas las "
        "consultas lo excluyen con el filtro " + M("vigente") + ". El borrado <b>definitivo</b> se reserva para lo que no es "
        "historia: un registro duplicado <i>sin hospitalizaciones</i> (el script lo verifica antes de borrar) y camas de "
        "contingencia ya desmontadas."),
      code(entre(crud, 'titulo("D1.', 'titulo("D2.') + "\n" + entre(crud, 'titulo("D3.', 'titulo("Resumen')),
      fig("08_crud_delete.png", "D1–D3 y resumen de auditoría: 13 registros (3 INSERT, 6 UPDATE, 1 SOFT_DELETE, 1 PULL, "
          "2 HARD_DELETE).", tope=10 * cm),
      PageBreak()]

# =================================================================== 4. Consultas
CONSULTAS = [
    ("A1", "Perfil epidemiológico por subregión y capítulo CIE-10",
     "¿Dónde se concentra cada tipo de enfermedad en Antioquia?",
     "$match → $unwind → $match → $lookup (sub-pipeline que solo trae la subregión) → $lookup catálogo → $group → $sort → $group → $project",
     "El dengue (capítulo Infecciosas) se concentra en Urabá (6 de 9 casos), Bajo Cauca y Magdalena Medio; en el Valle de Aburrá "
     "predominan las enfermedades respiratorias (9 de 20) y circulatorias (6). Es la base de un reporte epidemiológico territorial. "
     "El $lookup trae solo la subregión del paciente, no su identidad (minimización).", "09_consulta_A1.png", 6),
    ("A2", "Reingresos hospitalarios a 30 días",
     "¿Qué pacientes vuelven antes de 30 días tras el alta y por la misma causa?",
     "$match → $setWindowFields ($shift por paciente) → $set ($dateDiff, $filter) → $match → $lookup → $project → $sort",
     "4 reingresos sobre 29 egresos (13,8 %); 3 por el mismo diagnóstico (neumonía, EPOC, falla cardiaca), un patrón típico de "
     "pacientes crónicos que requieren seguimiento tras el alta. $setWindowFields compara cada ingreso con el anterior del mismo "
     "paciente sin necesidad de un self-join.", "10_consulta_A2.png", 6),
    ("A3", "Ocupación de camas por servicio",
     "¿Cuánta capacidad queda en cada servicio y quién ocupa cada cama?",
     "$lookup con sub-pipeline (solo hospitalizaciones activas) → $group con $cond → $set (porcentaje) → $sort → $project",
     "Medicina Interna al 54,5 % (6 de 11 camas útiles; una en mantenimiento no cuenta) con el paciente y los días de estancia "
     "de cada cama. Parte de la colección camas, lo que muestra la navegación inversa de la referencia.", "11_consulta_A3.png", 5),
    ("A4", "Uso de antibióticos (ATC J01) y días de terapia",
     "¿Qué antibióticos se usan, para qué diagnósticos y durante cuánto tiempo?",
     "$match → $set (dx principal) → $unwind órdenes → $lookup catálogo → $match ($regex ^J01) → $group ($dateDiff) → $sort → $project",
     "La neumonía y la EPOC concentran el uso de ceftriaxona y azitromicina (≈ 23 días de terapia cada una). Es el indicador "
     "base de un programa de uso racional de antibióticos.", "12_consulta_A4.png", 5),
    ("A5", "Alerta temprana de deterioro (NEWS2 simplificado)",
     "¿Qué paciente hospitalizado necesita valoración urgente ahora?",
     "$match → $lookup (edad) → $set ($sortArray + $last: última toma) → $match (≥ 16 años) → $set ($switch por parámetro) → "
     "$set (suma y riesgo) → $sort → $project",
     "Dos pacientes en riesgo ALTO (NEWS2 11 y 8: neumonía con SpO<sub>2</sub> 88 % y falla cardiaca con SpO<sub>2</sub> 89 %) y uno MEDIO. NEWS2 solo "
     "es válido en mayores de 16 años, por eso la niña con dengue se excluye; se omiten conciencia y oxígeno suplementario.",
     "13_consulta_A5.png", 6),
    ("A6", "Conflictos alergia–medicamento",
     "¿A quién se le ordenó un medicamento de una familia a la que es alérgico?",
     "$match → $lookup (solo pacientes con alergias) → $match → $unwind → $lookup catálogo → $set ($map alergia→familia) → "
     "$match ($expr $in) → $project → $sort",
     "Dos órdenes ACTIVAS requieren revisión: trimetoprim/sulfametoxazol en un paciente alérgico a sulfas y ceftriaxona en una "
     "paciente alérgica a penicilina (reactividad cruzada baja, pero debe confirmarse). El ibuprofeno de U3 aparece SUSPENDIDO: "
     "la consulta confirma que el CRUD corrigió el riesgo.", "14_consulta_A6.png", 6),
    ("A7", "Estancia y desenlace por diagnóstico",
     "¿Qué diagnósticos consumen más días-cama y cuáles tienen peor desenlace?",
     "$match → $set ($dateDiff) → $group ($sum, $avg, $median, $max, $cond) → $lookup catálogo → $sort → $project",
     "La EPOC exacerbada es la que más días-cama consume (18); el dengue grave tiene la estancia promedio más alta (7 días) y el "
     "infarto registra el único fallecimiento del periodo.", "15_consulta_A7.png", 9),
]
S += [H1("4. Consultas avanzadas (Aggregation Framework)"),
      P("Las consultas están en " + M("04_consultas_avanzadas.js") + ". Cada una responde una pregunta que un hospital o la "
        "Secretaría de Salud se haría de verdad, usa entre 6 y 10 etapas (incluyendo " + M("$match") + ", " + M("$group") + ", " +
        M("$project") + " y " + M("$lookup") + ") y excluye los registros con borrado lógico. La fecha de corte del reporte es el "
        "8 de noviembre de 2026."),
      tabla([["#", "Pregunta clínica", "Operadores destacados", "Responsable"]] +
            [[c[0], c[2], ", ".join(dict.fromkeys(re.findall(r"\$[a-zA-Z]+", c[3]))), responsable(c[0])] for c in CONSULTAS] +
            [["O1", "¿Qué tanto ayuda el orden de las etapas y el índice?", "explain('executionStats')", responsable("O1")]],
            [1 * cm, 6.8 * cm, 6 * cm, 3.2 * cm]),
      Spacer(1, 4)]
for k, titulo, pregunta, etapas, hallazgo, captura, tope in CONSULTAS:
    fragmento = entre(cons, f'titulo("{k}.', "// ---------------------------------------------------------------------")
    S += [CondPageBreak(9 * cm), H2(f"{k}. {titulo}"),
          P(f"<b>Pregunta:</b> {pregunta}<br/><b>Etapas:</b> {etapas}<br/><b>Responsable:</b> {responsable(k)}"),
          code(fragmento),
          fig(captura, f"Resultado real de {k}.", tope=tope * cm),
          P(f"<b>Qué revela:</b> {hallazgo}", s_box)]

S += [CondPageBreak(10 * cm), H2("O1. Optimización verificada con explain()"),
      P("Pregunta: casos de dengue (A90/A91) en Urabá con el nombre del paciente. Se compararon tres versiones del mismo "
        "pipeline con " + M("explain('executionStats')") + ". La IA sugirió poner el " + M("$match") + " antes del " +
        M("$lookup") + "; al medir, se encontró que MongoDB <b>ya mueve solo</b> la parte del filtro que no depende del " +
        M("$lookup") + " (V1 y V2 examinan lo mismo y usan el índice). El ahorro real aparece frente a un filtro que solo existe "
        "después del " + M("$lookup") + " (V0): de 72 a 16 documentos examinados (−78 %), de COLLSCAN a IXSCAN, con el mismo "
        "resultado."),
      code(entre(cons, "const sinIndice = [", "const n = (x)")),
      fig("16_consulta_O1.png", "O1: documentos examinados y plan de ejecución de las tres versiones.", tope=5 * cm),
      PageBreak()]

# =================================================================== 5. IA
S += [H1("5. Integración de herramientas de IA"),
      P("Se usó <b>Claude Code</b> (Anthropic, modelo Claude Opus 5.5) en la terminal, con acceso a los archivos del proyecto y al "
        "servidor MongoDB local. La regla fue: <b>todo lo que la IA propone se ejecuta contra la base real</b> y solo se acepta lo "
        "que la ejecución confirma. La traza completa (prompts y resultados) está en " + M("ia_evidencia/EVIDENCIA_IA.md") + "."),
      tabla([["#", "Prompt / situación", "Resultado de la IA", "Cómo mejoró el trabajo"],
             ["1", "«Hazme esta tarea siguiendo lo que ya hicimos en la asignatura» + enunciado y rúbrica",
              "Leyó la entrega de la Unidad 2 y propuso ampliar ese modelo (camas, auditoría, borrado lógico, familias de alergia, "
              "subregión) y generar 35 hospitalizaciones desde perfiles clínicos.", "Continuidad con la U2 y datos con volumen para análisis."],
             ["2", "Error: «Expression not supported in partial index: $not»",
              "Explicó que los índices parciales no admiten $exists:false y propuso la alternativa de un booleano.",
              "Se documentó una limitación real del borrado lógico (sección 1.3)."],
             ["3", "Revisión de una muestra de los datos cargados",
              "Detectó que la niña de 10 años con dengue tenía dosis de adulto y agregó dosis pediátricas por peso.",
              "Pasar el validador no significa que el dato tenga sentido clínico."],
             ["4", "La salida de C3 decía «código 121 (undefined)»",
              "Leyó errInfo.details.schemaRulesNotSatisfied y ahora lista cada regla incumplida.",
              "Evidencia clara de la validación en el informe y el video."],
             ["5", "Resultados de $dateDiff impresos como {high, low}",
              "Escribió un formateador de Long y fechas; detectó y revirtió un reemplazo automático que había dañado tres $sort.",
              "Salidas legibles; todo cambio automático se revisa."],
             ["6", "«Optimiza el pipeline de dengue en Urabá»",
              "Propuso $match antes de $lookup; al medir con explain() corrigió su propia afirmación: el optimizador ya lo hacía.",
              "La consulta O1 explica lo que de verdad pasa dentro del motor."],
             ["7", "«Propón consultas con valor clínico real»",
              "Diseñó A1–A7 a partir de indicadores hospitalarios y señaló sus límites (NEWS2 solo en adultos).",
              "Consultas orientadas a decisiones, no búsquedas simples."],
             ["8", "Revisión final del informe",
              "Detectó que U5 asignaba el código de evento 210 también al dengue grave (correcto: 220) y una flecha errónea en el diagrama.",
              "Se corrigieron el script y el diagrama, y se regeneraron todas las evidencias."]],
            [0.7 * cm, 4.4 * cm, 6.6 * cm, 5.3 * cm]),
      Spacer(1, 6),
      H2("5.1 Prompts reutilizables"),
      B("«Explícame etapa por etapa qué hace este pipeline y qué documentos salen de cada etapa: [pipeline]»"),
      B("«Este comando de mongosh falla con [error]. Explícame la causa y propón la corrección mínima.»"),
      B("«Ejecuta explain('executionStats') de este pipeline e indícame si usa índice y cuántos documentos examina.»"),
      B("«Compara cómo resolverías la consulta A2 (reingresos) en MongoDB, en SQL y en Neo4j (Cypher).»"),
      P("<b>Responsabilidad humana:</b> la IA no tuvo acceso a datos reales (todo es sintético). El autor revisó cada script, "
        "puede explicarlo y es responsable de las decisiones de diseño. Las dosis, esquemas y puntajes simulados son ilustrativos "
        "y no constituyen una guía médica.", s_box),
      PageBreak()]

# =================================================================== 6. Ética
S += [H1("6. Reflexión ética sobre la manipulación de datos clínicos"),
      P("Los datos de la historia clínica son <b>datos sensibles</b> (Ley 1581 de 2012, art. 5) y están sometidos a reserva "
        "(Ley 23 de 1981, art. 34; Res. 1995 de 1999). La Ley 2015 de 2020 crea la historia clínica electrónica interoperable, lo "
        "que significa que un sistema como este, en producción, movería datos de millones de antioqueños entre instituciones. "
        "Las decisiones técnicas de este trabajo tienen consecuencias éticas concretas:"),
      H2("6.1 Privacidad: el documento agregado y la reidentificación"),
      B("<b>Riesgo del embebido.</b> Un documento de hospitalización concentra diagnósticos, evolución, medicamentos y signos "
        "vitales: quien lo lee obtiene el cuadro clínico completo. MongoDB controla permisos por colección, no por subdocumento, "
        "así que el mínimo privilegio exige <i>vistas</i> con proyecciones por rol (enfermería, facturación, epidemiología)."),
      B("<b>Reidentificación por conteos pequeños.</b> A1 publica casos por subregión: Occidente y Magdalena Medio tienen <b>un "
        "solo caso</b>. En un municipio pequeño, «el único hospitalizado por dengue de Puerto Berrío» es identificable. Antes de "
        "publicar un reporte se deben suprimir o agrupar celdas con menos de 5 casos (criterio de k-anonimato)."),
      B("<b>Minimización aplicada.</b> El " + M("$lookup") + " de A1 trae solo la subregión del paciente, no su nombre ni "
        "documento. En O1, la versión optimizada proyecta solo el nombre. Pedir menos datos reduce el impacto de una fuga."),
      H2("6.2 Trazabilidad y conservación"),
      B("<b>Auditoría.</b> Cada operación del CRUD deja un registro en " + M("auditoria") + ". Es una colección propia y no un "
        "subdocumento para que quien edita una historia no pueda alterar su rastro. En producción debería ser de solo inserción a "
        "nivel de permisos (rol sin update/delete) y alimentarse también del <i>auditLog</i> del servidor."),
      B("<b>Borrado lógico vs. definitivo.</b> La historia clínica debe conservarse por años (Res. 1995/1999, modificada por la "
        "Res. 839/2017), por eso un registro erróneo se marca como eliminado, con motivo y responsable, en lugar de destruirse. "
        "El borrado físico (D3) solo se usó en un duplicado sin contenido clínico, y el script lo verifica antes de borrar. A la "
        "vez, el borrado lógico <b>no es</b> supresión: si un titular ejerce su derecho a la supresión cuando proceda, el dato "
        "sigue existiendo y debe tratarse con un proceso de anonimización documentado."),
      B("<b>Correcciones visibles.</b> U3 no borra la orden de ibuprofeno: la suspende con fecha y motivo. Una historia clínica "
        "debe mostrar qué se ordenó y por qué se corrigió."),
      H2("6.3 Gobernanza e integridad"),
      B("<b>Esquema flexible no significa sin reglas.</b> Sin validadores, dos IPS podrían guardar la temperatura como texto o en "
        "otra unidad y corromper los análisis. Aquí el validador rechazó un paciente con 5 errores (C3)."),
      B("<b>Referencias sin claves foráneas.</b> MongoDB no impide que " + M("paciente_id") + " apunte a un paciente inexistente "
        "ni que la descripción copiada de un medicamento quede desactualizada. Esto exige procesos de verificación de referencias "
        "y un responsable del dato maestro (catálogos CIE-10 y medicamentos)."),
      B("<b>Atomicidad.</b> La admisión toca dos colecciones (cama y hospitalización). En producción se requiere un replica set "
        "y transacciones multidocumento; en este entorno de pruebas se usó un orden de escritura seguro."),
      H2("6.4 Sesgos y límites de los algoritmos clínicos"),
      B("<b>NEWS2 (A5)</b> está validado en adultos: aplicarlo a niños daría falsas alarmas o falsa tranquilidad, por eso se "
        "excluyen. La versión simplificada omite conciencia y oxígeno suplementario: es un apoyo, no un reemplazo del juicio "
        "clínico."),
      B("<b>Alergias en texto libre (A6).</b> El cruce depende de que la alergia se escriba exactamente igual («Penicilina», no "
        "«PCN»). Una alergia mal digitada produce un falso negativo con riesgo para el paciente. Se recomienda codificarlas con un "
        "terminológico estándar. A la vez, alertar por familia completa genera falsos positivos (penicilina–ceftriaxona) y la "
        "fatiga de alertas hace que el personal las ignore."),
      B("<b>Datos sintéticos.</b> Los perfiles fueron diseñados por el autor; los patrones que revelan las consultas (dengue en "
        "Urabá, reingresos de crónicos) son plausibles pero <b>no son evidencia epidemiológica</b> y no deben usarse para "
        "decisiones reales."),
      H2("6.5 Prácticas responsables propuestas"),
      tabla([["Riesgo", "Práctica"],
             ["Acceso excesivo al documento agregado", "RBAC con roles por perfil y vistas con proyección; autenticación obligatoria (este entorno local no la tiene y solo escucha en 127.0.0.1)."],
             ["Fuga de datos", "Cifrado en reposo y TLS; cifrado a nivel de campo (Queryable Encryption / CSFLE) para documento y nombre."],
             ["Reidentificación en reportes", "Supresión de celdas < 5 y seudonimización para analítica."],
             ["Alteración del rastro", "Auditoría de solo inserción, auditLog del servidor y revisión periódica."],
             ["Pérdida o destrucción de historia", "Borrado lógico por defecto, respaldos cifrados y política de retención documentada."],
             ["Uso de IA con datos clínicos", "Nunca enviar datos reales a herramientas de IA externas; usar datos sintéticos como en este trabajo."]],
            [5.3 * cm, 11.7 * cm]),
      PageBreak()]

# =================================================================== 7. Trabajo, repo, video
filas_trabajo = [["Integrante", "Rol", "Consultas propias"]] + \
    [[i["nombre"], i["rol"], ", ".join(i.get("consultas", []))] for i in cfg["integrantes"]]
S += [H1("7. Distribución del trabajo, repositorio y video"),
      P(("Este trabajo se realizó de forma <b>individual</b>, por lo que todas las actividades y consultas estuvieron a cargo "
         "del autor, con el apoyo de IA documentado en la sección 5." if INDIVIDUAL else
         "Cada integrante implementó al menos una consulta avanzada propia y la presenta en el video.")),
      tabla(filas_trabajo, [4 * cm, 9 * cm, 4 * cm]),
      Spacer(1, 8),
      H2("7.1 Repositorio digital"),
      P("Enlace: " + enlace(cfg.get("repositorio_url"), "pendiente")),
      code('''Grupo_AE3_U3_Entrega/
├─ Grupo''' + cfg["grupo"] + '''_AE3_U3.pdf          <- este informe
├─ README.md                      <- cómo reproducir
├─ scripts/   01_crear_esquema.js  02_carga_datos.js  03_crud.js  04_consultas_avanzadas.js
│             exportar_json.py  generar_capturas.py  generar_diagrama.py
├─ datos_json/                    <- las 7 colecciones exportadas (datos de prueba)
├─ resultados/                    <- salidas reales de mongosh (.txt)
├─ capturas/                      <- diagrama y capturas de ejecución (.png)
├─ ia_evidencia/EVIDENCIA_IA.md   <- prompts, resultados y aporte de la IA
├─ video/GUION_VIDEO.md           <- guion del video (<= 10 min)
└─ informe_fuente/                <- código que genera este PDF y config.json'''),
      P("<b>Reproducir:</b> " + M("mongosh --file scripts/01_crear_esquema.js") + " → " + M("02_carga_datos.js") + " → " +
        M("03_crud.js") + " → " + M("04_consultas_avanzadas.js") + ". Al volver a ejecutar los cuatro scripts desde cero se "
        "obtienen exactamente las mismas salidas que están en " + M("resultados/") + " (verificado con diff)."),
      H2("7.2 Video demostrativo"),
      P("Enlace: " + enlace(cfg.get("video_url"), "pendiente")),
      P("Duración máxima 10 minutos. Muestra la ejecución en vivo de los cuatro scripts: creación del modelo, carga de datos, "
        "cada bloque CRUD (con la auditoría al final), las consultas A1–A7 explicando la pregunta clínica y el hallazgo, la "
        "optimización O1, la evidencia de IA y la reflexión ética. El guion por minutos está en " + M("video/GUION_VIDEO.md") + "."),
      H1("8. Conclusiones"),
      B("El modelo documental de la Unidad 2 soportó sin rediseño las operaciones complejas: los arrays embebidos se manipulan "
        "con precisión ($push $each, arrayFilters, posicional $, $[], $pull) sin reescribir el documento completo."),
      B("El Aggregation Framework permite análisis clínico real (epidemiología territorial, reingresos con funciones de ventana, "
        "puntajes de alerta, seguridad del paciente) directamente en la base, sin exportar datos."),
      B("Las referencias del modelo híbrido tienen costo: cada $lookup es un join que hay que medir; explain() mostró que el "
        "índice multikey, más que el orden de las etapas, es lo que reduce el trabajo (−78 % de documentos examinados)."),
      B("La flexibilidad de NoSQL debe compensarse con validación, auditoría y borrado lógico: en datos clínicos la integridad y "
        "la trazabilidad no son opcionales."),
      B("Este modelo documental complementa el relacional de las unidades anteriores: lo transaccional y maestro (pacientes, "
        "catálogos) se beneficia de la integridad relacional, y el episodio clínico variable y de alto volumen, del documento. "
        "Esa es la base del diseño híbrido del proyecto integrador.")]

doc = SimpleDocTemplate(SALIDA, pagesize=letter, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=1.8 * cm, bottomMargin=2 * cm,
                        title=f"Grupo{cfg['grupo']}_AE3_U3 - Manipulación y consultas avanzadas en NoSQL", author=", ".join(AUTORES))
doc.build(S, onFirstPage=pie, onLaterPages=pie)
print("PDF generado:", SALIDA)
