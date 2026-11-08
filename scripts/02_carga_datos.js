// =====================================================================
// 02_carga_datos.js  -  Datos simulados coherentes (TODOS FICTICIOS)
// 24 pacientes de 6 subregiones de Antioquia, 35 hospitalizaciones (jul-nov 2026),
// 30 camas. Las hospitalizaciones se expanden desde PERFILES CLINICOS para que
// diagnostico, servicio, medicamentos, signos vitales y estancia sean coherentes.
// Sin azar: mismo resultado en cada ejecucion.
// Ejecutar: mongosh --file scripts/02_carga_datos.js
// =====================================================================
const hce = db.getSiblingDB("hce_hospitalizacion_u3");
const D = (s) => new Date(s + (s.length === 10 ? "T00:00:00Z" : "Z"));
const H = 3600 * 1000;
const AHORA = D("2026-11-08T08:00:00");          // "hoy" de la simulacion

// ---------------------------------------------------------------- Catalogos
hce.catalogo_cie10.insertMany([
  { _id: "J18.9", descripcion: "Neumonía, no especificada", capitulo: "Respiratorio", notificacion_obligatoria: false },
  { _id: "J44.1", descripcion: "EPOC con exacerbación aguda", capitulo: "Respiratorio", notificacion_obligatoria: false },
  { _id: "J21.9", descripcion: "Bronquiolitis aguda, no especificada", capitulo: "Respiratorio", notificacion_obligatoria: false },
  { _id: "E11.9", descripcion: "Diabetes mellitus tipo 2 sin complicaciones", capitulo: "Endocrino", notificacion_obligatoria: false },
  { _id: "E11.1", descripcion: "Diabetes mellitus tipo 2 con cetoacidosis", capitulo: "Endocrino", notificacion_obligatoria: false },
  { _id: "I10",   descripcion: "Hipertensión esencial (primaria)", capitulo: "Circulatorio", notificacion_obligatoria: false },
  { _id: "I21.9", descripcion: "Infarto agudo de miocardio, sin otra especificación", capitulo: "Circulatorio", notificacion_obligatoria: false },
  { _id: "I50.0", descripcion: "Insuficiencia cardíaca congestiva", capitulo: "Circulatorio", notificacion_obligatoria: false },
  { _id: "A09",   descripcion: "Diarrea y gastroenteritis de presunto origen infeccioso", capitulo: "Infecciosas", notificacion_obligatoria: false },
  { _id: "A90",   descripcion: "Dengue sin signos de alarma", capitulo: "Infecciosas", notificacion_obligatoria: true },
  { _id: "A91",   descripcion: "Dengue grave", capitulo: "Infecciosas", notificacion_obligatoria: true },
  { _id: "N39.0", descripcion: "Infección de vías urinarias, sitio no especificado", capitulo: "Genitourinario", notificacion_obligatoria: false },
  { _id: "K35.8", descripcion: "Apendicitis aguda, otra y la no especificada", capitulo: "Digestivo", notificacion_obligatoria: false }
]);

hce.catalogo_medicamentos.insertMany([
  { _id: "MED-001", nombre_generico: "Ceftriaxona", atc: "J01DD04", forma: "Polvo inyectable", concentracion: "1 g", familia_alergia: "BETALACTAMICO" },
  { _id: "MED-002", nombre_generico: "Azitromicina", atc: "J01FA10", forma: "Tableta", concentracion: "500 mg", familia_alergia: "MACROLIDO" },
  { _id: "MED-003", nombre_generico: "Salbutamol", atc: "R03AC02", forma: "Inhalador", concentracion: "100 mcg/dosis", familia_alergia: null },
  { _id: "MED-004", nombre_generico: "Prednisolona", atc: "H02AB06", forma: "Tableta", concentracion: "50 mg", familia_alergia: null },
  { _id: "MED-005", nombre_generico: "Insulina cristalina", atc: "A10AB01", forma: "Solución inyectable", concentracion: "100 UI/mL", familia_alergia: null },
  { _id: "MED-006", nombre_generico: "Enoxaparina", atc: "B01AB05", forma: "Jeringa prellenada", concentracion: "40 mg", familia_alergia: null },
  { _id: "MED-007", nombre_generico: "Ácido acetilsalicílico", atc: "B01AC06", forma: "Tableta", concentracion: "100 mg", familia_alergia: "AINE" },
  { _id: "MED-008", nombre_generico: "Losartán", atc: "C09CA01", forma: "Tableta", concentracion: "50 mg", familia_alergia: null },
  { _id: "MED-009", nombre_generico: "Lactato de Ringer", atc: "B05BB01", forma: "Solución IV", concentracion: "1000 mL", familia_alergia: null },
  { _id: "MED-010", nombre_generico: "Acetaminofén", atc: "N02BE01", forma: "Tableta", concentracion: "500 mg", familia_alergia: null },
  { _id: "MED-011", nombre_generico: "Ciprofloxacino", atc: "J01MA02", forma: "Tableta", concentracion: "500 mg", familia_alergia: "QUINOLONA" },
  { _id: "MED-012", nombre_generico: "Metformina", atc: "A10BA02", forma: "Tableta", concentracion: "850 mg", familia_alergia: null },
  { _id: "MED-013", nombre_generico: "Ampicilina/sulbactam", atc: "J01CR01", forma: "Polvo inyectable", concentracion: "1.5 g", familia_alergia: "BETALACTAMICO" },
  { _id: "MED-014", nombre_generico: "Furosemida", atc: "C03CA01", forma: "Solución inyectable", concentracion: "20 mg/2 mL", familia_alergia: "SULFONAMIDA" },
  { _id: "MED-015", nombre_generico: "Trimetoprim/sulfametoxazol", atc: "J01EE01", forma: "Tableta", concentracion: "160/800 mg", familia_alergia: "SULFONAMIDA" },
  { _id: "MED-016", nombre_generico: "Ibuprofeno", atc: "M01AE01", forma: "Tableta", concentracion: "400 mg", familia_alergia: "AINE" },
  { _id: "MED-017", nombre_generico: "Atorvastatina", atc: "C10AA05", forma: "Tableta", concentracion: "40 mg", familia_alergia: null }
]);

