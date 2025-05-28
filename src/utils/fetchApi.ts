interface FetchApiOptions extends RequestInit {
  // Puedes extender RequestInit para añadir opciones específicas si es necesario
  // Por ejemplo, si siempre envías JSON, podrías tener:
  // body?: Record<string, any>; // Para que el cuerpo sea un objeto que se stringify
}

/**
 * Función genérica para realizar peticiones a la API.
 * Configurada para enviar cookies por defecto.
 *
 * @param endPoint La URL a la que se realizará la petición.
 * @param options Opciones de la petición fetch (método, headers, body, etc.).
 * @returns La respuesta de la petición.
 * @throws Error si la petición no es exitosa (response.ok es false).
 */
export async function fetchApi(endPoint: string, options: FetchApiOptions): Promise<Response> {
const {REACT_APP_BACKEND_URL} = process.env;
    const defaultHeaders = {
        'Content-Type': 'application/x-www-form-urlencoded',
    };
    const config: RequestInit = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options?.headers,
        },
        credentials: 'include',
    };
    if (config.method === 'GET' || config.method === 'HEAD') {
        delete config.body;
    }
    return await fetch(REACT_APP_BACKEND_URL+endPoint, config);
}
