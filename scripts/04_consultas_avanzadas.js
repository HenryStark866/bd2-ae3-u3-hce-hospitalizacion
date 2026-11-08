// =====================================================================
// 04_consultas_avanzadas.js  -  Aggregation Framework (analisis clinico)
// Requiere 01, 02 y 03. Ejecutar: mongosh --file scripts/04_consultas_avanzadas.js
// Todas las consultas excluyen registros con borrado logico (eliminado).
// =====================================================================
const hce = db.getSiblingDB("hce_hospitalizacion_u3");
const titulo = (t) => print("\n==================== " + t + " ====================");
// Imprime un documento en una linea legible (convierte Long/Decimal a numero y fechas a ISO corto)
const val = (v) => v === null || v === undefined ? "null"
  : Array.isArray(v) ? "[" + v.map(val).join(", ") + "]"
  : v instanceof Date ? v.toISOString().slice(0, 16).replace("T", " ")
  : typeof v === "object" && typeof v.toNumber === "function" ? String(v.toNumber())
  : typeof v === "object" ? "{" + Object.entries(v).map(([k, x]) => k + ": " + val(x)).join(", ") + "}"
  : String(v);
const fila = (d) => print(Object.entries(d).map(([k, v]) => k + ": " + val(v)).join(" | "));
const vigente = { eliminado: { $exists: false } };
const CORTE = new Date("2026-11-08T12:00:00Z");     // fecha de corte del reporte

// ---------------------------------------------------------------------
// A1. Perfil epidemiologico por subregion y capitulo CIE-10
//     $match -> $unwind -> $lookup(pacientes, solo territorio) -> $group x2 -> $sort
//     Pregunta: ¿donde se concentra cada tipo de enfermedad en Antioquia?
// ---------------------------------------------------------------------
titulo("A1. Perfil epidemiologico: hospitalizaciones por subregion y capitulo CIE-10");
hce.hospitalizaciones.aggregate([
  { $match: vigente },
  { $unwind: "$diagnosticos" },
  { $match: { "diagnosticos.tipo": "PRINCIPAL" } },
  { $lookup: { from: "pacientes", localField: "paciente_id", foreignField: "_id", as: "p",
               pipeline: [{ $project: { _id: 0, subregion: "$contacto.subregion" } }] } },   // minimizacion: solo el territorio
  { $lookup: { from: "catalogo_cie10", localField: "diagnosticos.cie10", foreignField: "_id", as: "c" } },
  { $group: { _id: { subregion: { $first: "$p.subregion" }, capitulo: { $first: "$c.capitulo" } }, casos: { $sum: 1 } } },
  { $sort: { casos: -1 } },
  { $group: { _id: "$_id.subregion", total: { $sum: "$casos" },
              capitulos: { $push: { $concat: ["$_id.capitulo", "=", { $toString: "$casos" }] } } } },
  { $sort: { total: -1, _id: 1 } },
  { $project: { _id: 0, subregion: "$_id", total: "$total", capitulos: "$capitulos" } }
]).forEach(fila);

// ---------------------------------------------------------------------
// A2. Reingresos hospitalarios a 30 dias (indicador de calidad)
//     $match -> $setWindowFields($shift) -> $set($dateDiff) -> $match -> $lookup -> $project
//     Pregunta: ¿que pacientes vuelven antes de 30 dias tras el alta y por que?
// ---------------------------------------------------------------------
titulo("A2. Reingresos a 30 dias (ventana por paciente con $setWindowFields)");
hce.hospitalizaciones.aggregate([
  { $match: vigente },
  { $setWindowFields: { partitionBy: "$paciente_id", sortBy: { fecha_admision: 1 }, output: {
      alta_anterior: { $shift: { output: "$alta.fecha", by: -1 } },
      dx_anterior: { $shift: { output: "$alta.diagnostico_egreso", by: -1 } },
      hosp_anterior: { $shift: { output: "$_id", by: -1 } } } } },
  { $set: { dias_desde_alta: { $dateDiff: { startDate: "$alta_anterior", endDate: "$fecha_admision", unit: "day" } },
            dx_actual: { $first: { $filter: { input: "$diagnosticos", cond: { $eq: ["$$this.tipo", "PRINCIPAL"] } } } } } },
  { $match: { dias_desde_alta: { $lte: 30 } } },
  { $lookup: { from: "pacientes", localField: "paciente_id", foreignField: "_id", as: "p" } },
  { $project: { _id: 0, paciente: { $concat: [{ $first: "$p.nombres" }, " ", { $first: "$p.apellidos" }] },
                anterior: { $concat: ["$hosp_anterior", " (", "$dx_anterior", ")"] },
                reingreso: { $concat: ["$_id", " (", "$dx_actual.cie10", ")"] },
                dias_desde_alta: "$dias_desde_alta", mismo_dx: { $eq: ["$dx_anterior", "$dx_actual.cie10"] } } },
  { $sort: { dias_desde_alta: 1 } }
]).forEach(fila);
const egresos = hce.hospitalizaciones.countDocuments({ ...vigente, estado: "EGRESADA" });
print("(egresos en el periodo: " + egresos + ")");

