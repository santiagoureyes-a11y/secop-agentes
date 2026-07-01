export interface EmpresaSesion {
  // Coincide con el sufijo de las variables SECOP_<NOMBRE_ENV>_USER/_PASS en .env.
  nombreEnv: string;
  // NIT de la empresa, usado para ubicar ~/secop-documentos/<nit>/.
  nit: string;
}