// Alergia declarada por el paciente -> familia del catalogo
const FAMILIA = { "Penicilina": "BETALACTAMICO", "AINEs": "AINE", "Sulfas": "SULFONAMIDA", "Quinolonas": "QUINOLONA" };

hce.profesionales.insertMany([
  { _id: "PRO-001", nombre: "Dra. Marcela Restrepo Vélez", rol: "MEDICO", especialidad: "Medicina Interna", registro_medico: "RM-05-11872" },
  { _id: "PRO-002", nombre: "Dr. Andrés Giraldo Mejía", rol: "MEDICO", especialidad: "Medicina Interna", registro_medico: "RM-05-20931" },
  { _id: "PRO-003", nombre: "Dra. Juliana Ospina Cano", rol: "ESPECIALISTA", especialidad: "Pediatría", registro_medico: "RM-05-30415" },
  { _id: "PRO-004", nombre: "Dr. Camilo Zapata Ruiz", rol: "ESPECIALISTA", especialidad: "Cirugía General", registro_medico: "RM-05-17764" },
  { _id: "PRO-005", nombre: "Dr. Felipe Úsuga Mesa", rol: "ESPECIALISTA", especialidad: "Pediatría", registro_medico: "RM-05-41190" },
  { _id: "PRO-006", nombre: "Dra. Catalina Betancur Rojas", rol: "ESPECIALISTA", especialidad: "Medicina Crítica", registro_medico: "RM-05-28803" },
  { _id: "ENF-001", nombre: "Enf. Luz Dary Henao", rol: "ENFERMERIA", especialidad: "Enfermería", registro_medico: "RE-05-4410" },
  { _id: "ENF-002", nombre: "Enf. Carlos Mario Quintero", rol: "ENFERMERIA", especialidad: "Enfermería", registro_medico: "RE-05-5122" },
  { _id: "ENF-003", nombre: "Enf. Yuliana Correa Arboleda", rol: "ENFERMERIA", especialidad: "Enfermería", registro_medico: "RE-05-6037" }
]);

// ---------------------------------------------------------------- Camas
const IPS = { MEDICINA_INTERNA: "Hospital General de Medellín", PEDIATRIA: "Hospital Infantil Concejo de Medellín",
              CIRUGIA: "Hospital San Juan de Dios Rionegro", UCI: "Clínica Cardiovascular de Antioquia" };
const camas = [];
const addCamas = (pref, servicio, n, ini) => { for (let i = 0; i < n; i++)
  camas.push({ _id: pref + String(ini + i).padStart(2, "0"), ips: IPS[servicio], servicio, estado: "DISPONIBLE", hospitalizacion_id: null, temporal: false }); };
addCamas("MI-2", "MEDICINA_INTERNA", 12, 1);   // MI-201..MI-212
addCamas("PE-1", "PEDIATRIA", 6, 1);
addCamas("CI-3", "CIRUGIA", 6, 1);
addCamas("UCI-", "UCI", 6, 1);
camas.find(c => c._id === "MI-212").estado = "MANTENIMIENTO";

