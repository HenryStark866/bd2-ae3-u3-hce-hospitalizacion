// =====================================================================
// 01_crear_esquema.js  -  HCE Basica Antioquia / Subsistema Hospitalizacion
// Unidad 3: manipulacion (CRUD) y consultas avanzadas en NoSQL documental
// SGBD: MongoDB 8.x   |   Ejecutar:  mongosh --file scripts/01_crear_esquema.js
//
// Evoluciona el modelo hibrido de la Unidad 2:
//   + coleccion `camas` (inventario y ocupacion por servicio)
//   + coleccion `auditoria` (bitacora de quien hizo que, nunca se borra)
//   + borrado logico: campo `eliminado` {fecha, por, motivo} en pacientes
//     y hospitalizaciones (la historia clinica no se destruye)
//   + `familia_alergia` en el catalogo de medicamentos (alertas de seguridad)
//   + `subregion` del paciente y `notificacion_sivigila` (vigilancia)
// =====================================================================
const hce = db.getSiblingDB("hce_hospitalizacion_u3");
hce.dropDatabase();

// Subdocumento comun de borrado logico
const ELIMINADO = { bsonType: "object", required: ["fecha", "por", "motivo"],
  properties: { fecha: { bsonType: "date" }, por: { bsonType: "string" }, motivo: { bsonType: "string" } } };

// ---------- Catalogos (referenciados) ----------
hce.createCollection("catalogo_cie10", { validator: { $jsonSchema: {
  bsonType: "object", required: ["_id", "descripcion", "capitulo"],
  properties: { _id: { bsonType: "string", description: "Codigo CIE-10" },
    descripcion: { bsonType: "string" }, capitulo: { bsonType: "string" },
    notificacion_obligatoria: { bsonType: "bool", description: "evento de interes en salud publica (SIVIGILA)" } } } } });

hce.createCollection("catalogo_medicamentos", { validator: { $jsonSchema: {
  bsonType: "object", required: ["_id", "nombre_generico", "atc"],
  properties: { _id: { bsonType: "string" }, nombre_generico: { bsonType: "string" },
    atc: { bsonType: "string", pattern: "^[A-Z][0-9]{2}[A-Z]{2}[0-9]{2}$" },
    forma: { bsonType: "string" }, concentracion: { bsonType: "string" },
    familia_alergia: { bsonType: ["string", "null"], description: "grupo para cruzar con alergias del paciente" } } } } });

hce.createCollection("profesionales", { validator: { $jsonSchema: {
  bsonType: "object", required: ["_id", "nombre", "rol", "registro_medico"],
  properties: { _id: { bsonType: "string" }, nombre: { bsonType: "string" },
    rol: { enum: ["MEDICO", "ENFERMERIA", "ESPECIALISTA"] },
    especialidad: { bsonType: "string" }, registro_medico: { bsonType: "string" } } } } });

