import React from 'react';
import { List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider, Box, Typography, Collapse } from '@mui/material';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import TableChartIcon from '@mui/icons-material/TableChart';
import FolderIcon from '@mui/icons-material/Folder';
import DnsIcon from '@mui/icons-material/Dns';
import HomeIcon from '@mui/icons-material/Home';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows'; // Icono para wScreens
// Importamos los íconos para expandir/colapsar todo
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';

import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { MenuInfoBase, MenuInfoTable, MenuInfoProc, MenuInfoMenu } from "backend-plus";
import { blue, orange, teal, red, grey } from '@mui/material/colors';

import { useSubMenuOpenState, useAppDispatch, useAppSelector } from '../store';
import { toggleSubMenu, setAllSubMenusOpen } from '../store/menuUiSlice';
// Asegúrate de que MenuListItemProps y SideMenuProps estén definidos e importados correctamente
import { MenuListItemProps, SideMenuProps } from '../types'; // <--- VERIFICA ESTA RUTA Y DEFINICIÓN

// NUEVAS IMPORTACIONES PARA WSCREENS
import { wScreens } from '../pages/WScreens'; // Asegúrate de que la ruta sea correcta


const MenuListItem: React.FC<MenuListItemProps> = ({ item, level, onMenuItemClick }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const open = useSubMenuOpenState(item.name);
    const dispatch = useAppDispatch();

    const handleClick = () => {
        if (item.menuType === "menu") {
            dispatch(toggleSubMenu(item.name));
        } else {
            let path = '';
            if (item.menuType === "table") {
                const tableName = (item as MenuInfoTable).table || item.name;
                path = `/table/${tableName}`;
                const queryParams = new URLSearchParams();
                if (item.ff) queryParams.append('ff', JSON.stringify((item.ff)));
                if (item.td) queryParams.append('td', JSON.stringify((item.td)));
                if (item.fc) queryParams.append('fc', JSON.stringify((item.fc)));

                if (queryParams.toString()) {
                    path = `${path}?${queryParams.toString()}`;
                }
            } else if (item.menuType === "proc") {
                path = `/procedures/${item.name}`;
            } else {
                // *** CORRECCIÓN PARA TS2774 ***
                const WScreenComponent = wScreens[item.menuType];
                if (WScreenComponent !== undefined) { // <-- Explícitamente verificar que NO es undefined
                    path = `/wScreens/${item.menuType}`; // Ruta para wScreens implementadas
                } else {
                    // Si el menuType no es reconocido y no hay un componente mapeado
                    // Redirigimos a la ruta de fallback genérica
                    path = `/wScreens-fallback/${item.menuType}`;
                    console.warn(`Menu type '${item.menuType}' no reconocido o WScreen no mapeada.`);
                }
            }
            if (path) {
                navigate(path);
            }
            if (onMenuItemClick) {
                onMenuItemClick();
            }
        }
    };

    const getIcon = (item: MenuInfoBase) => {
        switch (item.menuType) {
            case "table":
                return <TableChartIcon sx={{ color: blue[700] }} />;
            case "proc":
                return <DnsIcon sx={{ color: teal[700] }} />;
            case "menu":
                return <FolderIcon sx={{ color: orange[800] }} />;
            default:
                // Si no es un tipo conocido, lo consideramos una 'wScreen'
                // *** CORRECCIÓN PARA TS2774 ***
                const WScreenComponent = wScreens[item.menuType];
                if (WScreenComponent !== undefined) { // <-- Explícitamente verificar que NO es undefined
                    return <DesktopWindowsIcon sx={{ color: grey[700] }} />; // Icono genérico para wScreens
                }
                // Si no es una wScreen mapeada, mostramos advertencia
                return <WarningAmberIcon sx={{ color: red[500] }} />; // Icono de advertencia para no reconocido
        }
    };

    const currentPath = location.pathname;
    let isSelected = false;

    if (item.menuType === "table") {
        const tableName = (item as MenuInfoTable).table || item.name;
        isSelected = currentPath.startsWith(`/table/${tableName}`);
    } else if (item.menuType === "proc") {
        isSelected = currentPath === `/procedures/${item.name}`;
    } else {
        // Lógica para selección de wScreens y su fallback
        isSelected = currentPath.startsWith(`/wScreens/${item.menuType}`) || currentPath.startsWith(`/wScreens-fallback/${item.menuType}`);
    }

    return (
        <>
            <ListItemButton
                onClick={handleClick}
                sx={{ pl: level * 2 }}
                selected={isSelected}
            >
                <ListItemIcon sx={{ minWidth: '38px' }}>
                    {getIcon(item)}
                </ListItemIcon>
                <ListItemText primary={item.label || item.name} />
                {item.menuType === "menu" ? (open ? <ExpandLess /> : <ExpandMore />) : null}
            </ListItemButton>
            {item.menuType === "menu" && (
                <Collapse in={open} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                        {(item as MenuInfoMenu).menuContent.map((subItem) => (
                            <MenuListItem
                                key={subItem.name}
                                item={subItem}
                                level={level + 1}
                                onMenuItemClick={onMenuItemClick}
                            />
                        ))}
                    </List>
                </Collapse>
            )}
        </>
    );
};


// Asegúrate de que SideMenuProps esté definido e importado
const SideMenu: React.FC<SideMenuProps> = ({ onMenuItemClick }) => {
    const { clientContext } = useApp();
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useAppDispatch();

    const subMenuOpenStates = useAppSelector(state => state.menuUi.subMenuOpenStates);

    const allSubMenusKeys = Object.keys(subMenuOpenStates);
    const openSubMenusCount = allSubMenusKeys.filter(key => subMenuOpenStates[key]).length;
    const isMostlyOpen = allSubMenusKeys.length > 0 && openSubMenusCount / allSubMenusKeys.length > 0.5;

    const handleHomeClick = () => {
        navigate('/home');
        if (onMenuItemClick) {
            onMenuItemClick();
        }
    };

    const handleToggleAllSubMenus = () => {
        dispatch(setAllSubMenusOpen(!isMostlyOpen));
    };

    if (!clientContext || !clientContext.menu) {
        return (
            <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">Cargando menú...</Typography>
            </Box>
        );
    }

    const isHomeSelected = location.pathname === '/home';

    return (
        <Box sx={{ width: '100%', flexShrink: 0 }}>
            {clientContext.menu.some(item => item.menuType === "menu") && (
                <ListItem disablePadding>
                    <ListItemButton onClick={handleToggleAllSubMenus}>
                        <ListItemIcon sx={{ minWidth: '38px' }}>
                            {isMostlyOpen ? <UnfoldLessIcon /> : <UnfoldMoreIcon />}
                        </ListItemIcon>
                        <ListItemText primary={isMostlyOpen ? "colapsar " : "expandir"} />
                    </ListItemButton>
                </ListItem>
            )}
            <Divider />
            <List>
                <ListItem disablePadding>
                    <ListItemButton onClick={handleHomeClick} selected={isHomeSelected}>
                        <ListItemIcon sx={{ minWidth: '38px' }}>
                            <HomeIcon />
                        </ListItemIcon>
                        <ListItemText primary="Inicio" />
                    </ListItemButton>
                </ListItem>
                <Divider />
                {clientContext.menu.map((menuItem: MenuInfoBase) => (
                    <MenuListItem
                        key={menuItem.name}
                        item={menuItem}
                        level={1}
                        onMenuItemClick={onMenuItemClick}
                    />
                ))}
            </List>
        </Box>
    );
};

export default SideMenu;