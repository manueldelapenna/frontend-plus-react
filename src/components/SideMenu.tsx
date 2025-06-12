import React from 'react';
import { List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider, Box, Typography, Collapse } from '@mui/material';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import TableChartIcon from '@mui/icons-material/TableChart';
import FolderIcon from '@mui/icons-material/Folder';
import DnsIcon from '@mui/icons-material/Dns';
import HomeIcon from '@mui/icons-material/Home';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { MenuInfoBase, MenuInfoTable, MenuInfoProc, MenuInfoMenu } from "backend-plus";
import { blue, orange, teal } from '@mui/material/colors';

// Importamos los hooks de Redux y las acciones del nuevo slice
import { useSubMenuOpenState, useAppDispatch } from '../store';
import { toggleSubMenu } from '../store/menuUiSlice';

interface SideMenuProps {
    onMenuItemClick?: () => void; // Para cerrar el drawer principal (si es un drawer)
}

interface MenuListItemProps {
    item: MenuInfoBase;
    level: number;
    onMenuItemClick?: () => void; // Pasamos el callback recursivamente
}

const MenuListItem: React.FC<MenuListItemProps> = ({ item, level, onMenuItemClick }) => {
    const navigate = useNavigate();
    const location = useLocation(); // Hook para obtener la ruta actual

    // Usamos el estado del submenú desde Redux
    const open = useSubMenuOpenState(item.name); // 'item.name' es la clave única para el submenú
    const dispatch = useAppDispatch();

    const handleClick = () => {
        if (item.menuType === "menu") {
            dispatch(toggleSubMenu(item.name)); // Despacha la acción de toggle para este submenú
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
            // Navegar solo si es un elemento navegable (tiene una ruta definida)
            if (path) {
                navigate(path);
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
            // Puedes añadir más casos para otros menuType si los tienes
            // case "wsScreen":
            //     return <SettingsEthernetIcon sx={{ color: purple[500] }} />;
            default: return null;
        }
    };

    // --- Lógica para determinar si el elemento del menú está seleccionado ---
    const currentPath = location.pathname;
    let isSelected = false;

    if (item.menuType === "table") {
        const tableName = (item as MenuInfoTable).table || item.name;
        // Marcar seleccionado si la ruta actual comienza con la ruta de la tabla
        isSelected = currentPath.startsWith(`/table/${tableName}`);
        // NOTA: Si necesitas que la selección sea más estricta con query params,
        // tendrías que construir la URL completa con query params para 'item' y compararla con 'location.pathname + location.search'
        // Pero esto puede hacer la selección menos intuitiva si los query params son dinámicos.
        // Generalmente, la ruta base es suficiente para la selección del menú.
    } else if (item.menuType === "proc") {
        // Para procedimientos, la ruta debe ser exacta
        isSelected = currentPath === `/procedures/${item.name}`;
    }
    // Los elementos de tipo "menu" (carpetas) no suelen estar "seleccionados" por sí mismos,
    // su selección se refleja a través de la selección de sus hijos.

    return (
        <>
            <ListItemButton
                onClick={handleClick}
                sx={{ pl: level * 2 }}
                selected={isSelected} // ¡Aquí se aplica el estilo de selección de Material-UI!
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
                            // Pasamos el onMenuItemClick a los sub-elementos para que también cierren el drawer
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
    const location = useLocation(); // Necesitamos useLocation para determinar si "Inicio" está seleccionado

    const handleHomeClick = () => {
        navigate('/home');
        // Cerrar el drawer principal cuando se hace clic en "Inicio"
        if (onMenuItemClick) {
            onMenuItemClick();
        }
    };

    // Mostrar un mensaje de carga si el contexto del cliente o el menú no están disponibles
    if (!clientContext || !clientContext.menu) {
        return (
            <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">Cargando menú...</Typography>
            </Box>
        );
    }

    // Lógica para determinar si el elemento "Inicio" está seleccionado
    const isHomeSelected = location.pathname === '/home';

    return (
        <Box sx={{ width: '100%', flexShrink: 0 }}>
            {/* Opcional: Puedes añadir un Toolbar o logo aquí si tu diseño lo requiere */}
            {/* <Toolbar>
                <Typography variant="h6" component="div">
                    Mi App
                </Typography>
            </Toolbar> */}
            <Divider />
            <List>
                <ListItem disablePadding>
                    <ListItemButton
                        onClick={handleHomeClick}
                        selected={isHomeSelected} // Aplicamos el estilo de selección para "Inicio"
                    >
                        <ListItemIcon>
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
                        onMenuItemClick={onMenuItemClick} // Pasamos el callback a los elementos de nivel superior
                    />
                ))}
            </List>
        </Box>
    );
};

export default SideMenu;