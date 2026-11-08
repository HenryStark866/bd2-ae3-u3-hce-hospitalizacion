// =====================================================================
// 03_crud.js  -  Operaciones de manipulacion (Create, Read, Update, Delete)
// Requiere haber ejecutado 01 y 02. Ejecutar: mongosh --file scripts/03_crud.js
// Cada operacion que modifica datos deja un registro en `auditoria`.
// Nota: el servidor es standalone (sin replica set), por lo que no hay
// transacciones multidocumento; se usan operaciones atomicas por documento
// (findOneAndUpdate) y un orden de escritura que no deja estados huerfanos.
// =====================================================================
const hce = db.getSiblingDB("hce_hospitalizacion_u3");
const D = (s) => new Date(s + "Z");
const titulo = (t) => print("\n==================== " + t + " ====================");
const USUARIO = "henry.taborda";
const auditar = (accion, coleccion, id, detalle) =>
  hce.auditoria.insertOne({ fecha: new Date(), usuario: USUARIO, accion, coleccion, documento_id: id, detalle });
const vigente = { eliminado: { $exists: false } };     // filtro de borrado logico

// =====================================================================
// CREATE
// =====================================================================
titulo("C1. insertOne: nuevo paciente (validado por $jsonSchema)");
let r = hce.pacientes.insertOne({
  _id: "PAC-025", tipo_documento: "CC", documento: "1001250025", nombres: "Jhon Fredy", apellidos: "Holguín Patiño",
  fecha_nacimiento: D("1984-02-17T00:00:00"), sexo: "M", grupo_sanguineo: "O+",
  contacto: { municipio: "Necoclí", subregion: "Uraba", telefono: "3001250025" },
  aseguramiento: { eps: "Coosalud", regimen: "SUBSIDIADO" }, alergias: [], antecedentes: [] });
auditar("INSERT", "pacientes", r.insertedId, "Registro de paciente nuevo");
print("insertedId: " + r.insertedId);

titulo("C2. Admision: reservar cama libre de forma atomica (findOneAndUpdate) + insertOne");
const NUEVA = "HOSP-2026-0036";
const cama = hce.camas.findOneAndUpdate(
  { servicio: "MEDICINA_INTERNA", estado: "DISPONIBLE" },
  { $set: { estado: "OCUPADA", hospitalizacion_id: NUEVA } },
  { sort: { _id: 1 }, returnDocument: "after" });
print("Cama asignada: " + cama._id + " -> " + cama.estado);
const adm = D("2026-11-08T07:30:00");
hce.hospitalizaciones.insertOne({
  _id: NUEVA, paciente_id: "PAC-025", medico_tratante_id: "PRO-002", ips: cama.ips, servicio: "MEDICINA_INTERNA",
  cama: cama._id, fecha_admision: adm, via_ingreso: "REMISION",
  motivo_ingreso: "Fiebre de 5 días, dolor abdominal y vómito (remitido de Necoclí)", estado: "ACTIVA",
  diagnosticos: [{ cie10: "A90", descripcion: "Dengue sin signos de alarma", tipo: "INGRESO", fecha: adm }],
  notas_evolucion: [], notas_enfermeria: [],
  signos_vitales: [{ fecha: adm, fc: NumberInt(108), fr: NumberInt(22), ta_sistolica: NumberInt(104), ta_diastolica: NumberInt(66),
                     temperatura: Double(38.8), spo2: NumberInt(97), registrado_por: "ENF-003" }],
  ordenes_medicamentos: [], alta: null });
auditar("INSERT", "hospitalizaciones", NUEVA, "Admision por remision, cama " + cama._id);
print("Hospitalizacion creada: " + NUEVA);

titulo("C3. insertOne invalido: el validador lo rechaza");
try {
  hce.pacientes.insertOne({ _id: "PAC-999", tipo_documento: "CC", documento: "12-34", nombres: "Prueba", apellidos: "Invalida",
    fecha_nacimiento: "1990-01-01", sexo: "X", aseguramiento: { eps: "Sura" }, contacto: { municipio: "Medellín" } });
  print("ERROR: se acepto un documento invalido");
} catch (e) {
  print("Rechazado -> codigo " + e.code + " (DocumentValidationFailure). Reglas incumplidas:");
  const reglas = (e.errInfo && e.errInfo.details && e.errInfo.details.schemaRulesNotSatisfied) || [];
  reglas.forEach(g => (g.propertiesNotSatisfied || g.missingProperties && [{ propertyName: "faltan: " + g.missingProperties.join(", ") }] || [])
    .forEach(p => print("  - " + (p.propertyName || "") + (p.details ? "  (" + p.details.map(x => x.operatorName).join(",") + ")" : ""))));
}

