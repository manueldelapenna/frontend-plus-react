import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react'; // ¡Asegúrate de importar useMemo!
import { fetchApi } from '../utils/fetchApi';
import { useNavigate } from 'react-router-dom';
import { MenuInfoBase, ProcedureDef, AppConfigClientSetup } from "backend-plus";
import { Details } from 'express-useragent';

// Define la interfaz para el contexto de autenticación
interface AppContextType {
    isLoggedIn: boolean;
    setIsLoggedIn: (loggedIn: boolean) => void;
    checkSession: () => Promise<void>;
    showSessionExpiredMessage: boolean;
    setShowSessionExpiredMessage: (show: boolean) => void;
    clientContext: ClientContext | null;
    setClientContext: (data: ClientContext | null) => void;
}

// Crea el contexto con un valor por defecto que se sobrescribirá
const AuthContext = createContext<AppContextType | undefined>(undefined);

// Hook personalizado para usar el contexto de autenticación
export const useApp = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useApp must be used within an AppProvider ');
    }
    return context;
};

// Componente proveedor de autenticación
interface AppProviderProps {
    children: ReactNode;
}

export interface ClientContext {
    menu: MenuInfoBase[],
    procedure: {[key:string]:ProcedureDef},
    procedures: ProcedureDef[],
    config:AppConfigClientSetup,
    useragent:Details,
    username: string,
}

export const loadClientContextData = async (): Promise<ClientContext> => {
    const setupResponse = await fetchApi('/client-setup', {method: 'GET'});
    if (!setupResponse.ok) { // <-- Corrección: verificar si setupResponse es ok
        const errorData = await setupResponse.text();
        throw new Error(errorData || 'Error al obtener configuración del cliente');
    }
    const clientSetup = await setupResponse.json();

    const newClientContext: ClientContext = {
        ...clientSetup,
    };
    return newClientContext;
};


export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
    console.log("AppProvider rendered/re-rendered"); // Este log debería aparecer mucho menos ahora

    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [showSessionExpiredMessage, setShowSessionExpiredMessage] = useState(false);
    const [clientContext, setClientContext] = useState<ClientContext | null>(null);
    const navigate = useNavigate();

    // Memoizamos checkSession para que no se recree a cada render,
    // es crucial para que useEffect no se dispare innecesariamente.
    const checkSession = useCallback(async () => {
        try {
            const response = await fetchApi('/keep-alive.json', {method:'GET'});
            if (response.ok) {
                setIsLoggedIn(true);
                setShowSessionExpiredMessage(false);
                if (clientContext === null) {
                    console.log("Client context is null, attempting to load all client context data...");
                    try {
                        const loadedContext = await loadClientContextData();
                        setClientContext(loadedContext);
                        console.log("Client context data loaded successfully.");
                    } catch (loadError: any) { // Especificar tipo 'any' para 'loadError'
                        console.error("Error loading client context data during session check:", loadError);
                        throw loadError;
                    }
                }
            } else {
                setIsLoggedIn(false);
                setClientContext(null);
                if (!showSessionExpiredMessage && window.location.pathname !== '/login') {
                    setShowSessionExpiredMessage(true);
                }
            }
        } catch (error: any) { // Especificar tipo 'any' para 'error'
            console.error("Error checking session:", error);
            setIsLoggedIn(false);
            setClientContext(null);
            if (!showSessionExpiredMessage && window.location.pathname !== '/login') {
                setShowSessionExpiredMessage(true);
            }
        }
    }, [navigate, showSessionExpiredMessage, setIsLoggedIn, setShowSessionExpiredMessage, clientContext]); // Dependencias de useCallback

    useEffect(() => {
        checkSession();

        const intervalId = setInterval(checkSession, 15 * 1000);

        return () => {
            clearInterval(intervalId);
        };
    }, [checkSession]); // Se ejecuta una vez al montar

    // ¡La CLAVE! Memoizamos el objeto de contexto
    const authContextValue = useMemo(() => ({
        isLoggedIn,
        setIsLoggedIn,
        checkSession, // checkSession está memoizado con useCallback
        showSessionExpiredMessage,
        setShowSessionExpiredMessage,
        clientContext,
        setClientContext
    }), [
        isLoggedIn,
        setIsLoggedIn, // Las funciones set (setState) son estables y no necesitan useCallback
        checkSession,
        showSessionExpiredMessage,
        setShowSessionExpiredMessage, // Las funciones set (setState) son estables
        clientContext,
        setClientContext // Las funciones set (setState) son estables
    ]);

    return (
        <AuthContext.Provider value={authContextValue}>
            {children}
        </AuthContext.Provider>
    );
};