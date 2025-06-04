// src/store/menuUiSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface MenuUiState {
    isDrawerOpen: boolean;
    subMenuOpenStates: { [key: string]: boolean }; // Para persistir el estado de los submenús por su 'name'
}

const initialState: MenuUiState = {
    isDrawerOpen: false, // El valor inicial que quieres para el Drawer
    subMenuOpenStates: {}, // Inicialmente, ningún submenú está abierto
};

const menuUiSlice = createSlice({
    name: 'menuUi',
    initialState,
    reducers: {
        // Reducer para cambiar el estado del Drawer principal
        setDrawerOpen: (state, action: PayloadAction<boolean>) => {
            state.isDrawerOpen = action.payload;
        },
        toggleDrawer: (state) => {
            state.isDrawerOpen = !state.isDrawerOpen;
        },
        // Reducer para cambiar el estado de apertura/cierre de un submenú específico
        setSubMenuOpen: (state, action: PayloadAction<{ menuName: string; isOpen: boolean }>) => {
            state.subMenuOpenStates[action.payload.menuName] = action.payload.isOpen;
        },
        toggleSubMenu: (state, action: PayloadAction<string>) => {
            // Si el submenú ya existe, invierte su estado; si no, ábrelo por defecto
            state.subMenuOpenStates[action.payload] = !state.subMenuOpenStates[action.payload];
        },
        // Opcional: un reducer para resetear todos los estados del menú si es necesario (ej. al cerrar sesión)
        resetMenuUiState: (state) => {
            Object.assign(state, initialState);
        },
    },
});

export const {
    setDrawerOpen,
    toggleDrawer,
    setSubMenuOpen,
    toggleSubMenu,
    resetMenuUiState,
} = menuUiSlice.actions;

export default menuUiSlice.reducer;