// ---------------------------------------------------------------------
// A3. Ocupacion de camas por servicio con los pacientes que las ocupan
//     $lookup(pipeline) -> $group -> $set(%) -> $sort  (parte de la coleccion camas)
//     Pregunta: ¿cuanta capacidad queda en cada servicio y quien esta en cada cama?
// ---------------------------------------------------------------------
titulo("A3. Ocupacion de camas por servicio (estado actual)");
hce.camas.aggregate([
  { $lookup: { from: "hospitalizaciones", localField: "hospitalizacion_id", foreignField: "_id", as: "h",
               pipeline: [{ $match: { estado: "ACTIVA", ...vigente } },
                          { $project: { paciente_id: 1, dias: { $dateDiff: { startDate: "$fecha_admision", endDate: CORTE, unit: "day" } } } }] } },
  { $group: { _id: "$servicio", total: { $sum: 1 },
              ocupadas: { $sum: { $cond: [{ $eq: ["$estado", "OCUPADA"] }, 1, 0] } },
              mantenimiento: { $sum: { $cond: [{ $eq: ["$estado", "MANTENIMIENTO"] }, 1, 0] } },
              pacientes: { $push: { $cond: [{ $gt: [{ $size: "$h" }, 0] },
                { $concat: ["$_id", ":", { $first: "$h.paciente_id" }, "(", { $toString: { $first: "$h.dias" } }, "d)"] }, "$$REMOVE"] } } } },
  { $set: { ocupacion_pct: { $round: [{ $multiply: [{ $divide: ["$ocupadas", { $subtract: ["$total", "$mantenimiento"] }] }, 100] }, 1] } } },
  { $sort: { ocupacion_pct: -1 } },
  { $project: { _id: 0, servicio: "$_id", total: "$total", ocupadas: "$ocupadas", mantenimiento: "$mantenimiento", ocupacion_pct: "$ocupacion_pct", pacientes: "$pacientes" } }
]).forEach(fila);

// ---------------------------------------------------------------------
// A4. Uso de antibioticos (ATC J01) por diagnostico: dias de terapia (DOT)
//     $unwind -> $lookup(catalogo) -> $match(regex ATC) -> $group -> $sort
//     Pregunta: ¿que antibioticos se usan, para que diagnosticos y cuanto tiempo?
// ---------------------------------------------------------------------
titulo("A4. Antibioticos (ATC J01): ordenes y dias de terapia por diagnostico principal");
hce.hospitalizaciones.aggregate([
  { $match: vigente },
  { $set: { dx: { $first: { $filter: { input: "$diagnosticos", cond: { $eq: ["$$this.tipo", "PRINCIPAL"] } } } } } },
  { $unwind: "$ordenes_medicamentos" },
  { $lookup: { from: "catalogo_medicamentos", localField: "ordenes_medicamentos.medicamento_id", foreignField: "_id", as: "m" } },
  { $match: { "m.atc": { $regex: "^J01" } } },
  { $group: { _id: { antibiotico: { $first: "$m.nombre_generico" }, dx: "$dx.cie10" }, ordenes: { $sum: 1 },
              dias_terapia: { $sum: { $dateDiff: { startDate: "$ordenes_medicamentos.fecha_inicio",
                endDate: { $ifNull: ["$ordenes_medicamentos.fecha_fin", CORTE] }, unit: "day" } } },
              suspendidas: { $sum: { $cond: [{ $eq: ["$ordenes_medicamentos.estado", "SUSPENDIDA"] }, 1, 0] } } } },
  { $sort: { dias_terapia: -1 } },
  { $project: { _id: 0, antibiotico: "$_id.antibiotico", dx: "$_id.dx", ordenes: "$ordenes", dias_terapia: "$dias_terapia",
                promedio_dias: { $round: [{ $divide: ["$dias_terapia", "$ordenes"] }, 1] }, suspendidas: "$suspendidas" } }
]).forEach(fila);

