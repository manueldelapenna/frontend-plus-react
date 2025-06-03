// src/components/MainLayout.tsx
import React, { ReactNode, useState } from 'react';
import {
    Box, AppBar, Toolbar, Typography, Button, Drawer, CssBaseline,
    IconButton, useTheme, useMediaQuery
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

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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

    // Calcular la altura de la AppBar dinámicamente para el offset del contenido
    const appBarOffset = theme.mixins.toolbar;

    return (
        // El Box raíz ocupa el 100% del alto del viewport y usa flex para su contenido
        <Box sx={{ display: 'flex', height: '100vh' }}>
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
                        onClick={open ? handleDrawerClose : handleDrawerOpen}
                        edge="start"
                        sx={{
                            marginRight: 2.2,
                        }}
                    >
                        {open ? <ChevronLeftIcon /> : <MenuIcon />}
                    </IconButton>
                    <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
                        {open ? '' : clientContext.config.title}
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
                        overflowY: 'auto',
                    },
                }}
            >
                <Toolbar
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        px: 1,
                        fontSize: '1.3rem',
                        minHeight: theme.mixins.toolbar.minHeight,
                    }}
                >
                    {open ? clientContext.config.title : ''}
                </Toolbar>
                <SideMenu />
            </Drawer>
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    // Eliminamos el padding de aquí para evitar desbordamientos
                    // p: 3, 
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
                    minWidth: 0,
                    flexShrink: 0,
                    paddingTop: `${appBarOffset.minHeight}px`,
                    height: '100%',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    // MODIFICACIÓN CLAVE: Ancho condicional para el contenido principal
                    width: open ? `calc(100% - ${drawerWidth}px)` : '100%',
                }}
            >
                {children}
            </Box>
        </Box>
    );
};

export default MainLayout;
