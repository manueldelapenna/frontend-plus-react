// src/App.tsx
import React from 'react'; // Ya no necesitas useEffect en este archivo, se mueve al handler
import './App.css';
import LoginPage from './pages/LoginPage';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'; // Quita Navigate de aquí si no la usas en rutas directas
import MainLayout from './components/MainLayout';
import SessionExpiredMessage from './components/SessionExpiredMessage';
import { AppProvider, useApp } from './contexts/AppContext';
import GenericDataGrid from './components/GenericDataGrid';
import HomePage from './pages/HomePage';
import LogoutPage from './pages/LogoutPage';
import ProcedureForm from './components/ProcedureForm';

// --- Importaciones de Redux y Redux Persist ---
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store';

// --- ¡Importa el nuevo componente! ---
import InitialRedirectHandler from './components/InitialRedirectHandler'; 

// Aquí no necesitas useDispatch, AppDispatch, setCurrentPath, useCurrentPath porque InitialRedirectHandler los usa
// function App() {} // Elimina estos imports si ya no los usas en App.tsx directamente


function App() {
    const { isLoggedIn } = useApp();
    // Las siguientes líneas ya no son necesarias aquí, las movimos a InitialRedirectHandler
    // const location = useLocation(); 
    // const dispatch = useDispatch<AppDispatch>();
    // const persistedPath = useCurrentPath();

    // El useEffect que despachaba la URL aquí, también se mueve a InitialRedirectHandler
    // useEffect(() => { /* ... */ }, [...]);

    return (
        <Routes>
            {/* Ruta del login, si está logueado, la lógica de InitialRedirectHandler se encargará */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/logout" element={<LogoutPage />} /> 

            {/* Rutas de entrada para usuarios logueados o no */}
            {/* Si NO está logueado, siempre va a LoginPage */}
            {/* Si SÍ está logueado, usa InitialRedirectHandler para decidir a dónde ir */}
            <Route 
                path="/" 
                element={isLoggedIn ? <InitialRedirectHandler /> : <LoginPage />}
            />
            {/* Ruta por defecto para cualquier otra URL no encontrada */}
            <Route 
                path="*" 
                element={isLoggedIn ? <InitialRedirectHandler /> : <LoginPage />}
            />

            {/* Rutas Protegidas que requieren MainLayout */}
            {/* Si isLoggedIn es false, se activará la ruta '*' o '/' de arriba y redirigirá a LoginPage */}
            <Route 
                path="/home" 
                element={isLoggedIn ? <MainLayout><HomePage /></MainLayout> : <LoginPage />}
            />
            <Route 
                path="/table/:tableName" 
                element={isLoggedIn ? <MainLayout><GenericDataGrid /></MainLayout> : <LoginPage />}
            />
            <Route 
                path="/procedures/:procedureName" 
                element={isLoggedIn ? <MainLayout><ProcedureForm /></MainLayout> : <LoginPage />}
            />
        </Routes>
    );
}

const RootApp = () => {
    return (
        <Provider store={store}>
            <PersistGate loading={null} persistor={persistor}>
                <BrowserRouter>
                    <AppProvider>
                        <App/>
                        <SessionExpiredMessage />
                    </AppProvider>
                </BrowserRouter>
            </PersistGate>
        </Provider>
    );
}

export default RootApp;