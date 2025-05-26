// src/hooks/useLogout.ts
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext'; // Para acceder a las funciones del contexto
import { fetchApi } from '../utils/fetchApi'; // Para la llamada a la API

/**
 * Hook personalizado para manejar la lógica de cierre de sesión.
 * Limpia el estado del frontend y realiza la petición al backend.
 * @returns Una función 'logout' que, al ser llamada, cierra la sesión.
 */
const useLogout = () => {
    // Obtenemos las funciones del contexto de la aplicación
    const { setIsLoggedIn, setClientContext } = useApp();
    // Obtenemos la función de navegación de React Router
    const navigate = useNavigate();

    // Utilizamos useCallback para memoizar la función 'logout'
    // Esto asegura que la función no cambie en cada render y mejora el rendimiento
    const logout = useCallback(async () => {
        try {
            const response = await fetchApi('/logout', { method: 'GET' }); // Asumiendo que tienes un endpoint /logout
                if (response.status == 401) {
                    console.log('deslogueado')
                } else {
                    console.error('Error al cerrar sesión:', await response.text());
                }
            } catch (error) {
                console.error('Error de red al intentar cerrar sesión:', error);
            } finally{
                setIsLoggedIn(false);         // Actualiza el estado de login en el contexto
                setClientContext(null);       // Limpia el contexto del cliente al desloguear
                navigate('/login', { replace: true }); // Redirige a /login
            }
    }, [setIsLoggedIn, setClientContext, navigate]); // Dependencias: la función 'logout' se recreará si estas cambian

    return logout; // Devolvemos la función 'logout' para que pueda ser usada en otros componentes
};

export default useLogout;