// ---------------------------------------------------------------------
// A5. Alerta temprana de deterioro (NEWS2 simplificado) en pacientes activos adultos
//     $match -> $lookup(edad) -> $set($sortArray/$last) -> $set($switch x5) -> $sort
//     Pregunta: ¿que paciente hospitalizado necesita valoracion urgente ahora?
//     NEWS2 solo es valido en >= 16 anos; en ninos se usa PEWS (se excluyen).
// ---------------------------------------------------------------------
titulo("A5. NEWS2 simplificado con la ultima toma de signos vitales (pacientes activos >= 16 anos)");
const rango = (campo, tramos) => ({ $switch: { branches: tramos.map(([cond, pts]) => ({ case: cond(campo), then: pts })), default: 0 } });
hce.hospitalizaciones.aggregate([
  { $match: { ...vigente, estado: "ACTIVA" } },
  { $lookup: { from: "pacientes", localField: "paciente_id", foreignField: "_id", as: "p",
               pipeline: [{ $project: { nac: "$fecha_nacimiento", nombre: { $concat: ["$nombres", " ", "$apellidos"] } } }] } },
  { $set: { edad: { $dateDiff: { startDate: { $first: "$p.nac" }, endDate: CORTE, unit: "year" } },
            v: { $last: { $sortArray: { input: "$signos_vitales", sortBy: { fecha: 1 } } } } } },
  { $match: { edad: { $gte: 16 } } },
  { $set: { pts: {
      fr:   rango("$v.fr", [[c => ({ $lte: [c, 8] }), 3], [c => ({ $lte: [c, 11] }), 1], [c => ({ $lte: [c, 20] }), 0], [c => ({ $lte: [c, 24] }), 2], [c => ({ $gte: [c, 25] }), 3]]),
      spo2: rango("$v.spo2", [[c => ({ $lte: [c, 91] }), 3], [c => ({ $lte: [c, 93] }), 2], [c => ({ $lte: [c, 95] }), 1]]),
      tas:  rango("$v.ta_sistolica", [[c => ({ $lte: [c, 90] }), 3], [c => ({ $lte: [c, 100] }), 2], [c => ({ $lte: [c, 110] }), 1], [c => ({ $gte: [c, 220] }), 3]]),
      fc:   rango("$v.fc", [[c => ({ $lte: [c, 40] }), 3], [c => ({ $lte: [c, 50] }), 1], [c => ({ $lte: [c, 90] }), 0], [c => ({ $lte: [c, 110] }), 1], [c => ({ $lte: [c, 130] }), 2], [c => ({ $gte: [c, 131] }), 3]]),
      temp: rango("$v.temperatura", [[c => ({ $lte: [c, 35] }), 3], [c => ({ $lte: [c, 36] }), 1], [c => ({ $lte: [c, 38] }), 0], [c => ({ $lte: [c, 39] }), 1], [c => ({ $gt: [c, 39] }), 2]]) } } },
  { $set: { news2: { $add: ["$pts.fr", "$pts.spo2", "$pts.tas", "$pts.fc", "$pts.temp"] },
            max_parametro: { $max: ["$pts.fr", "$pts.spo2", "$pts.tas", "$pts.fc", "$pts.temp"] } } },
  { $set: { riesgo: { $switch: { branches: [
      { case: { $gte: ["$news2", 7] }, then: "ALTO - respuesta de emergencia" },
      { case: { $or: [{ $gte: ["$news2", 5] }, { $eq: ["$max_parametro", 3] }] }, then: "MEDIO - valoracion urgente" } ],
      default: "BAJO - vigilancia de rutina" } } } },
  { $sort: { news2: -1 } },
  { $project: { _id: 0, hosp: "$_id", paciente: { $first: "$p.nombre" }, edad: "$edad", cama: "$cama", news2: "$news2", riesgo: "$riesgo",
                ultima_toma: { $dateToString: { date: "$v.fecha", format: "%d-%m %H:%M" } },
                signos: { $concat: ["FC ", { $toString: "$v.fc" }, " FR ", { $toString: "$v.fr" }, " TAS ", { $toString: "$v.ta_sistolica" },
                                    " SpO2 ", { $toString: "$v.spo2" }, " T ", { $toString: "$v.temperatura" }] } } }
]).forEach(fila);

