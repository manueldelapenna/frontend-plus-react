// src/components/SideMenu.tsx
import React from 'react';
import { List, ListItem, ListItemButton, ListItemIcon, ListItemText, Toolbar, Divider, Box, Typography, Collapse } from '@mui/material';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import TableChartIcon from '@mui/icons-material/TableChart';
import FolderIcon from '@mui/icons-material/Folder';
import DnsIcon from '@mui/icons-material/Dns';
import HomeIcon from '@mui/icons-material/Home';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { MenuInfoBase, MenuInfoProc, MenuInfoTable, MenuInfoWScreen, MenuInfoMenu } from "backend-plus";
import { blue, orange, teal } from '@mui/material/colors';

// Importamos los hooks de Redux y las acciones del nuevo slice
import { useSubMenuOpenState, useAppDispatch } from '../store';
import { toggleSubMenu, setSubMenuOpen } from '../store/menuUiSlice';

interface SideMenuProps {
    onMenuItemClick?: () => void; // <--- Volvemos a necesitar esta prop si queremos cerrar el drawer principal
}

interface MenuListItemProps {
    item: MenuInfoBase;
    level: number;
    onMenuItemClick?: () => void; // <--- Volvemos a necesitar esta prop
}

const MenuListItem: React.FC<MenuListItemProps> = ({ item, level, onMenuItemClick }) => {
    const navigate = useNavigate();
    const location = useLocation();

    // Usamos el estado del submenú desde Redux
    const open = useSubMenuOpenState(item.name); // 'item.name' es la clave única para el submenú
    const dispatch = useAppDispatch();

    const handleClick = () => {
        if (item.menuType === "menu") {
            dispatch(toggleSubMenu(item.name)); // Despacha la acción de toggle para este submenú
        } else {
            if (item.menuType === "table") {
                const tableName = (item as MenuInfoTable).table || item.name;
                let path = `/table/${tableName}`;
                const queryParams = new URLSearchParams();
                if (item.ff) queryParams.append('ff', JSON.stringify((item.ff)));
                if (item.td) queryParams.append('td', JSON.stringify((item.td)));
                if (item.fc) queryParams.append('fc', JSON.stringify((item.fc)));

                if (queryParams.toString()) {
                    path = `${path}?${queryParams.toString()}`;
                }
                navigate(path);
            } else if (item.menuType === "proc") {
                navigate(`/procedures/${item.name}`);
            }
            // Llamamos al callback para cerrar el menú principal si se proporciona
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
    const isSelected = item.menuType === "table" && currentPath.startsWith(`/table/${item.table}`);


    return (
        <>
            <ListItemButton onClick={handleClick} sx={{ pl: level * 2 }}>
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
                            // Pasamos onMenuItemClick aquí también
                            <MenuListItem key={subItem.name} item={subItem} level={level + 1} onMenuItemClick={onMenuItemClick} />
                        ))}
                    </List>
                </Collapse>
            )}
        </>
    );
};


const SideMenu: React.FC<SideMenuProps> = ({ onMenuItemClick }) => { // Volvemos a recibir onMenuItemClick
    const { clientContext } = useApp();
    const navigate = useNavigate();

    const handleHomeClick = () => {
        navigate('/home');
        // Llamamos al callback para cerrar el menú principal si se proporciona
        if (onMenuItemClick) {
            onMenuItemClick();
        }
    };

    if (!clientContext || !clientContext.menu) {
        return (
            <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">Cargando menú...</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ width: '100%', flexShrink: 0 }}>
            <Divider />
            <List>
                <ListItem disablePadding>
                    <ListItemButton onClick={handleHomeClick}>
                        <ListItemIcon>
                            <HomeIcon />
                        </ListItemIcon>
                        <ListItemText primary="Inicio" />
                    </ListItemButton>
                </ListItem>
                <Divider />
                {clientContext.menu.map((menuItem: MenuInfoBase) => (
                    // Pasamos onMenuItemClick a MenuListItem
                    <MenuListItem key={menuItem.name} item={menuItem} level={1} onMenuItemClick={onMenuItemClick} />
                ))}
            </List>
        </Box>
    );
};

export default SideMenu;