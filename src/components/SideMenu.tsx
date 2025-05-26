import React from 'react';
import { List, ListItem, ListItemButton, ListItemIcon, ListItemText, Toolbar, Divider, Box, Typography, Collapse } from '@mui/material';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import TableChartIcon from '@mui/icons-material/TableChart';
import FunctionsIcon from '@mui/icons-material/Functions'; // Para procedimientos
import FolderIcon from '@mui/icons-material/Folder'; // Para carpetas de menú
import HomeIcon from '@mui/icons-material/Home'; // Para el inicio
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import {MenuInfoBase, MenuInfoProc, MenuInfoTable, MenuInfoWScreen, MenuInfoMenu } from "backend-plus";


// Importa los tipos de menú que acabamos de definir
//import { MenuItem, MenuItemFolder, MenuItemTable, MenuItemProc } from '../types/menu'; // Ajusta la ruta si es necesario

interface SideMenuProps {
  // Puedes pasar props adicionales si es necesario
}

// Componente recursivo para renderizar los ítems del menú
interface MenuListItemProps {
  item: MenuInfoBase;
  level: number; // Para manejar el padding y la indentación
}

const MenuListItem: React.FC<MenuListItemProps> = ({ item, level }) => {
  const navigate = useNavigate();
  const location = useLocation(); // Para saber la ruta actual y resaltar el ítem
  const [open, setOpen] = React.useState(false);

  const handleClick = () => {
    if (item.menuType === "menu") {
      setOpen(!open); // Abre/cierra el sub-menú
    } else if (item.menuType === "table") {
      // Si es una tabla, navega a la ruta de la grilla
      const tableName = (item as MenuInfoBase).table || item.name;
      let path = `/table/${tableName}`;
      // Puedes pasar ff, td, fc como estado o parámetros de consulta si tu grilla los necesita
      // Para este ejemplo, solo usaremos el nombre de la tabla
      
      // Opcional: Si quieres pasar ff, td, fc como query params o state
      const queryParams = new URLSearchParams();
      if (item.ff) queryParams.append('ff', JSON.stringify((item.ff)));
      if (item.td) queryParams.append('td', JSON.stringify((item.td)));
      if (item.fc) queryParams.append('fc', JSON.stringify((item.fc)));

      if (queryParams.toString()) {
          path = `${path}?${queryParams.toString()}`;
      }
      
      navigate(path);
    } else if (item.menuType === "proc") {
      // Si es un procedimiento, navega a la ruta de procedimiento
      navigate(`/procedures/${item.name}`);
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
  // Resalta el ítem si la URL actual coincide con la ruta generada
  const isSelected = item.menuType === "table" && currentPath.startsWith(`/table/${item.table}`);
  // Puedes refinar isSelected para ítems de menú también si el sub-menú contiene el ítem seleccionado

  return (
    <>
      <ListItemButton onClick={handleClick} sx={{ pl: level * 2 }}> {/* Indentación */}
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
              <MenuListItem key={subItem.name} item={subItem} level={level + 1} />
            ))}
          </List>
        </Collapse>
      )}
    </>
  );
};


const SideMenu: React.FC<SideMenuProps> = () => {
  const { clientContext } = useApp();
  const navigate = useNavigate();

  if (!clientContext || !clientContext.menu) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">Cargando menú...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: 240, flexShrink: 0 }}>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          {'FrontendPlus App'}
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {/* Siempre un link a la página principal */}
        <ListItem disablePadding>
          <ListItemButton onClick={() => navigate('/home')}>
            <ListItemIcon>
              <HomeIcon />
            </ListItemIcon>
            <ListItemText primary="Inicio" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton onClick={() => navigate('/tablas')}>
            <ListItemIcon>
              <HomeIcon />
            </ListItemIcon>
            <ListItemText primary="Tablas (QUITAR)" />
          </ListItemButton>
        </ListItem>
        <Divider />
        {clientContext.menu.map((menuItem: MenuInfoBase) => (
          <MenuListItem key={menuItem.name} item={menuItem} level={1} />
        ))}
      </List>
    </Box>
  );
};

export default SideMenu;