// ---------- Pacientes ----------
hce.createCollection("pacientes", { validator: { $jsonSchema: {
  bsonType: "object",
  required: ["_id", "tipo_documento", "documento", "nombres", "apellidos", "fecha_nacimiento", "sexo", "aseguramiento", "contacto"],
  properties: {
    _id: { bsonType: "string" },
    tipo_documento: { enum: ["CC", "TI", "RC", "CE", "PA"] },
    documento: { bsonType: "string", pattern: "^[0-9A-Z]{5,15}$" },
    nombres: { bsonType: "string" }, apellidos: { bsonType: "string" },
    fecha_nacimiento: { bsonType: "date" },
    sexo: { enum: ["F", "M", "I"] },
    grupo_sanguineo: { enum: ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"] },
    contacto: { bsonType: "object", required: ["municipio", "subregion"], properties: {
      municipio: { bsonType: "string" },
      subregion: { enum: ["Valle de Aburra", "Oriente", "Uraba", "Bajo Cauca", "Magdalena Medio", "Occidente", "Norte", "Nordeste", "Suroeste"] },
      telefono: { bsonType: "string" }, acudiente: { bsonType: "object" } } },
    aseguramiento: { bsonType: "object", required: ["eps", "regimen"], properties: {
      eps: { bsonType: "string" }, regimen: { enum: ["CONTRIBUTIVO", "SUBSIDIADO", "ESPECIAL"] } } },
    alergias: { bsonType: "array", items: { bsonType: "string" } },
    antecedentes: { bsonType: "array", items: { bsonType: "string" } },
    eliminado: ELIMINADO
  } } } });

// ---------- Camas ----------
hce.createCollection("camas", { validator: { $jsonSchema: {
  bsonType: "object", required: ["_id", "ips", "servicio", "estado"],
  properties: { _id: { bsonType: "string" }, ips: { bsonType: "string" },
    servicio: { enum: ["MEDICINA_INTERNA", "PEDIATRIA", "CIRUGIA", "GINECOOBSTETRICIA", "UCI"] },
    estado: { enum: ["DISPONIBLE", "OCUPADA", "MANTENIMIENTO"] },
    hospitalizacion_id: { bsonType: ["string", "null"], description: "REF -> hospitalizaciones._id si esta OCUPADA" },
    temporal: { bsonType: "bool", description: "cama de contingencia (expansion por brote)" } } } } });

// ---------- Hospitalizaciones (nucleo, subdocumentos embebidos) ----------
hce.createCollection("hospitalizaciones", { validator: { $jsonSchema: {
  bsonType: "object",
  required: ["_id", "paciente_id", "ips", "servicio", "cama", "fecha_admision", "motivo_ingreso", "estado", "medico_tratante_id", "diagnosticos"],
  properties: {
    _id: { bsonType: "string" },
    paciente_id: { bsonType: "string", description: "REF -> pacientes._id" },
    medico_tratante_id: { bsonType: "string", description: "REF -> profesionales._id" },
    ips: { bsonType: "string" },
    servicio: { enum: ["MEDICINA_INTERNA", "PEDIATRIA", "CIRUGIA", "GINECOOBSTETRICIA", "UCI"] },
    cama: { bsonType: "string", description: "REF -> camas._id" },
    fecha_admision: { bsonType: "date" },
    via_ingreso: { enum: ["URGENCIAS", "REMISION", "CONSULTA_EXTERNA"] },
    motivo_ingreso: { bsonType: "string" },
    estado: { enum: ["ACTIVA", "EGRESADA"] },
    diagnosticos: { bsonType: "array", minItems: 1, items: { bsonType: "object",
      required: ["cie10", "tipo", "fecha"],
      properties: { cie10: { bsonType: "string" }, descripcion: { bsonType: "string" },
        tipo: { enum: ["INGRESO", "PRINCIPAL", "RELACIONADO", "EGRESO"] }, fecha: { bsonType: "date" } } } },
    notas_evolucion: { bsonType: "array", items: { bsonType: "object",
      required: ["fecha", "profesional_id", "analisis", "plan"],
      properties: { fecha: { bsonType: "date" }, profesional_id: { bsonType: "string" },
        subjetivo: { bsonType: "string" }, objetivo: { bsonType: "string" },
        analisis: { bsonType: "string" }, plan: { bsonType: "string" } } } },
    signos_vitales: { bsonType: "array", items: { bsonType: "object",
      required: ["fecha", "fc", "fr", "ta_sistolica", "ta_diastolica", "temperatura", "spo2"],
      properties: { fecha: { bsonType: "date" },
        fc: { bsonType: "int", minimum: 20, maximum: 250 },
        fr: { bsonType: "int", minimum: 4, maximum: 80 },
        ta_sistolica: { bsonType: "int", minimum: 40, maximum: 300 },
        ta_diastolica: { bsonType: "int", minimum: 20, maximum: 200 },
        temperatura: { bsonType: "double", minimum: 30, maximum: 45 },
        spo2: { bsonType: "int", minimum: 50, maximum: 100 },
        registrado_por: { bsonType: "string" } } } },
    notas_enfermeria: { bsonType: "array", items: { bsonType: "object",
      required: ["fecha", "enfermera_id", "turno", "nota"],
      properties: { fecha: { bsonType: "date" }, enfermera_id: { bsonType: "string" },
        turno: { enum: ["MANANA", "TARDE", "NOCHE"] }, nota: { bsonType: "string" } } } },
    ordenes_medicamentos: { bsonType: "array", items: { bsonType: "object",
      required: ["medicamento_id", "dosis", "via", "frecuencia", "fecha_inicio", "prescriptor_id", "estado"],
      properties: { medicamento_id: { bsonType: "string" }, nombre: { bsonType: "string" },
        dosis: { bsonType: "string" }, via: { enum: ["VO", "IV", "IM", "SC", "INH", "TOPICA"] },
        frecuencia: { bsonType: "string" },
        fecha_inicio: { bsonType: "date" }, fecha_fin: { bsonType: ["date", "null"] },
        prescriptor_id: { bsonType: "string" },
        estado: { enum: ["ACTIVA", "SUSPENDIDA", "FINALIZADA"] },
        motivo_suspension: { bsonType: "string" } } } },
    notificacion_sivigila: { bsonType: "object", properties: {
      notificado: { bsonType: "bool" }, fecha: { bsonType: "date" }, ficha: { bsonType: "string" } } },
    alta: { bsonType: ["object", "null"], properties: {
      fecha: { bsonType: "date" }, condicion: { enum: ["MEJORADO", "ESTABLE", "REFERIDO", "FALLECIDO", "VOLUNTARIO"] },
      destino: { bsonType: "string" }, diagnostico_egreso: { bsonType: "string" },
      recomendaciones: { bsonType: "string" } } },
    eliminado: ELIMINADO
  } } } });

// ---------- Auditoria (append-only) ----------
hce.createCollection("auditoria", { validator: { $jsonSchema: {
  bsonType: "object", required: ["fecha", "usuario", "accion", "coleccion", "documento_id"],
  properties: { fecha: { bsonType: "date" }, usuario: { bsonType: "string" },
    accion: { enum: ["INSERT", "UPDATE", "SOFT_DELETE", "HARD_DELETE", "PULL"] },
    coleccion: { bsonType: "string" }, documento_id: { bsonType: "string" },
    detalle: { bsonType: "string" } } } } });

// ---------- Indices ----------
hce.pacientes.createIndex({ tipo_documento: 1, documento: 1 }, { unique: true, name: "ux_documento" });
hce.pacientes.createIndex({ "contacto.subregion": 1, "contacto.municipio": 1 }, { name: "ix_territorio" });
hce.hospitalizaciones.createIndex({ paciente_id: 1, fecha_admision: 1 }, { name: "ix_paciente_fecha" });
hce.hospitalizaciones.createIndex({ "diagnosticos.cie10": 1, "diagnosticos.tipo": 1 }, { name: "ix_diagnostico" });
// Nota: se intento un indice parcial { eliminado: { $exists: false } } para indexar solo registros
// vigentes, pero MongoDB lo rechaza ("Expression not supported in partial index: $not").
// Los indices parciales solo admiten $exists:true, igualdades, rangos, $type y $and.
hce.hospitalizaciones.createIndex({ estado: 1, servicio: 1 }, { name: "ix_estado_servicio" });
hce.hospitalizaciones.createIndex({ "ordenes_medicamentos.medicamento_id": 1 }, { name: "ix_medicamento" });
hce.camas.createIndex({ servicio: 1, estado: 1 }, { name: "ix_cama_servicio_estado" });
hce.auditoria.createIndex({ documento_id: 1, fecha: -1 }, { name: "ix_auditoria_doc" });

print("Base de datos 'hce_hospitalizacion_u3' creada. Colecciones:");
printjson(hce.getCollectionNames().sort());
print("Indices:");
["pacientes", "hospitalizaciones", "camas", "auditoria"].forEach(c =>
  hce[c].getIndexes().forEach(i => print("  " + c.padEnd(18) + i.name)));