// ---------------------------------------------------------------------
// A6. Seguridad del paciente: ordenes que chocan con alergias registradas
//     $lookup(pacientes) -> $unwind -> $lookup(catalogo) -> $set($map alergia->familia) -> $match($expr $in) -> $project
//     Pregunta: ¿a quien se le ordeno un medicamento de una familia a la que es alergico?
// ---------------------------------------------------------------------
titulo("A6. Conflictos alergia-medicamento (cruce paciente x orden x catalogo)");
const FAMILIA = { "Penicilina": "BETALACTAMICO", "AINEs": "AINE", "Sulfas": "SULFONAMIDA", "Quinolonas": "QUINOLONA" };
hce.hospitalizaciones.aggregate([
  { $match: vigente },
  { $lookup: { from: "pacientes", localField: "paciente_id", foreignField: "_id", as: "p",
               pipeline: [{ $match: { "alergias.0": { $exists: true } } }] } },     // solo pacientes con alergias
  { $match: { "p.0": { $exists: true } } },
  { $unwind: "$ordenes_medicamentos" },
  { $lookup: { from: "catalogo_medicamentos", localField: "ordenes_medicamentos.medicamento_id", foreignField: "_id", as: "m" } },
  { $set: { familia_med: { $first: "$m.familia_alergia" },
            familias_alergicas: { $map: { input: { $first: "$p.alergias" }, as: "a",
              in: { $getField: { field: "$$a", input: { $literal: FAMILIA } } } } } } },
  { $match: { $expr: { $in: ["$familia_med", "$familias_alergicas"] } } },
  { $project: { _id: 0, hosp: "$_id", estado_hosp: "$estado", paciente: "$paciente_id", alergias: { $first: "$p.alergias" },
                medicamento: "$ordenes_medicamentos.nombre", familia: "$familia_med", orden: "$ordenes_medicamentos.estado" } },
  { $sort: { orden: 1, hosp: 1 } }
]).forEach(fila);

// ---------------------------------------------------------------------
// A7. Estancia y desenlace por diagnostico principal (egresadas)
//     $match -> $set($dateDiff) -> $group($avg/$median/$max) -> $lookup -> $sort
//     Pregunta: ¿que diagnosticos consumen mas dias-cama y cuales tienen peor desenlace?
// ---------------------------------------------------------------------
titulo("A7. Estancia (dias) y desenlace por diagnostico principal - hospitalizaciones egresadas");
hce.hospitalizaciones.aggregate([
  { $match: { ...vigente, estado: "EGRESADA" } },
  { $set: { dias: { $dateDiff: { startDate: "$fecha_admision", endDate: "$alta.fecha", unit: "day" } } } },
  { $group: { _id: "$alta.diagnostico_egreso", egresos: { $sum: 1 }, dias_cama: { $sum: "$dias" },
              promedio: { $avg: "$dias" }, mediana: { $median: { input: "$dias", method: "approximate" } }, maximo: { $max: "$dias" },
              fallecidos: { $sum: { $cond: [{ $eq: ["$alta.condicion", "FALLECIDO"] }, 1, 0] } } } },
  { $lookup: { from: "catalogo_cie10", localField: "_id", foreignField: "_id", as: "c" } },
  { $sort: { dias_cama: -1 } },
  { $project: { _id: 0, cie10: "$_id", diagnostico: { $first: "$c.descripcion" }, egresos: "$egresos", dias_cama: "$dias_cama",
                promedio: { $round: ["$promedio", 1] }, mediana: "$mediana", maximo: "$maximo", fallecidos: "$fallecidos" } }
]).forEach(fila);