// =====================================================================
// READ
// =====================================================================
titulo("R1. find con filtros anidados: pacientes activos de Medicina Interna con diabetes (E11.*)");
hce.hospitalizaciones.find(
  { ...vigente, estado: "ACTIVA", servicio: "MEDICINA_INTERNA", "diagnosticos.cie10": { $regex: "^E11" } },
  { _id: 1, paciente_id: 1, cama: 1, "diagnosticos.cie10": 1, "diagnosticos.tipo": 1 }).sort({ _id: 1 })
  .forEach(d => print(d._id + "  " + d.paciente_id + "  cama " + d.cama + "  dx: " +
    d.diagnosticos.map(x => x.cie10 + "/" + x.tipo).join(", ")));

titulo("R2. findOne con $slice: ultimas 2 tomas de signos vitales de HOSP-2026-0031");
printjson(hce.hospitalizaciones.findOne({ _id: "HOSP-2026-0031" },
  { _id: 0, paciente_id: 1, servicio: 1, signos_vitales: { $slice: -2 } }));

// =====================================================================
// UPDATE
// =====================================================================
titulo("U1. Campo simple y anidado: telefono (contacto.telefono) y $addToSet de alergia");
r = hce.pacientes.updateOne({ _id: "PAC-025" },
  { $set: { "contacto.telefono": "3125550025", "contacto.acudiente": { nombre: "Marleny Patiño", parentesco: "Madre" } },
    $addToSet: { alergias: "AINEs" } });
auditar("UPDATE", "pacientes", "PAC-025", "Telefono, acudiente y alergia a AINEs");
print("matched " + r.matchedCount + ", modified " + r.modifiedCount);
printjson(hce.pacientes.findOne({ _id: "PAC-025" }, { _id: 0, contacto: 1, alergias: 1 }));

titulo("U2. $push en arreglos embebidos: nota de evolucion, diagnostico y ordenes (con $each)");
const t1 = D("2026-11-08T10:00:00");
r = hce.hospitalizaciones.updateOne({ _id: NUEVA }, { $push: {
  notas_evolucion: { fecha: t1, profesional_id: "PRO-002", subjetivo: "Dolor abdominal leve, sin sangrado.",
    objetivo: "Plaquetas 98.000, hematocrito 41 %.", analisis: "Dengue sin signos de alarma, fase febril.",
    plan: "Hidratación oral, acetaminofén, evitar AINE (alergia registrada)." },
  diagnosticos: { cie10: "A90", descripcion: "Dengue sin signos de alarma", tipo: "PRINCIPAL", fecha: t1 },
  ordenes_medicamentos: { $each: [
    { medicamento_id: "MED-010", nombre: "Acetaminofén", dosis: "500 mg", via: "VO", frecuencia: "cada 6 horas si fiebre",
      fecha_inicio: t1, fecha_fin: null, prescriptor_id: "PRO-002", estado: "ACTIVA" },
    { medicamento_id: "MED-016", nombre: "Ibuprofeno", dosis: "400 mg", via: "VO", frecuencia: "cada 8 horas",
      fecha_inicio: t1, fecha_fin: null, prescriptor_id: "PRO-002", estado: "ACTIVA" } ] } } });
auditar("UPDATE", "hospitalizaciones", NUEVA, "Nota de evolucion, dx principal y 2 ordenes");
print("modified " + r.modifiedCount + " -> ordenes ahora: " +
  hce.hospitalizaciones.findOne({ _id: NUEVA }).ordenes_medicamentos.map(o => o.nombre + " (" + o.estado + ")").join(", "));

