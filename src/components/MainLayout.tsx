// src/components/MainLayout.tsx
import React, { ReactNode, useEffect } from 'react'; // Agregamos useEffect
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

// Importamos los hooks de Redux y las acciones del nuevo slice
import { useAppDispatch, useIsDrawerOpen } from '../store';
import { setDrawerOpen, toggleDrawer } from '../store/menuUiSlice';


const drawerWidth = 240;

interface MainLayoutProps {
    children: ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const { clientContext } = useApp();
    const logout = useLogout();

    // Reemplazamos useState por el hook de Redux
    const isDrawerOpen = useIsDrawerOpen(); // Obtiene el estado desde Redux
    const dispatch = useAppDispatch(); // Para despachar acciones

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // Efecto para cerrar el Drawer en móviles si se abre y el tamaño de pantalla cambia
    // O si quieres que el Drawer siempre esté cerrado por defecto en móviles
    useEffect(() => {
        if (isMobile && isDrawerOpen) {
            dispatch(setDrawerOpen(false));
        }
    }, [isMobile, isDrawerOpen, dispatch]);


    const handleToggleDrawer = () => {
        dispatch(toggleDrawer()); // Despacha la acción de toggle
    };

    // La lógica de isMobile ya no necesita handleDrawerOpen/Close separados si toggle maneja todo
    // y quieres que el Drawer se cierre automáticamente en móvil como en el useEffect.
    // Si quieres un comportamiento diferente en móvil, deberás adaptarlo aquí.
    const handleDrawerCloseMobile = () => {
        if (isMobile && isDrawerOpen) {
            dispatch(setDrawerOpen(false));
        }
    };


    if (!clientContext) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Typography>Cargando diseño de la aplicación...</Typography>
            </Box>
        );
    }

    const appBarOffset = theme.mixins.toolbar;

    return (
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
                    ...(isDrawerOpen && { // Usamos isDrawerOpen de Redux
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
                        onClick={handleToggleDrawer} // Usamos la nueva función para toggle
                        edge="start"
                        sx={{
                            marginRight: 2.2,
                        }}
                    >
                        {isDrawerOpen ? <ChevronLeftIcon /> : <MenuIcon />} {/* Usamos isDrawerOpen de Redux */}
                    </IconButton>
                    <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
                        {isDrawerOpen ? '' : clientContext.config.title} {/* Usamos isDrawerOpen de Redux */}
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
                open={isDrawerOpen} // Usamos isDrawerOpen de Redux
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
                    {isDrawerOpen ? clientContext.config.title : ''} {/* Usamos isDrawerOpen de Redux */}
                </Toolbar>
                {/* Pasamos la función para cerrar el drawer al SideMenu */}
                <SideMenu onMenuItemClick={handleDrawerCloseMobile} />
            </Drawer>
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    transition: (theme) => theme.transitions.create('margin', {
                        easing: theme.transitions.easing.sharp,
                        duration: theme.transitions.duration.leavingScreen,
                    }),
                    marginLeft: `-${drawerWidth}px`,
                    ...(isDrawerOpen && { // Usamos isDrawerOpen de Redux
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
                    width: isDrawerOpen ? `calc(100% - ${drawerWidth}px)` : '100%', // Usamos isDrawerOpen de Redux
                }}
            >
                {children}
            </Box>
        </Box>
    );
};

export default MainLayout;