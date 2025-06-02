import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DataGrid, Column } from 'react-data-grid';
import 'react-data-grid/lib/styles.css'; // Importar los estilos de react-data-grid
import { TableDefinition, FieldDefinition } from "backend-plus";
import { useParams } from 'react-router-dom';
import { fetchApi } from '../utils/fetchApi';
import { CircularProgress, Typography, Box, Alert, useTheme } from '@mui/material'; // Importado useTheme para acceder a theme.spacing
import { quitarGuionesBajos, reemplazarGuionesBajosPorEspacios } from '../utils/functions';

const getPrimaryKeyValues = (row: any, primaryKey: string[]): string => {
    return primaryKey.map(key => row[key]).join('-');
};

interface GenericDataGridProps {
    // tableName: string; // Eliminado, se obtiene de useParams
}

// Interfaz para las propiedades del Formatter de celda
interface CellFormatterProps {
    value: any; // El valor de la celda
    column: Column<any>; // La definición de la columna
    row: any; // La fila completa
    isCellSelected: boolean;
    isRowSelected: boolean;
    tabIndex: number;
    onRowChange: (updatedRow: any) => void;
}

// Formatter de ejemplo para manejar diferentes tipos de datos en las celdas
const DefaultCellFormatter: React.FC<CellFormatterProps> = ({ value }) => {
    if (typeof value === 'object' && value !== null) {
        // Podrías mostrar un resumen, un botón para ver detalles, etc.
        // Por ahora, solo indicamos que es un objeto para evitar textos largos
        return <span>[Objeto]</span>;
    }
    // Para valores primitivos (string, number, boolean), los convertimos a string
    return <span>{String(value)}</span>;
};

const GenericDataGrid: React.FC<GenericDataGridProps> = () => {
    const { tableName } = useParams<{ tableName?: string }>();
    const [tableDefinition, setTableDefinition] = useState<TableDefinition | null>(null);
    const [tableData, setTableData] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const theme = useTheme(); // Para acceder a theme.spacing

    useEffect(() => {
        if (!tableName) {
            setError("Nombre de tabla no especificado en la URL.");
            setLoading(false);
            return;
        }

        const fetchDataAndDefinition = async () => {
            setLoading(true);
            setError(null);
            setTableDefinition(null);
            setTableData([]);

            try {
                // Cargar la definición de la tabla
                const bodyDefinition = new URLSearchParams({ table: tableName });
                const responseDefinition = await fetchApi(`/table_structure`, {
                    method: 'POST',
                    body: bodyDefinition
                });

                if (!responseDefinition.ok) {
                    const errorText = await responseDefinition.text();
                    throw new Error(`Error al cargar la estructura de la tabla '${tableName}': ${responseDefinition.status} - ${errorText}`);
                }
                const rawResponseTextDefinition = await responseDefinition.text();
                const definition = JSON.parse(rawResponseTextDefinition.replace(/^--\n/, ''));
                setTableDefinition(definition);

                // Cargar los datos de la tabla
                const bodyData = new URLSearchParams({ table: tableName });
                const responseData = await fetchApi(`/table_data`, {
                    method: 'POST',
                    body: bodyData
                });

                if (!responseData.ok) {
                    const errorText = await responseData.text();
                    throw new Error(`Error al cargar datos de '${tableName}': ${responseData.status} - ${errorText}`);
                }
                const rawResponseTextData = await responseData.text();
                const data = JSON.parse(rawResponseTextData.replace(/^--\n/, ''));

                setTableData(data);

            } catch (err: any) {
                console.error('Error al cargar datos de la tabla:', err);
                setError(`Error al cargar la tabla: ${err.message || 'Error desconocido'}`);
                setTableDefinition(null);
                setTableData([]);
            } finally {
                setLoading(false);
            }
        };

        fetchDataAndDefinition();
    }, [tableName]);

    const primaryKey = useMemo(() => {
        if (!tableDefinition) return ['id'];
        return tableDefinition.primaryKey || ['id'];
    }, [tableDefinition]);

    const columns: Column<any>[] = useMemo(() => {
        if (!tableDefinition) return [];

        return tableDefinition.fields.map((field: FieldDefinition) => ({
            key: quitarGuionesBajos(field.name),
            name: field.label || reemplazarGuionesBajosPorEspacios(field.name),
            resizable: true,
            sortable: true,
            formatter: DefaultCellFormatter,
            flexGrow: 1, // Usamos flexGrow: 1 para que las columnas se ajusten
            minWidth: 80, // Ancho mínimo para evitar que las columnas sean demasiado pequeñas
        }));
    }, [tableDefinition]); // Dependencia: tableDefinition

    // Determina si la grilla debe tener una altura reducida
    const showNoRowsMessage = tableData.length === 0 && !loading && !error;

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <CircularProgress />
                <Typography variant="h6" sx={{ ml: 2 }}>Cargando tabla...</Typography>
            </Box>
        );
    }

    if (error) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <Alert severity="error">{error}</Alert>
            </Box>
        );
    }

    if (!tableDefinition) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <Alert severity="warning">No se pudo cargar la definición de la tabla.</Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 0, display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
            <Typography variant="h4" gutterBottom sx={{ px: 2, pt: 2 }}>
                {reemplazarGuionesBajosPorEspacios(tableDefinition.title || tableDefinition.name)}
            </Typography>
            <Box
                sx={{
                    // MODIFICACIÓN CLAVE: Altura condicional para el contenedor de la grilla
                    flexGrow: showNoRowsMessage ? 0 : 1, // No crece si no hay filas
                    height: showNoRowsMessage ? '150px' : '100%', // Altura fija si no hay filas, sino 100%
                    boxSizing: 'border-box',
                    position: 'relative',
                    overflowX: 'auto',
                    overflowY: 'auto',
                    px: 2,
                    pb: 2
                }}
            >
                {/* El DataGrid siempre se renderiza para mostrar las columnas */}
                <DataGrid
                    columns={columns}
                    rows={tableData} // tableData puede ser un array vacío
                    rowKeyGetter={(row: any) => getPrimaryKeyValues(row, primaryKey)}
                    style={{ height: '100%', width: '100%', boxSizing: 'border-box' }}
                />
                {showNoRowsMessage && (
                    // El mensaje se posiciona para que se vea dentro de la altura reducida
                    <Box
                        sx={{
                            position: 'absolute',
                            top: '36px', // Se posiciona debajo de los encabezados de la grilla
                            left: theme.spacing(2),
                            right: theme.spacing(2),
                            bottom: theme.spacing(2),
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            color: theme => theme.palette.text.secondary,
                            border: theme => `1px solid ${theme.palette.divider}`,
                            borderRadius: '4px',
                            zIndex: 1,
                        }}
                    >
                        <Typography variant="h6">No hay filas para mostrar.</Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default GenericDataGrid;