titulo("U3. arrayFilters: suspender ordenes que chocan con la alergia del paciente");
// El ibuprofeno (AINE) esta contraindicado en dengue y el paciente es alergico a AINEs.
// $[o] actualiza SOLO los elementos del arreglo que cumplen el filtro.
r = hce.hospitalizaciones.updateOne({ _id: NUEVA },
  { $set: { "ordenes_medicamentos.$[o].estado": "SUSPENDIDA", "ordenes_medicamentos.$[o].fecha_fin": D("2026-11-08T10:20:00"),
            "ordenes_medicamentos.$[o].motivo_suspension": "Alergia a AINEs y contraindicación en dengue" } },
  { arrayFilters: [{ "o.medicamento_id": { $in: ["MED-007", "MED-016"] }, "o.estado": "ACTIVA" }] });
auditar("UPDATE", "hospitalizaciones", NUEVA, "Suspension de AINE por alergia");
hce.hospitalizaciones.findOne({ _id: NUEVA }).ordenes_medicamentos
  .forEach(o => print("  " + o.nombre.padEnd(14) + o.estado.padEnd(12) + (o.motivo_suspension || "")));

titulo("U4. Operador posicional $: corregir el diagnostico de INGRESO");
r = hce.hospitalizaciones.updateOne({ _id: "HOSP-2026-0033", "diagnosticos.tipo": "INGRESO" },
  { $set: { "diagnosticos.$.descripcion": "Infección de vías urinarias (pielonefritis aguda)" } });
auditar("UPDATE", "hospitalizaciones", "HOSP-2026-0033", "Descripcion del dx de ingreso");
print("modified " + r.modifiedCount + " -> " + hce.hospitalizaciones.findOne({ _id: "HOSP-2026-0033" }).diagnosticos[0].descripcion);

titulo("U5. updateMany: marcar notificacion SIVIGILA en todos los casos de dengue (A90/A91)");
const notificables = hce.catalogo_cie10.distinct("_id", { notificacion_obligatoria: true });
r = hce.hospitalizaciones.updateMany(
  { ...vigente, "diagnosticos": { $elemMatch: { cie10: { $in: notificables }, tipo: { $in: ["INGRESO", "PRINCIPAL"] } } },
    "notificacion_sivigila.notificado": { $ne: true } },
  [ { $set: { notificacion_sivigila: { notificado: true, fecha: "$$NOW",
      // codigo de evento INS: 210 = dengue, 220 = dengue grave (A91)
      ficha: { $concat: [{ $cond: [{ $in: ["A91", "$diagnosticos.cie10"] }, "220-", "210-"] },
                         { $substrCP: ["$_id", 10, 4] }] } } } } ]);   // update con pipeline
auditar("UPDATE", "hospitalizaciones", "*", "Notificacion SIVIGILA de " + r.modifiedCount + " casos de dengue");
print("codigos notificables: " + notificables.join(", ") + " | matched " + r.matchedCount + ", modified " + r.modifiedCount);

titulo("U6. Alta: $set del subdocumento alta + $push dx de egreso + liberar la cama");
const tAlta = D("2026-11-08T11:00:00");
r = hce.hospitalizaciones.updateOne({ _id: "HOSP-2026-0034", estado: "ACTIVA" }, {
  $set: { estado: "EGRESADA", alta: { fecha: tAlta, condicion: "MEJORADO", destino: "Domicilio", diagnostico_egreso: "K35.8",
          recomendaciones: "Control de herida en 7 días." },
          "ordenes_medicamentos.$[].estado": "FINALIZADA", "ordenes_medicamentos.$[].fecha_fin": tAlta },
  $push: { diagnosticos: { cie10: "K35.8", descripcion: "Apendicitis aguda, otra y la no especificada", tipo: "EGRESO", fecha: tAlta } } });
const libera = hce.camas.findOneAndUpdate({ hospitalizacion_id: "HOSP-2026-0034" },
  { $set: { estado: "DISPONIBLE", hospitalizacion_id: null } }, { returnDocument: "after" });
auditar("UPDATE", "hospitalizaciones", "HOSP-2026-0034", "Egreso y liberacion de cama " + libera._id);
print("hospitalizacion modified " + r.modifiedCount + " | cama " + libera._id + " -> " + libera.estado);

