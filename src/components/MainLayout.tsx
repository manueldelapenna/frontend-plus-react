import React, { ReactNode } from 'react';
import { Box, AppBar, Toolbar, Typography, Button, Drawer, CssBaseline,
    IconButton  } from '@mui/material';
import { useApp } from '../contexts/AppContext'; // Importa useApp para el botón de logout en el layout
import { useNavigate } from 'react-router-dom';
import LogoutIcon from '@mui/icons-material/Logout'; // Para el inicio
import { fetchApi } from '../utils/fetchApi';
import SideMenu from './SideMenu'; // Asegúrate de que la ruta sea correcta
import useLogout from '../hooks/useLogout'; // <-- ¡Añade esta línea!


interface MainLayoutProps {
    children: ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const { clientContext, setIsLoggedIn, setClientContext } = useApp(); // Obtener setIsLoggedIn y setClientContext
    const logout = useLogout();
    
    if (!clientContext) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Typography>Cargando diseño de la aplicación...</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'flex' }}>
            <CssBaseline />
            <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
                <Toolbar>
                    <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}> {/* flexGrow: 1 empuja el resto a la derecha */}
                        {clientContext.clientSetup?.appName || 'Mi Aplicación'}
                    </Typography>
                    
                    {/* Botón de Logout */}
                    {/* Puedes usar Button para un texto visible o IconButton para solo el icono */}
                    <Button
                        color="inherit" // Hereda el color del AppBar (blanco para AppBar oscuro)
                        onClick={logout}
                        startIcon={<LogoutIcon />} // Icono al inicio del texto
                    >
                        Salir
                    </Button>
                    
                    {/* O si prefieres solo el icono */}
                    {/*
                    <IconButton
                        color="inherit"
                        aria-label="logout"
                        onClick={handleLogout}
                    >
                        <LogoutIcon />
                    </IconButton>
                    */}

                </Toolbar>
            </AppBar>
            <Drawer
                variant="permanent"
                sx={{
                    width: 240,
                    flexShrink: 0,
                    [`& .MuiDrawer-paper`]: { width: 240, boxSizing: 'border-box' },
                }}
            >
                <Toolbar />
                <SideMenu />
            </Drawer>
            <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
                <Toolbar />
                {children}
            </Box>
        </Box>
    );
};

export default MainLayout;