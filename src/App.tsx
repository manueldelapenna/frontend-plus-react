import React, { useEffect } from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import SessionExpiredMessage from './components/SessionExpiredMessage';
import { AppProvider } from './contexts/AppContext';
import HomePage from './pages/HomePage';
import LogoutPage from './pages/LogoutPage';
import LoginPage from './pages/LoginPage';
import ProcedureForm from './components/ProcedureForm';

import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store';

import PrivateRoute from './components/PrivateRoute';
import InitialRedirectHandler from './components/InitialRedirectHandler';
import { useAppDispatch } from './store';
import { setCurrentPath } from './store/routerSlice';

import { SnackbarProvider } from './contexts/SnackbarContext';
import GenericDataGridPage from './pages/GenericDataGridPage';
import MenuTablePage from './pages/MenuTablePage';

// *** NUEVAS IMPORTACIONES PARA WSCREENS (Asegúrate de que la ruta sea correcta) ***
import { wScreens, WScreenProps } from './pages/WScreens'; // Importa el mapeo de wScreens
import FallbackWScreen from './pages/WScreens'; // Importa el componente de fallback explícitamente


const LocationTracker: React.FC = () => {
    const location = useLocation();
    const dispatch = useAppDispatch();
    useEffect(() => {
        dispatch(setCurrentPath(location.pathname + location.search));
    }, [location, dispatch]);
    return null;
};

export function FrontendPlusReactRoutes() {
    console.log("¡El componente App se está renderizando!");

    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/logout" element={<LogoutPage />} />

            <Route element={
                <PrivateRoute>
                    <InitialRedirectHandler />
                    <MainLayout />
                </PrivateRoute>
            }>
                <Route path="/" element={<HomePage />} />
                <Route path="/home" element={<HomePage />} />
                <Route path="/table/:tableName" element={<GenericDataGridPage />} />
                <Route path="/menu/:menuName" element={<MenuTablePage  />} />
                <Route path="/procedures/:procedureName" element={<ProcedureForm />} />
                {Object.keys(wScreens).map((screenName) => (
                    <Route
                        key={screenName}
                        path={`/wScreens/${screenName}`}
                        element={React.createElement(wScreens[screenName], { screenName } as WScreenProps)}
                    />
                ))}
                <Route
                    path="/wScreens-fallback/:screenName"
                    element={<FallbackWScreen screenName=":screenName" />}
                />
                <Route path="*" element={<div style={{ marginTop: '20px', marginLeft: "10px" }}>404 - Recurso No Encontrado</div>} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

const App = () => {
    return (
        <Provider store={store}>
            <PersistGate loading={null} persistor={persistor}>
                <BrowserRouter>
                    <LocationTracker />
                    <AppProvider>
                        <SnackbarProvider>
                            <FrontendPlusReactRoutes />
                            <SessionExpiredMessage />
                        </SnackbarProvider>
                    </AppProvider>
                </BrowserRouter>
            </PersistGate>
        </Provider>
    );
}

export default App;