// =====================================================================
// DELETE
// =====================================================================
titulo("D1. Borrado LOGICO (soft delete): registro duplicado de paciente");
hce.pacientes.insertOne({ _id: "PAC-026", tipo_documento: "TI", documento: "1001250025", nombres: "Jhon Fredy", apellidos: "Holguín Patiño",
  fecha_nacimiento: D("1984-02-17T00:00:00"), sexo: "M", contacto: { municipio: "Necoclí", subregion: "Uraba" },
  aseguramiento: { eps: "Coosalud", regimen: "SUBSIDIADO" }, alergias: [], antecedentes: [] });
auditar("INSERT", "pacientes", "PAC-026", "Registro creado por error en admision (TI en vez de CC)");
r = hce.pacientes.updateOne({ _id: "PAC-026", ...vigente },
  { $set: { eliminado: { fecha: new Date(), por: USUARIO, motivo: "Duplicado de PAC-025 (mismo documento con tipo TI)" } } });
auditar("SOFT_DELETE", "pacientes", "PAC-026", "Duplicado de PAC-025");
print("marcado eliminado: " + r.modifiedCount);
print("pacientes totales: " + hce.pacientes.countDocuments() + " | vigentes: " + hce.pacientes.countDocuments(vigente));

titulo("D2. $pull: retirar una toma de signos vitales registrada en la historia equivocada");
hce.hospitalizaciones.updateOne({ _id: NUEVA }, { $push: { signos_vitales: { fecha: D("2026-11-08T10:30:00"), fc: NumberInt(72),
  fr: NumberInt(16), ta_sistolica: NumberInt(118), ta_diastolica: NumberInt(74), temperatura: Double(36.5), spo2: NumberInt(98),
  registrado_por: "ENF-003" } } });
print("tomas antes: " + hce.hospitalizaciones.findOne({ _id: NUEVA }).signos_vitales.length);
r = hce.hospitalizaciones.updateOne({ _id: NUEVA },
  { $pull: { signos_vitales: { fecha: D("2026-11-08T10:30:00"), registrado_por: "ENF-003" } } });
auditar("PULL", "hospitalizaciones", NUEVA, "Toma de signos vitales de otro paciente retirada");
print("tomas despues: " + hce.hospitalizaciones.findOne({ _id: NUEVA }).signos_vitales.length);

titulo("D3. Borrado DEFINITIVO: deleteOne del duplicado (sin contenido clinico) y deleteMany de camas temporales");
// La historia clinica no se borra (Res. 1995/1999). Solo se elimina fisicamente lo que NO es historia:
// un registro duplicado sin ninguna hospitalizacion asociada, y camas de contingencia ya desmontadas.
const tieneHistoria = hce.hospitalizaciones.countDocuments({ paciente_id: "PAC-026" }) > 0;
if (!tieneHistoria) {
  r = hce.pacientes.deleteOne({ _id: "PAC-026", "eliminado.motivo": { $exists: true } });
  auditar("HARD_DELETE", "pacientes", "PAC-026", "Duplicado sin hospitalizaciones, eliminado definitivamente");
  print("PAC-026 tenia hospitalizaciones: " + tieneHistoria + " -> deletedCount " + r.deletedCount);
}
hce.camas.insertMany(["UCI-07", "UCI-08", "UCI-09"].map(id => ({ _id: id, ips: "Clínica Cardiovascular de Antioquia",
  servicio: "UCI", estado: "DISPONIBLE", hospitalizacion_id: null, temporal: true })));
print("camas con temporales: " + hce.camas.countDocuments());
r = hce.camas.deleteMany({ temporal: true, estado: "DISPONIBLE" });
auditar("HARD_DELETE", "camas", "UCI-07..09", "Fin de la contingencia por dengue");
print("deleteMany camas temporales: " + r.deletedCount + " | camas ahora: " + hce.camas.countDocuments());

titulo("Resumen: trazabilidad en la coleccion auditoria");
print("Registros de auditoria generados por este script: " + hce.auditoria.countDocuments());
hce.auditoria.aggregate([{ $group: { _id: "$accion", n: { $sum: 1 } } }, { $sort: { _id: 1 } }])
  .forEach(a => print("  " + a._id.padEnd(12) + a.n));
