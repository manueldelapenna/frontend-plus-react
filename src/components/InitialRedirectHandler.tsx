import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';

// Importa los hooks y acciones de Redux
import { AppDispatch, useCurrentPath } from '../store';
import { setCurrentPath } from '../store/routerSlice'; 

// Importa el contexto de la aplicación para el estado de login
import { useApp } from '../contexts/AppContext';

/**
 * Componente auxiliar para manejar la redirección inicial de usuarios logueados.
 * Decide si redirigir a la última URL visitada persistida o a la página de inicio por defecto.
 * Este componente no renderiza nada visible, solo la lógica de navegación.
 */
const InitialRedirectHandler: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation(); // Para obtener la URL actual del navegador
    const dispatch = useDispatch<AppDispatch>(); // Para despachar acciones de Redux

    const persistedPath = useCurrentPath(); // Obtiene la última URL guardada de Redux
    const { isLoggedIn } = useApp(); // Obtiene el estado de login desde AppContext

    // Efecto para actualizar la URL en Redux con la URL actual del navegador
    // Se ejecuta cada vez que la URL del navegador cambia.
    useEffect(() => {
        const fullPath = location.pathname + location.search + location.hash;
        dispatch(setCurrentPath(fullPath));
        console.log(`[InitialRedirectHandler useEffect - Guardar URL] Despachando setCurrentPath con: ${fullPath}`);
    }, [location.pathname, location.search, location.hash, dispatch]);

    // Efecto principal para la redirección inicial post-carga
    // Se ejecuta cuando el estado de login o la ruta persistida cambian.
    useEffect(() => {
        // Solo procedemos si el usuario está logueado
        if (isLoggedIn) {
            const currentBrowserPath = location.pathname;

            // Lógica para decidir a dónde redirigir:
            // 1. Si hay una 'persistedPath' válida (no es /login o /)
            // 2. Y es diferente de la URL actual del navegador
            // -> Redirigir a la 'persistedPath'.
            // En cualquier otro caso (no hay persistida, es /login o /, etc.):
            // -> Redirigir a /home (la página de inicio por defecto).
            if (
                persistedPath && // Asegura que haya una ruta persistida
                persistedPath !== '/login' && // No redirigir si la guardada es /login
                persistedPath !== '/' && // No redirigir si la guardada es /
                persistedPath !== currentBrowserPath // Evitar redirigir a la misma URL
            ) {
                console.log(`[InitialRedirectHandler useEffect - Redireccionar] Redirigiendo a la URL persistida: ${persistedPath}`);
                navigate(persistedPath, { replace: true });
            } else {
                console.log(`[InitialRedirectHandler useEffect - Redireccionar] Redirigiendo a /home (ruta por defecto).`);
                navigate('/home', { replace: true });
            }
        }
    }, [isLoggedIn, persistedPath, location.pathname, navigate]);

    // Este componente no renderiza nada visible, solo maneja la lógica de navegación.
    return null;
};

export default InitialRedirectHandler;