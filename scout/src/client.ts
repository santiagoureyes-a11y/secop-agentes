import { ProcesoSchema, type Proceso, type PerfilEmpresa } from "./types.js";

const DATASET_PROCESOS = "p6dx-8zbt";
const BASE_URL = "https://www.datos.gov.co/resource";

// Escapa comillas simples para uso en literales SoQL (la sintaxis de Socrata duplica
// la comilla para escaparla, igual que SQL estándar).
function escaparLiteral(valor: string): string {
  return valor.replace(/'/g, "''");
}

// Fecha YYYY-MM-DD en zona horaria de Colombia, desplazada N días hacia adelante.
function fechaBogota(diasAdelante: number): string {
  const fecha = new Date(Date.now() + diasAdelante * 24 * 60 * 60 * 1000);
  return fecha.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

function buildWhereClause(perfil: PerfilEmpresa): string {
  const condiciones: string[] = [];

  if (perfil.codigosUnspsc.length > 0) {
    // codigo_principal_de_categoria viene con prefijo "V1." antes del código UNSPSC, ej. "V1.81101500".
    const porCodigo = perfil.codigosUnspsc
      .map((codigo) => `starts_with(codigo_principal_de_categoria, 'V1.${escaparLiteral(codigo)}')`)
      .join(" OR ");
    condiciones.push(`(${porCodigo})`);
  }

  if (perfil.departamentos?.length) {
    const porDepartamento = perfil.departamentos
      .map((d) => `departamento_entidad = '${escaparLiteral(d)}'`)
      .join(" OR ");
    condiciones.push(`(${porDepartamento})`);
  }

  if (perfil.precioMinimo !== undefined) {
    condiciones.push(`precio_base >= '${perfil.precioMinimo}'`);
  }

  if (perfil.precioMaximo !== undefined) {
    condiciones.push(`precio_base <= '${perfil.precioMaximo}'`);
  }

  if (perfil.modalidades?.length) {
    const porModalidad = perfil.modalidades
      .map((m) => `modalidad_de_contratacion = '${escaparLiteral(m)}'`)
      .join(" OR ");
    condiciones.push(`(${porModalidad})`);
  }

  if (perfil.palabrasClaveObjeto?.length) {
    // Cada palabra clave debe aparecer (sin importar mayúsculas) en el nombre o la
    // descripción del procedimiento — se usan subcadenas sin tilde para evitar problemas
    // de codificación (ej. "INTERVENTOR" cubre "interventoría"/"interventor").
    const porPalabra = perfil.palabrasClaveObjeto.map((palabra) => {
      const literal = escaparLiteral(palabra.toUpperCase());
      return `(upper(nombre_del_procedimiento) like '%${literal}%' OR upper(descripci_n_del_procedimiento) like '%${literal}%')`;
    });
    condiciones.push(...porPalabra);
  }

  if (perfil.palabraClaveObligatoria) {
    const literal = escaparLiteral(perfil.palabraClaveObligatoria.toUpperCase());
    condiciones.push(
      `(upper(nombre_del_procedimiento) like '%${literal}%' OR upper(descripci_n_del_procedimiento) like '%${literal}%')`
    );
  }

  if (perfil.palabrasClaveAlguna?.length) {
    const porPalabra = perfil.palabrasClaveAlguna
      .map((palabra) => {
        const literal = escaparLiteral(palabra.toUpperCase());
        return `(upper(nombre_del_procedimiento) like '%${literal}%' OR upper(descripci_n_del_procedimiento) like '%${literal}%')`;
      })
      .join(" OR ");
    condiciones.push(`(${porPalabra})`);
  }

  if (perfil.diasPublicacionMax !== undefined) {
    const desde = new Date(Date.now() - perfil.diasPublicacionMax * 24 * 60 * 60 * 1000);
    condiciones.push(`fecha_de_publicacion_del >= '${desde.toISOString().slice(0, 10)}'`);
  }

  if (perfil.soloVigentes !== false) {
    // Excluye procesos ya adjudicados o cuyo plazo de recepción de ofertas ya pasó —
    // sin esto, el Scout puede traer procesos donde ya no se puede participar.
    // La fecha se calcula en zona horaria de Bogotá (las fechas del dataset son locales
    // de Colombia; toISOString() daría el día siguiente después de las 7 p. m.).
    const margenDias = perfil.diasMinimosAntesCierre ?? 0;
    const minCierre = fechaBogota(margenDias > 0 ? margenDias + 1 : 0);
    condiciones.push(`adjudicado = 'No'`);
    condiciones.push(`fecha_de_recepcion_de >= '${minCierre}'`);
  }

  return condiciones.join(" AND ");
}

export interface BuscarProcesosOpciones {
  limite?: number;
  appToken?: string;
}

// Consulta el dataset público "SECOP II - Procesos de Contratación" vía API SODA.
// No requiere login ni resuelve captcha: es la capa autónoma del Agente Scout.
export async function buscarProcesos(
  perfil: PerfilEmpresa,
  opciones: BuscarProcesosOpciones = {}
): Promise<Proceso[]> {
  const where = buildWhereClause(perfil);
  const params = new URLSearchParams({
    $limit: String(opciones.limite ?? 100),
    $order: "fecha_de_publicacion_del DESC",
  });
  if (where) params.set("$where", where);

  const headers: Record<string, string> = {};
  if (opciones.appToken) headers["X-App-Token"] = opciones.appToken;

  const url = `${BASE_URL}/${DATASET_PROCESOS}.json?${params.toString()}`;
  const res = await fetch(url, { headers });

  if (!res.ok) {
    throw new Error(`SECOP Datos Abiertos respondió ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return ProcesoSchema.array().parse(data);
}