// ---------------------------------------------------------------- Pacientes
// [id, tipoDoc, doc, nombres, apellidos, nacimiento, sexo, sangre, municipio, subregion, eps, regimen, alergias, antecedentes, acudiente]
const P = [
  ["PAC-001", "CC", "1017000001", "Gloria Inés", "Ramírez Toro", "1958-03-14", "F", "O+", "Medellín", "Valle de Aburra", "Savia Salud", "SUBSIDIADO", ["Penicilina"], ["Hipertensión arterial", "Diabetes mellitus tipo 2"]],
  ["PAC-002", "CC", "70050002", "Jorge Eliécer", "Muñoz Pérez", "1951-11-02", "M", "A+", "Bello", "Valle de Aburra", "Sura", "CONTRIBUTIVO", [], ["EPOC", "Tabaquismo (40 paquetes-año)"]],
  ["PAC-003", "TI", "1020000003", "Sara Valentina", "Cardona Londoño", "2012-07-21", "F", "B+", "Itagüí", "Valle de Aburra", "Savia Salud", "SUBSIDIADO", [], [], { nombre: "Paola Londoño", parentesco: "Madre" }],
  ["PAC-004", "CC", "98040004", "Luis Fernando", "Arango Salazar", "1969-05-30", "M", "O-", "Envigado", "Valle de Aburra", "Sanitas", "CONTRIBUTIVO", ["AINEs"], ["Dislipidemia", "Hipertensión arterial"]],
  ["PAC-005", "CC", "43050005", "María Camila", "Echeverri Gómez", "1996-09-09", "F", "A-", "Rionegro", "Oriente", "Coosalud", "SUBSIDIADO", [], ["Cesárea previa"]],
  ["PAC-006", "CC", "15060006", "Héctor Darío", "Jaramillo Builes", "1975-01-25", "M", "AB+", "Apartadó", "Uraba", "Nueva EPS", "CONTRIBUTIVO", ["Sulfas"], ["Diabetes mellitus tipo 2"]],
  ["PAC-007", "CC", "21070007", "Rosa Elvira", "Gómez de Zapata", "1944-04-18", "F", "O+", "Medellín", "Valle de Aburra", "Sura", "CONTRIBUTIVO", [], ["Insuficiencia cardíaca", "Hipertensión arterial"]],
  ["PAC-008", "RC", "1036080008", "Juan Pablo", "Hincapié Ríos", "2024-06-03", "M", "O+", "Bello", "Valle de Aburra", "Savia Salud", "SUBSIDIADO", [], [], { nombre: "Yesica Ríos", parentesco: "Madre" }],
  ["PAC-009", "RC", "1036090009", "Valentina", "Mesa Cardona", "2025-02-11", "F", "A+", "Medellín", "Valle de Aburra", "Sura", "CONTRIBUTIVO", [], ["Prematurez (35 semanas)"], { nombre: "Diana Cardona", parentesco: "Madre" }],
  ["PAC-010", "CC", "1045100010", "Yeison Andrés", "Palacios Mosquera", "1990-10-30", "M", "O+", "Turbo", "Uraba", "Coosalud", "SUBSIDIADO", [], []],
  ["PAC-011", "CC", "39110011", "Luz Marina", "Córdoba Hurtado", "1982-12-07", "F", "B+", "Apartadó", "Uraba", "Nueva EPS", "SUBSIDIADO", [], ["Obesidad"]],
  ["PAC-012", "TI", "1040120012", "Wilmar Alexis", "Pino Durango", "2010-03-22", "M", "O+", "Caucasia", "Bajo Cauca", "Savia Salud", "SUBSIDIADO", [], [], { nombre: "Edilma Durango", parentesco: "Madre" }],
  ["PAC-013", "CC", "1040130013", "Deisy Johana", "Montes Ortega", "1999-08-15", "F", "A+", "Caucasia", "Bajo Cauca", "Savia Salud", "SUBSIDIADO", [], []],
  ["PAC-014", "CC", "8140014", "Alirio de Jesús", "Ochoa Vargas", "1960-01-09", "M", "O+", "Puerto Berrío", "Magdalena Medio", "Nueva EPS", "SUBSIDIADO", [], ["Hipertensión arterial"]],
  ["PAC-015", "CC", "3150015", "Gustavo Adolfo", "Higuita Torres", "1956-06-27", "M", "A+", "Santa Fe de Antioquia", "Occidente", "Savia Salud", "SUBSIDIADO", [], ["Hipertensión arterial", "Diabetes mellitus tipo 2", "Tabaquismo"]],
  ["PAC-016", "CC", "1036160016", "Natalia", "Villegas Arango", "2001-05-05", "F", "B-", "Envigado", "Valle de Aburra", "Sura", "CONTRIBUTIVO", ["Quinolonas"], []],
  ["PAC-017", "CC", "1036170017", "Esteban", "Gallego Marín", "1988-11-19", "M", "O+", "Rionegro", "Oriente", "Sura", "CONTRIBUTIVO", [], []],
  ["PAC-018", "CC", "32180018", "Martha Lucía", "Álvarez Restrepo", "1950-09-30", "F", "A+", "Itagüí", "Valle de Aburra", "Sanitas", "CONTRIBUTIVO", [], ["Diabetes mellitus tipo 2", "Hipertensión arterial"]],
  ["PAC-019", "CC", "3190019", "Ramiro", "Castaño Giraldo", "1947-02-14", "M", "O+", "Marinilla", "Oriente", "Nueva EPS", "CONTRIBUTIVO", [], ["EPOC", "Tabaquismo (35 paquetes-año)"]],
  ["PAC-020", "TI", "1045200020", "Ana Sofía", "Rentería Asprilla", "2016-01-28", "F", "O+", "Turbo", "Uraba", "Coosalud", "SUBSIDIADO", [], [], { nombre: "Luz Asprilla", parentesco: "Madre" }],
  ["PAC-021", "RC", "1045210021", "Sebastián", "Cuesta Moreno", "2020-09-12", "M", "A+", "Apartadó", "Uraba", "Nueva EPS", "SUBSIDIADO", [], [], { nombre: "Sandra Moreno", parentesco: "Madre" }],
  ["PAC-022", "CC", "42220022", "Carmen Rosa", "Tobón Agudelo", "1965-07-07", "F", "B+", "Medellín", "Valle de Aburra", "Savia Salud", "SUBSIDIADO", ["Penicilina"], ["Diabetes mellitus tipo 2"]],
  ["PAC-023", "CC", "71230023", "Óscar Iván", "Zuluaga Henao", "1979-03-03", "M", "O-", "Bello", "Valle de Aburra", "Sura", "CONTRIBUTIVO", [], ["Hipertensión arterial"]],
  ["PAC-024", "CC", "1045240024", "Paula Andrea", "Lemos Rivas", "1993-12-24", "F", "A+", "Turbo", "Uraba", "Coosalud", "SUBSIDIADO", [], []]
];
hce.pacientes.insertMany(P.map(p => {
  const doc = { _id: p[0], tipo_documento: p[1], documento: p[2], nombres: p[3], apellidos: p[4],
    fecha_nacimiento: D(p[5]), sexo: p[6], grupo_sanguineo: p[7],
    contacto: { municipio: p[8], subregion: p[9], telefono: "300" + p[0].slice(4).padStart(7, "0") },
    aseguramiento: { eps: p[10], regimen: p[11] }, alergias: p[12], antecedentes: p[13] };
  if (p[14]) doc.contacto.acudiente = p[14];
  return doc;
}));
const PAC = Object.fromEntries(P.map(p => [p[0], { nac: D(p[5]), antecedentes: p[13] }]));

