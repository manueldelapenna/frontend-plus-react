import { configureStore, combineReducers } from '@reduxjs/toolkit';
import {
    persistStore,
    persistReducer,
    FLUSH,
    REHYDRATE,
    PAUSE,
    PERSIST,
    PURGE,
    REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';

import clientContextReducer, { ClientContextState } from './clientContextSlice';
import routerReducer from './routerSlice'; // Importa el nuevo reducer


import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
//import { getAppPrefix } from '../utils/functions';

const rootReducer = combineReducers({
    clientContext: clientContextReducer,
    router: routerReducer, // ¡Añade el nuevo reducer aquí!
    // ...otros slices
});

const persistConfig = {
    key: 'root',
    storage,
    // ¡Asegúrate de añadir 'router' a la whitelist si quieres que persista!
    whitelist: ['clientContext', 'router'], 
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
            },
        }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Hooks selectores personalizados
export const useClientContext = (): ClientContextState => {
    return useAppSelector(state => state.clientContext);
};

export const useClientContextStatus = (): ClientContextState['status'] => {
    return useAppSelector(state => state.clientContext.status);
};

export const useClientContextError = (): ClientContextState['error'] => {
    return useAppSelector(state => state.clientContext.error);
};

// --- ¡NUEVOS SELECTORES PARA EL ESTADO DEL ROUTER! ---
export const useCurrentPath = (): string => {
  return useAppSelector(state => state.router.currentPath);
};

export const usePreviousPath = (): string | null => {
  return useAppSelector(state => state.router.previousPath);
};