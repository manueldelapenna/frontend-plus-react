// src/components/MainLayout.tsx
import React, { ReactNode, useState } from 'react'; // Importa useState
import {
    Box, AppBar, Toolbar, Typography, Button, Drawer, CssBaseline,
    IconButton
} from '@mui/material';
import { useApp } from '../contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu'; // Importa el icono de menú
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'; // Importa el icono para cerrar
import SideMenu from './SideMenu';
import useLogout from '../hooks/useLogout';

// Define el ancho del drawer
const drawerWidth = 240; // Puedes ajustar este valor

interface MainLayoutProps {
    children: ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const { clientContext } = useApp();
    const logout = useLogout();
    const [open, setOpen] = useState(false);

    const handleDrawerOpen = () => {
        setOpen(true);
    };

    const handleDrawerClose = () => {
        setOpen(false);
    };

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
            <AppBar
                position="fixed"
                sx={{
                    zIndex: (theme) => theme.zIndex.drawer + 1,
                    transition: (theme) => theme.transitions.create(['width', 'margin'], {
                        easing: theme.transitions.easing.sharp,
                        duration: theme.transitions.duration.leavingScreen,
                    }),
                    ...(open && {
                        // Si el drawer está abierto, ajusta el ancho del AppBar
                        width: `calc(100% - ${drawerWidth}px)`,
                        marginLeft: `${drawerWidth}px`,
                        transition: (theme) => theme.transitions.create(['width', 'margin'], {
                            easing: theme.transitions.easing.easeOut,
                            duration: theme.transitions.duration.enteringScreen,
                        }),
                    }),
                }}
            >
                <Toolbar>
                    <IconButton
                        color="inherit"
                        aria-label="open drawer"
                        onClick={handleDrawerOpen}
                        edge="start"
                        sx={{
                            marginRight: 5,
                            ...(open && { display: 'none' }), // Oculta el icono de menú si el drawer está abierto
                        }}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
                        {'Mi Aplicación'}
                    </Typography>
                    <Typography variant="subtitle1" component="div" sx={{ mr: 2 }}>
                        {clientContext.username}
                    </Typography>
                    <Button
                        color="inherit"
                        onClick={logout}
                        startIcon={<LogoutIcon />}
                    >
                        Salir
                    </Button>
                </Toolbar>
            </AppBar>
            <Drawer
                variant="persistent" // Para que empuje el contenido
                anchor="left"
                open={open}
                sx={{
                    width: drawerWidth,
                    flexShrink: 0,
                    '& .MuiDrawer-paper': {
                        width: drawerWidth,
                        boxSizing: 'border-box',
                        overflowX: 'hidden', // Evita scroll horizontal
                        overflowY: 'auto', // Permite scroll vertical interno si el contenido es largo
                    },
                }}
            >
               <Toolbar sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    px: 1,
                    minHeight: '64px', // Alinea con el AppBar
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', px: 1 }}>
                        <IconButton onClick={handleDrawerClose}>
                            <ChevronLeftIcon />
                        </IconButton>
                    </Box>
                </Toolbar>
                {/* Aquí renderizas tu SideMenu */}
                <SideMenu onMenuItemClick={handleDrawerClose} /> {/* Pasa la función para cerrar el menú */}
            </Drawer>
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 3,
                    transition: (theme) => theme.transitions.create('margin', {
                        easing: theme.transitions.easing.sharp,
                        duration: theme.transitions.duration.leavingScreen,
                    }),
                    marginLeft: `-${drawerWidth}px`, // El menú se superpone si está cerrado
                    ...(open && {
                        transition: (theme) => theme.transitions.create('margin', {
                            easing: theme.transitions.easing.easeOut,
                            duration: theme.transitions.duration.enteringScreen,
                        }),
                        marginLeft: 0, // Mueve el contenido para que el menú esté visible
                    }),
                    width: '100%', // Asegura que el contenido ocupe el ancho completo cuando se "contrae"
                }}
            >
                <Toolbar /> {/* Para empujar el contenido principal debajo del AppBar */}
                {children}
            </Box>
        </Box>
    );
};

export default MainLayout;