// ---------------------------------------------------------------- Perfiles clinicos
// enf = signos [fc, fr, sis, dia, temp, spo2] al ingreso; meds = [id, dosis, via, frecuencia, horasDesdeIngreso]
const NORMAL = [78, 16, 120, 76, 36.8, 97];
const PERFILES = {
  NAC: { cie: "J18.9", servicio: "MEDICINA_INTERNA", via: "URGENCIAS", motivo: "Fiebre, tos productiva y disnea de 3 días de evolución",
    enf: [106, 26, 126, 76, 38.7, 89],
    meds: [["MED-001", "1 g", "IV", "cada 12 horas", 2], ["MED-002", "500 mg", "VO", "cada 24 horas", 2], ["MED-010", "500 mg", "VO", "cada 8 horas si fiebre", 2]],
    evol: [["Disnea y fiebre.", "Crépitos basales, Rx con consolidación.", "Neumonía adquirida en comunidad CURB-65 = 2.", "Oxígeno, antibiótico IV, hidratación."],
           ["Menos disnea, persiste tos.", "Afebril 24 h, SpO2 94 % con cánula.", "Buena respuesta al tratamiento.", "Continuar antibiótico, destete de oxígeno."],
           ["Asintomático respiratorio.", "SpO2 96 % al aire ambiente.", "Resolución clínica.", "Paso a vía oral y egreso."]] },
  EPOC: { cie: "J44.1", servicio: "MEDICINA_INTERNA", via: "URGENCIAS", motivo: "Disnea progresiva y aumento de expectoración",
    enf: [112, 28, 148, 88, 37.3, 87],
    meds: [["MED-003", "4 disparos", "INH", "cada 6 horas", 1], ["MED-004", "50 mg", "VO", "cada 24 horas", 2], ["MED-002", "500 mg", "VO", "cada 24 horas", 2]],
    evol: [["Disnea de moderados esfuerzos.", "Sibilancias difusas, SpO2 87 %.", "Exacerbación de EPOC GOLD E.", "Broncodilatadores, corticoide, oxígeno controlado."],
           ["Mejoría parcial.", "SpO2 91 % con 2 L/min.", "Evolución favorable.", "Destete de oxígeno."],
           ["Sin disnea en reposo.", "SpO2 92 % ambiente.", "Estable.", "Egreso con inhaladores y control por neumología."]] },
  BRONQ: { cie: "J21.9", servicio: "PEDIATRIA", via: "URGENCIAS", motivo: "Dificultad respiratoria y rechazo a la vía oral",
    enf: [168, 54, 92, 56, 37.9, 90],
    meds: [["MED-009", "mantenimiento según peso", "IV", "continuo", 1], ["MED-010", "15 mg/kg", "VO", "cada 6 horas si fiebre", 1]],
    evol: [["Madre refiere tos y dificultad para respirar.", "Tirajes subcostales, sibilancias.", "Bronquiolitis moderada.", "Oxígeno, succión nasal, líquidos IV."],
           ["Recibe mejor la leche materna.", "Menos tirajes.", "Mejoría.", "Destete de oxígeno."],
           ["Sin dificultad respiratoria.", "SpO2 95 % ambiente.", "Resuelta.", "Egreso con signos de alarma."]] },
  CAD: { cie: "E11.1", servicio: "MEDICINA_INTERNA", via: "URGENCIAS", motivo: "Poliuria, polidipsia, náuseas y malestar general",
    enf: [118, 26, 102, 62, 37.4, 96],
    meds: [["MED-005", "0.1 UI/kg/h en infusión", "IV", "continuo", 1], ["MED-009", "1000 mL", "IV", "cada 4 horas", 1], ["MED-012", "850 mg", "VO", "cada 12 horas", 48]],
    evol: [["Sed intensa, náuseas.", "Glucemia 480 mg/dL, cetonuria 3+, pH 7.21.", "Cetoacidosis diabética.", "Insulina en infusión, hidratación, electrolitos."],
           ["Sin náuseas.", "Glucemia 190 mg/dL, pH 7.36.", "Resolución de la acidosis.", "Transición a insulina SC."],
           ["Asintomático.", "Glucometrías en metas.", "Compensado.", "Egreso con educación en diabetes."]] },
  HTA: { cie: "I10", servicio: "MEDICINA_INTERNA", via: "URGENCIAS", motivo: "Cefalea intensa y cifras tensionales elevadas",
    enf: [92, 18, 196, 112, 36.6, 97],
    meds: [["MED-008", "100 mg", "VO", "cada 24 horas", 1], ["MED-010", "500 mg", "VO", "cada 8 horas si dolor", 1]],
    evol: [["Cefalea occipital.", "TA 196/112, sin déficit neurológico.", "Urgencia hipertensiva.", "Reducción gradual de TA por vía oral."],
           ["Cefalea leve.", "TA 160/95.", "Respuesta parcial.", "Ajuste de antihipertensivo."],
           ["Sin cefalea.", "TA 136/84.", "Control logrado.", "Egreso y control ambulatorio."]] },
  IAM: { cie: "I21.9", servicio: "UCI", via: "REMISION", motivo: "Dolor torácico opresivo irradiado a brazo izquierdo",
    enf: [104, 22, 152, 94, 36.8, 93],
    meds: [["MED-007", "100 mg", "VO", "cada 24 horas", 0], ["MED-006", "40 mg", "SC", "cada 12 horas", 1], ["MED-017", "40 mg", "VO", "cada 24 horas", 2]],
    evol: [["Dolor 8/10.", "ECG con elevación del ST, troponina elevada.", "IAM con elevación del ST.", "Reperfusión, doble antiagregación, anticoagulación."],
           ["Sin dolor.", "Hemodinámicamente estable.", "Posintervención sin complicaciones.", "Rehabilitación cardiaca."],
           ["Asintomático.", "TA 118/72, FC 68.", "Estable.", "Egreso con terapia médica óptima."]] },
  IC: { cie: "I50.0", servicio: "MEDICINA_INTERNA", via: "URGENCIAS", motivo: "Disnea paroxística nocturna y edema de miembros inferiores",
    enf: [108, 26, 158, 92, 36.7, 90],
    meds: [["MED-014", "40 mg", "IV", "cada 12 horas", 1], ["MED-008", "50 mg", "VO", "cada 24 horas", 6], ["MED-006", "40 mg", "SC", "cada 24 horas", 2]],
    evol: [["Ortopnea de 3 almohadas.", "Ingurgitación yugular, estertores, edema grado III.", "Insuficiencia cardíaca descompensada.", "Diurético IV, restricción hídrica, balance."],
           ["Menos disnea.", "Balance negativo 1.5 L.", "Mejoría de la congestión.", "Continuar diurético."],
           ["Duerme con una almohada.", "Sin edema.", "Compensada.", "Egreso con control por cardiología."]] },
  EDA: { cie: "A09", servicio: "PEDIATRIA", via: "URGENCIAS", motivo: "Vómito y diarrea con deshidratación moderada",
    enf: [138, 30, 94, 58, 38.2, 97],
    meds: [["MED-009", "20 mL/kg en bolo, luego mantenimiento", "IV", "continuo", 0], ["MED-010", "15 mg/kg", "VO", "cada 8 horas si fiebre", 1]],
    evol: [["Seis deposiciones líquidas.", "Mucosas secas, llenado capilar 3 s.", "Deshidratación moderada.", "Rehidratación IV y luego oral."],
           ["Tolera vía oral.", "Hidratado, afebril.", "Mejoría.", "Suspender líquidos IV."],
           ["Sin diarrea.", "Hidratado.", "Resuelto.", "Egreso con suero oral."]] },
  IVU: { cie: "N39.0", servicio: "MEDICINA_INTERNA", via: "URGENCIAS", motivo: "Disuria, fiebre y dolor lumbar",
    enf: [108, 22, 112, 70, 38.9, 97],
    meds: [["MED-001", "1 g", "IV", "cada 24 horas", 2], ["MED-010", "500 mg", "VO", "cada 8 horas si fiebre", 1]],
    evol: [["Disuria y escalofríos.", "Puño percusión positiva, uroanálisis con nitritos.", "Pielonefritis aguda.", "Antibiótico IV, hidratación, urocultivo."],
           ["Afebril 24 h.", "Mejoría del dolor lumbar.", "Respuesta favorable.", "Ajustar antibiótico según urocultivo."],
           ["Asintomática.", "Sin fiebre.", "Resuelta.", "Egreso con antibiótico oral."]] },
  APEND: { cie: "K35.8", servicio: "CIRUGIA", via: "URGENCIAS", motivo: "Dolor abdominal en fosa ilíaca derecha con náuseas",
    enf: [104, 20, 124, 76, 38.1, 98],
    meds: [["MED-013", "1.5 g", "IV", "cada 6 horas", 1], ["MED-010", "500 mg", "VO", "cada 6 horas", 6]],
    evol: [["Dolor 7/10 en fosa ilíaca derecha.", "Blumberg positivo, leucocitosis.", "Apendicitis aguda.", "Apendicectomía laparoscópica."],
           ["Dolor leve en heridas.", "Heridas limpias.", "Posoperatorio sin complicaciones.", "Deambulación, dieta."],
           ["Sin dolor.", "Tolera dieta.", "Recuperado.", "Egreso y control de herida."]] },
  DENGUE: { cie: "A90", servicio: "MEDICINA_INTERNA", via: "URGENCIAS", motivo: "Fiebre alta, cefalea retroocular y mialgias",
    enf: [102, 20, 108, 68, 39.2, 98],
    meds: [["MED-009", "1000 mL", "IV", "cada 8 horas", 1], ["MED-010", "500 mg", "VO", "cada 6 horas si fiebre", 1]],
    evol: [["Fiebre de 4 días.", "Plaquetas 85.000, hematocrito 42 %.", "Dengue sin signos de alarma, grupo B.", "Hidratación, vigilancia de plaquetas, evitar AINE."],
           ["Defervescencia.", "Plaquetas 62.000.", "Fase crítica sin signos de alarma.", "Vigilancia estricta."],
           ["Asintomático.", "Plaquetas 120.000.", "Recuperación.", "Egreso."]] },
  DENGUE_GRAVE: { cie: "A91", servicio: "UCI", via: "REMISION", motivo: "Dengue con dolor abdominal intenso, sangrado de mucosas e hipotensión",
    enf: [128, 28, 84, 52, 37.9, 93],
    meds: [["MED-009", "20 mL/kg en bolo", "IV", "según respuesta", 0], ["MED-010", "500 mg", "VO", "cada 6 horas si fiebre", 1]],
    evol: [["Dolor abdominal, gingivorragia.", "TA 84/52, plaquetas 18.000, hemoconcentración.", "Dengue grave con choque compensado.", "Reanimación con cristaloides, UCI."],
           ["Sin sangrado.", "TA estable, plaquetas 45.000.", "Respuesta a reanimación.", "Reducir líquidos."],
           ["Asintomático.", "Plaquetas 110.000.", "Recuperado.", "Traslado a piso y egreso."]] }
};

