import React from 'react';
import { RenderCellProps } from 'react-data-grid';
import { FieldDefinition, TableDefinition } from '../../types'; // Ajusta la ruta a tu archivo de tipos

// Importa tus componentes client-side aquí
import ExampleClientSideComponent from './ExampleClientSideComponent';
import FallbackClientSideRenderer from './FallbackClientSideRenderer'; // ¡NUEVO!

export interface ClientSideRendererProps extends RenderCellProps<any, any> {
    fieldDefinition: FieldDefinition;
    tableDefinition: TableDefinition;
    primaryKey: string[];
}

export const clientSideRenderers: Record<string, React.FC<ClientSideRendererProps>> = {
    'ExampleClientSideComponent': ExampleClientSideComponent,
    // Puedes definir un valor especial para el fallback si quieres invocarlo explícitamente,
    // pero la lógica del grid lo usará si no encuentra el componente.
    'FallbackClientSideRenderer': FallbackClientSideRenderer, // Opcional, solo si quieres poder llamarlo por su nombre
};