// ---------------------------------------------------------------------
// O1. Optimizacion (sugerida por IA y verificada con explain):
//     Pregunta: casos de dengue (A90/A91) en Uraba, con nombre del paciente.
//     La IA propuso mover el $match antes del $lookup. explain() mostro que el
//     optimizador de MongoDB YA lo hace solo con la parte del filtro que no
//     depende del $lookup; el ahorro real lo produce el indice ix_diagnostico.
// ---------------------------------------------------------------------
titulo("O1. Optimizacion verificada con explain('executionStats')");
const sinIndice = [      // filtro que solo existe despues del $lookup: no puede usar indices
  { $lookup: { from: "pacientes", localField: "paciente_id", foreignField: "_id", as: "p" } },
  { $match: { "p.contacto.subregion": "Uraba" } },
  { $set: { dengue: { $in: [{ $literal: true }, { $map: { input: "$diagnosticos", in: { $in: ["$$this.cie10", ["A90", "A91"]] } } }] } } },
  { $match: { dengue: true } },
  { $project: { _id: 1, paciente: { $first: "$p.nombres" } } }];
const lookupPrimero = [  // escrito "mal": $lookup antes del filtro por diagnostico
  { $lookup: { from: "pacientes", localField: "paciente_id", foreignField: "_id", as: "p" } },
  { $match: { "diagnosticos.cie10": { $in: ["A90", "A91"] }, "p.contacto.subregion": "Uraba" } },
  { $project: { _id: 1, paciente: { $first: "$p.nombres" } } }];
const matchPrimero = [   // escrito "bien": $match indexable primero y $lookup con sub-pipeline minima
  { $match: { "diagnosticos.cie10": { $in: ["A90", "A91"] } } },
  { $lookup: { from: "pacientes", localField: "paciente_id", foreignField: "_id", as: "p",
               pipeline: [{ $match: { "contacto.subregion": "Uraba" } }, { $project: { nombres: 1 } }] } },
  { $match: { "p.0": { $exists: true } } },
  { $project: { _id: 1, paciente: { $first: "$p.nombres" } } }];
const n = (x) => (x && typeof x.toNumber === "function") ? x.toNumber() : Number(x || 0);
function medir(nombre, pipe) {
  const ex = hce.hospitalizaciones.explain("executionStats").aggregate(pipe);
  const st = ex.stages || [{ $cursor: ex }];
  const cur = st[0].$cursor;
  const docs = n(cur.executionStats.totalDocsExamined) + st.filter(s => s.$lookup).reduce((a, s) => a + n(s.totalDocsExamined), 0);
  const plan = JSON.stringify(cur.queryPlanner.winningPlan).includes("IXSCAN") ? "IXSCAN" : "COLLSCAN";
  const filtro = JSON.stringify(cur.queryPlanner.parsedQuery);
  const res = hce.hospitalizaciones.aggregate(pipe).toArray();
  print(nombre.padEnd(34) + "| resultados " + res.length + " | documentos examinados " + String(docs).padStart(3) +
        " | plan " + plan + " | filtro aplicado en el cursor: " + filtro);
  return res.map(x => x._id).sort();
}
const r0 = medir("V0 filtro solo tras $lookup", sinIndice);
const r1 = medir("V1 $lookup primero", lookupPrimero);
const r2 = medir("V2 $match primero (sugerida)", matchPrimero);
print("Mismo resultado en las tres: " + (JSON.stringify(r0) === JSON.stringify(r1) && JSON.stringify(r1) === JSON.stringify(r2)) + " -> " + r2.join(", "));
