// src/components/SideMenu.tsx
import React from 'react';
import { List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider, Box, Typography, Collapse } from '@mui/material';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import TableChartIcon from '@mui/icons-material/TableChart';
import FolderIcon from '@mui/icons-material/Folder';
import DnsIcon from '@mui/icons-material/Dns';
import HomeIcon from '@mui/icons-material/Home';
// Importamos los íconos para expandir/colapsar todo
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';

import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { MenuInfoBase, MenuInfoTable, MenuInfoProc, MenuInfoMenu } from "backend-plus";
import { blue, orange, teal } from '@mui/material/colors';

// Importamos los hooks de Redux y las acciones del nuevo slice
import { useSubMenuOpenState, useAppDispatch, useAppSelector } from '../store'; // Agregamos useAppSelector
import { toggleSubMenu, setAllSubMenusOpen } from '../store/menuUiSlice'; // Importamos la nueva acción

interface SideMenuProps {
    onMenuItemClick?: () => void;
}

interface MenuListItemProps {
    item: MenuInfoBase;
    level: number;
    onMenuItemClick?: () => void;
}

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
            default: return null;
        }
    };

    const currentPath = location.pathname;
    let isSelected = false;

    if (item.menuType === "table") {
        const tableName = (item as MenuInfoTable).table || item.name;
        isSelected = currentPath.startsWith(`/table/${tableName}`);
    } else if (item.menuType === "proc") {
        isSelected = currentPath === `/procedures/${item.name}`;
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


const SideMenu: React.FC<SideMenuProps> = ({ onMenuItemClick }) => {
    const { clientContext } = useApp();
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useAppDispatch(); // Obtener el dispatch para la nueva acción

    // Selecciona el estado de todos los submenús para determinar si la mayoría están abiertos
    const subMenuOpenStates = useAppSelector(state => state.menuUi.subMenuOpenStates);

    // Determinar si la mayoría de los submenús están abiertos para mostrar el ícono correcto
    // Esto es una heurística simple; puedes ajustarla según tu necesidad.
    const allSubMenusKeys = Object.keys(subMenuOpenStates);
    const openSubMenusCount = allSubMenusKeys.filter(key => subMenuOpenStates[key]).length;
    const isMostlyOpen = allSubMenusKeys.length > 0 && openSubMenusCount / allSubMenusKeys.length > 0.5;

    const handleHomeClick = () => {
        navigate('/home');
        if (onMenuItemClick) {
            onMenuItemClick();
        }
    };

    // --- NUEVO MANEJADOR para colapsar/expandir todo ---
    const handleToggleAllSubMenus = () => {
        // Despacha la acción para abrir o cerrar todos los submenús
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
                {/* Renderizar los elementos de menú principales */}
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