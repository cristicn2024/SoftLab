export function respuestaDeError(estado: number, error: string, mensaje: string | string[], ruta: string) {
  return {
    error: {
      statusCode: estado,
      tipo: error,
      mensaje,
    },
    meta: {
      ruta,
      timestamp: new Date().toISOString(),
    },
  };
}