// ---------------------------------------------------------------- Hospitalizaciones
// [paciente, perfil, admision, dias (null = activa), opciones]
const HOSP = [
  ["PAC-010", "DENGUE", "2026-07-08T11:20", 4],
  ["PAC-007", "IC", "2026-07-14T07:50", 7],
  ["PAC-008", "BRONQ", "2026-07-20T03:10", 4],
  ["PAC-011", "DENGUE_GRAVE", "2026-07-22T22:40", 6],
  ["PAC-022", "CAD", "2026-07-30T13:05", 4],
  ["PAC-009", "BRONQ", "2026-08-02T05:30", 5],
  ["PAC-007", "IC", "2026-08-05T19:15", 6],                // reingreso a 15 dias
  ["PAC-016", "APEND", "2026-08-09T16:00", 2],
  ["PAC-002", "EPOC", "2026-08-10T08:15", 5],
  ["PAC-012", "DENGUE", "2026-08-15T10:00", 4],
  ["PAC-013", "DENGUE", "2026-08-18T09:30", 5],
  ["PAC-014", "DENGUE_GRAVE", "2026-08-25T01:45", 7],
  ["PAC-002", "EPOC", "2026-08-27T21:30", 6],               // reingreso a 12 dias
  ["PAC-021", "EDA", "2026-08-29T17:40", 3],
  ["PAC-001", "NAC", "2026-09-02T14:30", 5],                // alergia a penicilina + ceftriaxona (betalactamico)
  ["PAC-023", "HTA", "2026-09-09T22:10", 2],
  ["PAC-024", "DENGUE", "2026-09-12T12:00", 4],
  ["PAC-003", "EDA", "2026-09-15T21:00", 3],
  ["PAC-004", "IAM", "2026-09-20T03:40", 6],                // alergia AINEs + ASA (conflicto)
  ["PAC-019", "EPOC", "2026-09-28T06:20", 7],
  ["PAC-005", "APEND", "2026-10-01T19:20", 3],
  ["PAC-018", "NAC", "2026-10-02T10:30", 6],
  ["PAC-015", "IAM", "2026-10-05T04:10", 3, { condicion: "FALLECIDO" }],
  ["PAC-009", "EDA", "2026-10-12T15:00", 3],
  ["PAC-018", "NAC", "2026-10-19T09:00", 5],                // reingreso a 11 dias
  ["PAC-006", "CAD", "2026-10-21T10:00", 5],
  ["PAC-001", "HTA", "2026-10-22T16:45", 4],
  ["PAC-016", "IVU", "2026-10-28T11:30", 3],
  // ---- activas al 8-nov-2026 ----
  ["PAC-022", "NAC", "2026-11-01T18:00", null, { deterioro: [124, 30, 96, 58, 38.9, 88] }],
  ["PAC-020", "DENGUE", "2026-11-02T14:30", null],
  ["PAC-007", "IC", "2026-11-03T06:40", null, { deterioro: [118, 28, 168, 98, 36.9, 89] }],
  ["PAC-002", "EPOC", "2026-11-04T09:15", null],
  ["PAC-006", "IVU", "2026-11-05T20:00", null, { extra: [["MED-015", "160/800 mg", "VO", "cada 12 horas", 30]] }], // alergia a sulfas + TMP/SMX
  ["PAC-017", "APEND", "2026-11-06T22:30", null],
  ["PAC-024", "IVU", "2026-11-07T08:45", null]
];

