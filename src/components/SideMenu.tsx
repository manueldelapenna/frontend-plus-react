// src/components/SideMenu.tsx
import React from 'react';
import { List, ListItem, ListItemButton, ListItemIcon, ListItemText, Toolbar, Divider, Box, Typography, Collapse } from '@mui/material';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import TableChartIcon from '@mui/icons-material/TableChart';
import FunctionsIcon from '@mui/icons-material/Functions';
import FolderIcon from '@mui/icons-material/Folder';
import HomeIcon from '@mui/icons-material/Home';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { MenuInfoBase, MenuInfoProc, MenuInfoTable, MenuInfoWScreen, MenuInfoMenu } from "backend-plus";


interface SideMenuProps {
    onMenuItemClick?: () => void; // Nueva prop: un callback para cerrar el menú
}

interface MenuListItemProps {
    item: MenuInfoBase;
    level: number;
    onMenuItemClick?: () => void; // También se pasa a los ítems del sub-menú
}

const MenuListItem: React.FC<MenuListItemProps> = ({ item, level, onMenuItemClick }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [open, setOpen] = React.useState(false);

    const handleClick = () => {
        if (item.menuType === "menu") {
            setOpen(!open);
        } else {
            // Si es un elemento final (tabla o procedimiento), navega y luego cierra el menú
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
            // Llama al callback para cerrar el menú después de navegar
            if (onMenuItemClick) {
                onMenuItemClick();
            }
        }
    };

    const getIcon = (item: MenuInfoBase) => {
        switch (item.menuType) {
            case "table": return <TableChartIcon />;
            case "proc": return <FunctionsIcon />;
            case "menu": return <FolderIcon />;
            default: return null;
        }
    };

    const currentPath = location.pathname;
    const isSelected = item.menuType === "table" && currentPath.startsWith(`/table/${item.table}`);


    return (
        <>
            <ListItemButton onClick={handleClick} sx={{ pl: level * 2 }}>
                <ListItemIcon>
                    {getIcon(item)}
                </ListItemIcon>
                <ListItemText primary={item.label || item.name} />
                {item.menuType === "menu" ? (open ? <ExpandLess /> : <ExpandMore />) : null}
            </ListItemButton>
            {item.menuType === "menu" && (
                <Collapse in={open} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                        {(item as MenuInfoMenu).menuContent.map((subItem) => (
                            <MenuListItem key={subItem.name} item={subItem} level={level + 1} onMenuItemClick={onMenuItemClick} />
                        ))}
                    </List>
                </Collapse>
            )}
        </>
    );
};


const SideMenu: React.FC<SideMenuProps> = ({ onMenuItemClick }) => { // Recibe la prop aquí
    const { clientContext } = useApp();
    const navigate = useNavigate();

    const handleHomeClick = () => {
        navigate('/home');
        if (onMenuItemClick) {
            onMenuItemClick(); // Cierra el menú al ir a Home
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
        <Box sx={{ width: '100%', flexShrink: 0 }}> {/* Box con width: 100% para que ocupe el ancho del drawer */}
            {/* El Toolbar ya lo manejamos en MainLayout, así que aquí no es necesario */}
            {/* <Toolbar>
                <Typography variant="h6" noWrap component="div">
                    {'FrontendPlus App'}
                </Typography>
            </Toolbar> */}
            <Divider />
            <List>
                <ListItem disablePadding>
                    <ListItemButton onClick={handleHomeClick}> {/* Usa la función con el callback */}
                        <ListItemIcon>
                            <HomeIcon />
                        </ListItemIcon>
                        <ListItemText primary="Inicio" />
                    </ListItemButton>
                </ListItem>
                <Divider />
                {clientContext.menu.map((menuItem: MenuInfoBase) => (
                    // Pasa la función a cada MenuListItem
                    <MenuListItem key={menuItem.name} item={menuItem} level={1} onMenuItemClick={onMenuItemClick} />
                ))}
            </List>
        </Box>
    );
};

export default SideMenu;