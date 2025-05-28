// src/App.tsx
import React from 'react';
import './App.css'; // Asegúrate de tener este CSS si lo usas
import LoginPage from './pages/LoginPage';
import { BrowserRouter , Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/MainLayout'; // Necesitarás este componente
import SessionExpiredMessage from './components/SessionExpiredMessage';
import { AppProvider , useApp } from './contexts/AppContext';
import GenericDataGrid from './components/GenericDataGrid';
import HomePage from './pages/HomePage'; // Importa HomePage si la quieres como ruta principal
import LogoutPage from './pages/LogoutPage';
import ProcedureForm from './components/ProcedureForm';

function App() {
    const { isLoggedIn } = useApp(); // Obtiene el estado de login del contexto
    return (
        <Routes>
            <Route path="/login" element={isLoggedIn ? <Navigate to="/home" replace /> : <LoginPage />}/>
            <Route path="/logout" element={<LogoutPage />} /> 
            <Route path="/" element={isLoggedIn ? <Navigate to="/home" replace /> : <LoginPage />}/>
            {/* Ruta principal autenticada: si no está logueado, redirige a /login */}
            {/* Si quieres una HomePage como la inicial, úsala aquí */}
            <Route path="/home" element={isLoggedIn ? <MainLayout><HomePage /></MainLayout> : <Navigate to="/login" replace />}/>
            {/* Rutas protegidas para tablas y procedimientos, dentro de MainLayout */} 
            <Route path="/table/:tableName" element={isLoggedIn ? <MainLayout><GenericDataGrid /></MainLayout> : <Navigate to="/login" replace />}/>
            <Route path="/procedures/:procedureName" element={isLoggedIn ? <MainLayout><ProcedureForm/></MainLayout> : <Navigate to="/login" replace />}/>
            
            {/* Ruta por defecto para cualquier otra URL: redirige a la ruta principal si logueado, a /login si no */}
            <Route path="*" element={isLoggedIn ? <Navigate to="/" replace /> : <Navigate to="/login" replace />}/>
        </Routes>
    );
}

// El componente principal que envuelve toda la aplicación con el Router y el AppProvider 
const RootApp = () => {
    return (
        <BrowserRouter>
            <AppProvider >
                <App/> {/* Aquí se monta tu componente App con las Routes */}
                <SessionExpiredMessage /> {/* Mensajes de sesión expirada flotantes */}
            </AppProvider >
        </BrowserRouter>
    );
}

export default RootApp;