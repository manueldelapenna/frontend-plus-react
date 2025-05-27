// src/components/MainLayout.tsx
import React, { ReactNode, useState } from 'react';
import {
    Box, AppBar, Toolbar, Typography, Button, Drawer, CssBaseline,
    IconButton, useTheme, useMediaQuery // <-- Importa useTheme y useMediaQuery
} from '@mui/material';
import { useApp } from '../contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import SideMenu from './SideMenu';
import useLogout from '../hooks/useLogout';

const drawerWidth = 240;

interface MainLayoutProps {
    children: ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const { clientContext } = useApp();
    const logout = useLogout();
    const [open, setOpen] = useState(false);

    // Obtener el tema de Material-UI
    const theme = useTheme();
    // Usar useMediaQuery para determinar el tamaño de la pantalla (xs, sm, md, etc.)
    // Esto nos permite acceder a la altura de la AppBar en diferentes breakpoints
    const isMobile = useMediaQuery(theme.breakpoints.down('sm')); // Por ejemplo, considera 'sm' como el punto de corte móvil

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
                            ...(open && { display: 'none' }),
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
                variant="persistent"
                anchor="left"
                open={open}
                sx={{
                    width: drawerWidth,
                    flexShrink: 0,
                    '& .MuiDrawer-paper': {
                        width: drawerWidth,
                        boxSizing: 'border-box',
                        overflowX: 'hidden',
                        overflowY: 'auto', // Mantener scroll vertical
                    },
                }}
            >
                {/* --- Ajuste aquí para alinear el botón de cerrar --- */}
                <Toolbar
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        px: 1,
                        // Usa la altura de la Toolbar del AppBar directamente desde el tema
                        minHeight: theme.mixins.toolbar.minHeight, // Altura base
                        // Si quieres una altura diferente para móviles (ej. AppBar más pequeña), puedes ajustarlo aquí
                        // minHeight: {
                        //     xs: theme.mixins.toolbar.minHeight, // Altura para extra-small
                        //     sm: theme.mixins.toolbar.minHeight, // Altura para small
                        // },
                        // O usar la función de breakpoints directamente:
                        // minHeight: isMobile ? 56 : 64, // Ejemplo: 56px para móviles, 64px para escritorio
                    }}
                >
                    <IconButton onClick={handleDrawerClose}>
                        <ChevronLeftIcon />
                    </IconButton>
                </Toolbar>
                <SideMenu/>
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
                    marginLeft: `-${drawerWidth}px`,
                    ...(open && {
                        transition: (theme) => theme.transitions.create('margin', {
                            easing: theme.transitions.easing.easeOut,
                            duration: theme.transitions.duration.enteringScreen,
                        }),
                        marginLeft: 0,
                    }),
                    width: '100%',
                }}
            >
                <Toolbar />
                {children}
            </Box>
        </Box>
    );
};

export default MainLayout;