const MEDICOS = { MEDICINA_INTERNA: ["PRO-001", "PRO-002"], PEDIATRIA: ["PRO-003", "PRO-005"], CIRUGIA: ["PRO-004"], UCI: ["PRO-006"] };
const ENF = ["ENF-001", "ENF-002", "ENF-003"];
// En menores de 15 anos la dosis se calcula por peso (no se usan dosis de adulto)
const DOSIS_PEDIATRICA = { "MED-009": "mantenimiento según peso (Holliday-Segar)", "MED-010": "15 mg/kg" };
const NOMBRE_MED = {}; hce.catalogo_medicamentos.find().forEach(m => NOMBRE_MED[m._id] = m.nombre_generico);
const DESC = {}; hce.catalogo_cie10.find().forEach(c => DESC[c._id] = c.descripcion);
const edad = (nac, f) => Math.floor((f - nac) / (365.25 * 24 * H));
const turno = (f) => { const h = f.getUTCHours(); return h >= 6 && h < 14 ? "MANANA" : h >= 14 && h < 22 ? "TARDE" : "NOCHE"; };
const ocupacion = {};   // cama -> [[ini, fin]]
const libre = (cama, ini, fin) => (ocupacion[cama] || []).every(([a, b]) => fin <= a || ini >= b);

