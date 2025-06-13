// src/App.tsx
import React, { useEffect } from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import MainLayout from './components/MainLayout'; // Asegúrate de que MainLayout tiene <Outlet />
import SessionExpiredMessage from './components/SessionExpiredMessage';
import { AppProvider } from './contexts/AppContext'; 
import GenericDataGrid from './components/grid/GenericDataGrid';
import HomePage from './pages/HomePage';
import LogoutPage from './pages/LogoutPage';
import LoginPage from './pages/LoginPage';
import ProcedureForm from './components/ProcedureForm';

// --- Redux y Redux Persist ---
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store';

// --- Componentes de control de rutas ---
import PrivateRoute from './components/PrivateRoute';
import InitialRedirectHandler from './components/InitialRedirectHandler';
import { useAppDispatch } from './store';
import { setCurrentPath } from './store/routerSlice';

import { SnackbarProvider } from './contexts/SnackbarContext';


// LocationTracker (sin cambios)
const LocationTracker: React.FC = () => {
    const location = useLocation();
    const dispatch = useAppDispatch();
    useEffect(() => {
        dispatch(setCurrentPath(location.pathname + location.search));
    }, [location, dispatch]);
    return null;
};

function App() {
    console.log("¡El componente App se está renderizando!"); // Mantén este log

    return (
        <Routes>
            {/* Rutas Públicas */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/logout" element={<LogoutPage />} />

            {/*
                Grupo de Rutas Protegidas:
                Este es un Route padre que usa PrivateRoute como su guardián.
                Si PrivateRoute permite el acceso, renderizará a sus hijos.
                Sus hijos son InitialRedirectHandler y MainLayout.
                MainLayout a su vez contendrá un <Outlet /> para renderizar sus rutas anidadas.
            */}
            <Route element={
                        <PrivateRoute>
                            <InitialRedirectHandler /> {/* Se ejecuta si estás autenticado */}
                            {/* MainLayout es un componente que ya renderiza <Outlet /> */}
                            {/* Las rutas anidadas de abajo se renderizarán *dentro* del <Outlet /> de MainLayout */}
                            <MainLayout />
                        </PrivateRoute>
                    }>
                {/* Estas son las rutas específicas que aparecerán dentro de MainLayout y están protegidas */}
                <Route path="/" element={<HomePage />} />
                <Route path="/home" element={<HomePage />} />
                <Route path="/table/:tableName" element={<GenericDataGrid />} />
                <Route path="/procedures/:procedureName" element={<ProcedureForm />} />
                
                {/* Ruta 404 para URLs dentro del área protegida que no coinciden */}
                <Route path="*" element={<div style={{marginTop:'20px', marginLeft:"10px"}}>404 - Recurso No Encontrado</div>} />
            </Route>

            {/* Fallback General: Redirige cualquier URL no coincidente a la raíz, donde el área protegida tomará el control */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

const RootApp = () => {
    return (
        <Provider store={store}>
            <PersistGate loading={null} persistor={persistor}>
                <BrowserRouter>
                    <LocationTracker />
                    <AppProvider> 
                        <SnackbarProvider>
                            <App/>
                            <SessionExpiredMessage />
                        </SnackbarProvider>
                    </AppProvider>
                </BrowserRouter>
            </PersistGate>
        </Provider>
    );
}

export default RootApp;