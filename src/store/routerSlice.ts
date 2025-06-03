// src/store/routerSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface RouterState {
    currentPath: string;
    previousPath: string | null;
  }
  
  const initialState: RouterState = {
    currentPath: '/',
    previousPath: null,
  };
  
  const routerSlice = createSlice({
    name: 'router',
    initialState,
    reducers: {
      setCurrentPath: (state, action: PayloadAction<string>) => {
        state.previousPath = state.currentPath;
        state.currentPath = action.payload;
      },
      resetRouterState: (state) => {
        state.currentPath = '/';
        state.previousPath = null;
      },
    },
  });
  
  export const { setCurrentPath, resetRouterState } = routerSlice.actions;
  export default routerSlice.reducer;