function vitales(desde, hasta, ini, fin, por) {
  const out = [], n = Math.max(2, Math.floor((hasta - desde) / (8 * H)) + 1);
  for (let i = 0; i < n; i++) {
    const t = new Date(desde.getTime() + i * 8 * H), k = n === 1 ? 1 : i / (n - 1), r = (j) => ini[j] + (fin[j] - ini[j]) * k;
    const ruido = (i % 3) - 1;     // -1, 0, 1 deterministico
    out.push({ fecha: t,
      fc: NumberInt(Math.round(r(0) + ruido * 2)), fr: NumberInt(Math.round(r(1))),
      ta_sistolica: NumberInt(Math.round(r(2) + ruido * 3)), ta_diastolica: NumberInt(Math.round(r(3))),
      temperatura: Double(Math.round(r(4) * 10) / 10), spo2: NumberInt(Math.min(99, Math.round(r(5)))),
      registrado_por: ENF[i % 3] });
  }
  return out;
}

const docs = HOSP.map(([pid, perfil, adm, dias, op = {}], idx) => {
  const pf = PERFILES[perfil], fa = D(adm + ":00"), activa = dias === null;
  const pac = PAC[pid], ed = edad(pac.nac, fa);
  // Servicio: los menores de 15 anos van a pediatria salvo UCI/cirugia
  const servicio = (ed < 15 && pf.servicio === "MEDICINA_INTERNA") ? "PEDIATRIA" : pf.servicio;
  const fe = activa ? null : new Date(fa.getTime() + dias * 24 * H + 2 * H);
  const finOcup = activa ? D("2099-01-01") : fe;
  const cama = camas.find(c => c.servicio === servicio && c.estado !== "MANTENIMIENTO" && libre(c._id, fa, finOcup));
  (ocupacion[cama._id] = ocupacion[cama._id] || []).push([fa, finOcup]);
  const _id = "HOSP-2026-" + String(idx + 1).padStart(4, "0");
  if (activa) { cama.estado = "OCUPADA"; cama.hospitalizacion_id = _id; }
  const medico = MEDICOS[servicio][idx % MEDICOS[servicio].length];
  const fin = activa ? AHORA : fe, dur = fin - fa;

  // Diagnosticos
  const dx = [{ cie10: pf.cie, descripcion: DESC[pf.cie], tipo: "INGRESO", fecha: fa },
              { cie10: pf.cie, descripcion: DESC[pf.cie], tipo: "PRINCIPAL", fecha: new Date(fa.getTime() + 3 * H) }];
  if (pac.antecedentes.includes("Diabetes mellitus tipo 2") && pf.cie !== "E11.1")
    dx.push({ cie10: "E11.9", descripcion: DESC["E11.9"], tipo: "RELACIONADO", fecha: new Date(fa.getTime() + 3 * H) });
  if (pac.antecedentes.includes("Hipertensión arterial") && pf.cie !== "I10")
    dx.push({ cie10: "I10", descripcion: DESC["I10"], tipo: "RELACIONADO", fecha: new Date(fa.getTime() + 3 * H) });
  if (!activa) dx.push({ cie10: pf.cie, descripcion: DESC[pf.cie], tipo: "EGRESO", fecha: fe });

  // Evolucion: ingreso, mitad y final (si activa con deterioro, la ultima nota lo registra)
  const tiempos = [3 * H, dur * 0.5, Math.max(dur - 4 * H, 6 * H)];
  const notas = (activa && dur < 30 * H ? tiempos.slice(0, 2) : tiempos).map((dt, i) => {
    let [s, o, a, p] = pf.evol[i];
    if (activa && i === 2) [s, o, a, p] = op.deterioro
      ? ["Refiere más disnea y malestar.", "Empeoramiento de signos vitales en las últimas tomas.", "Deterioro clínico.", "Escalar manejo, valorar traslado a UCI."]
      : ["Evolución estable.", "Signos vitales en mejoría.", "Respuesta adecuada.", "Continuar manejo."];
    return { fecha: new Date(fa.getTime() + dt), profesional_id: medico, subjetivo: s, objetivo: o, analisis: a, plan: p };
  });

  const vit = vitales(new Date(fa.getTime() + H), fin, pf.enf, op.deterioro || NORMAL, null);
  const enfermeria = [0.15, 0.7].map((k, i) => { const f = new Date(fa.getTime() + 2 * H + dur * k);
    return { fecha: f, enfermera_id: ENF[(idx + i) % 3], turno: turno(f),
      nota: i === 0 ? "Ingresa al servicio, se canaliza acceso venoso, se explican derechos y deberes al paciente/acudiente."
                    : "Paciente con vigilancia de signos vitales cada 8 horas, tolera tratamiento." }; });

  const ordenes = pf.meds.concat(op.extra || []).filter((m, i, arr) => arr.findIndex(x => x[0] === m[0]) === i)
    .map(([mid, dosis, via, frec, h]) => ({ medicamento_id: mid, nombre: NOMBRE_MED[mid],
      dosis: ed < 15 ? (DOSIS_PEDIATRICA[mid] || dosis) : dosis, via, frecuencia: frec,
      fecha_inicio: new Date(fa.getTime() + h * H), fecha_fin: activa ? null : fe, prescriptor_id: medico,
      estado: activa ? "ACTIVA" : "FINALIZADA" }));

  const doc = { _id, paciente_id: pid, medico_tratante_id: medico, ips: IPS[servicio], servicio, cama: cama._id,
    fecha_admision: fa, via_ingreso: pf.via, motivo_ingreso: pf.motivo, estado: activa ? "ACTIVA" : "EGRESADA",
    diagnosticos: dx, notas_evolucion: notas, signos_vitales: vit, notas_enfermeria: enfermeria, ordenes_medicamentos: ordenes,
    alta: activa ? null : { fecha: fe, condicion: op.condicion || (servicio === "UCI" ? "ESTABLE" : "MEJORADO"),
      destino: op.condicion === "FALLECIDO" ? "Morgue" : "Domicilio", diagnostico_egreso: pf.cie,
      recomendaciones: op.condicion === "FALLECIDO" ? "Se diligencia certificado de defunción." : "Control ambulatorio y signos de alarma." } };
  return doc;
});

hce.camas.insertMany(camas);
hce.hospitalizaciones.insertMany(docs);

print("Carga completada:");
["catalogo_cie10", "catalogo_medicamentos", "profesionales", "pacientes", "camas", "hospitalizaciones", "auditoria"]
  .forEach(c => print("  " + c.padEnd(24) + hce[c].countDocuments()));
const tot = hce.hospitalizaciones.aggregate([{ $group: { _id: null,
  activas: { $sum: { $cond: [{ $eq: ["$estado", "ACTIVA"] }, 1, 0] } },
  signos: { $sum: { $size: "$signos_vitales" } }, notas: { $sum: { $size: "$notas_evolucion" } },
  ordenes: { $sum: { $size: "$ordenes_medicamentos" } }, dx: { $sum: { $size: "$diagnosticos" } } } }]).toArray()[0];
print(`  -> ${tot.activas} hospitalizaciones activas, ${tot.signos} tomas de signos vitales, ${tot.notas} notas de evolucion, ${tot.ordenes} ordenes, ${tot.dx} diagnosticos`);
print("  -> camas ocupadas: " + hce.camas.countDocuments({ estado: "OCUPADA" }) + " / " + hce.camas.countDocuments());
