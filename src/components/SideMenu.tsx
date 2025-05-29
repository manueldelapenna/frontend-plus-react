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

interface SideMenuProps {
    // onMenuItemClick?: () => void; // <--- Ya no es necesaria esta prop si el menú siempre queda abierto
}

interface MenuListItemProps {
    item: MenuInfoBase;
    level: number;
    // onMenuItemClick?: () => void; // <--- Ya no es necesaria esta prop
}

const MenuListItem: React.FC<MenuListItemProps> = ({ item, level /*, onMenuItemClick */ }) => { // Remueve onMenuItemClick
    const navigate = useNavigate();
    const location = useLocation();
    const [open, setOpen] = React.useState(false);

    const handleClick = () => {
        if (item.menuType === "menu") {
            setOpen(!open);
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
            // Eliminamos la llamada al callback para cerrar el menú aquí
            // if (onMenuItemClick) {
            //     onMenuItemClick();
            // }
        }
    };

    const getIcon = (item: MenuInfoBase) => {
        switch (item.menuType) {
            case "table": 
                // Color azul oscuro para tablas, sugiriendo datos y estructura
                return <TableChartIcon sx={{ color: blue[700] }} />; 
            case "proc": 
                // Ícono de "herramienta" para procesos/acciones con parámetros, color índigo oscuro
                return <DnsIcon sx={{ color: teal[700] }} />; 
            case "menu": 
                // Ícono de carpeta con un color naranja sutil
                return <FolderIcon sx={{ color: orange[800] }} />; 
            default: return null;
        }
    };

    const currentPath = location.pathname;
    const isSelected = item.menuType === "table" && currentPath.startsWith(`/table/${item.table}`);


    return (
        <>
            <ListItemButton onClick={handleClick} sx={{ pl: level * 2 }}>
                <ListItemIcon sx={{minWidth:'38px'}}>
                    {getIcon(item)}
                </ListItemIcon>
                <ListItemText primary={item.label || item.name} />
                {item.menuType === "menu" ? (open ? <ExpandLess /> : <ExpandMore />) : null}
            </ListItemButton>
            {item.menuType === "menu" && (
                <Collapse in={open} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                        {(item as MenuInfoMenu).menuContent.map((subItem) => (
                            // Remueve onMenuItemClick aquí también
                            <MenuListItem key={subItem.name} item={subItem} level={level + 1} /* onMenuItemClick={onMenuItemClick} */ />
                        ))}
                    </List>
                </Collapse>
            )}
        </>
    );
};


const SideMenu: React.FC<SideMenuProps> = ({ /* onMenuItemClick */ }) => { // Remueve onMenuItemClick aquí
    const { clientContext } = useApp();
    const navigate = useNavigate();

    const handleHomeClick = () => {
        navigate('/home');
        // Eliminamos la llamada al callback para cerrar el menú aquí
        // if (onMenuItemClick) {
        //     onMenuItemClick();
        // }
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
                    // Remueve onMenuItemClick aquí
                    <MenuListItem key={menuItem.name} item={menuItem} level={1} /* onMenuItemClick={onMenuItemClick} */ />
                ))}
            </List>
        </Box>
    );
};

export default SideMenu;