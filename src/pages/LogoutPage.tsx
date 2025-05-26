// src/pages/LogoutPage.tsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext'; // Para acceder a setIsLoggedIn y setClientContext
import { fetchApi } from '../utils/fetchApi'; // Para la llamada a la API de logout
import { Box, Typography, CircularProgress } from '@mui/material'; // Para un feedback visual
import useLogout from '../hooks/useLogout'; // <-- ¡Añade esta línea!

const LogoutPage: React.FC = () => {
    const { setIsLoggedIn, setClientContext } = useApp();
    const navigate = useNavigate();

    const logout = useLogout(); // <-- ¡Añade esta línea!

    useEffect(() => {
        // Llama a la función de logout del hook cuando el componente se monta
        logout();
    }, [logout]); // Dependencia: la función 'logout' en sí misma

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            textAlign: 'center'
        }}>
            <CircularProgress size={60} />
            <Typography variant="h6" sx={{ mt: 2 }}>Cerrando sesión...</Typography>
        </Box>
    );
};

export default LogoutPage;