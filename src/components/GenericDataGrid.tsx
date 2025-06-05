import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DataGrid, Column } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import { TableDefinition, FieldDefinition } from "backend-plus";
import { useParams } from 'react-router-dom';
import { fetchApi } from '../utils/fetchApi';
import { CircularProgress, Typography, Box, Alert, useTheme, InputBase } from '@mui/material';
import { quitarGuionesBajos, cambiarGuionesBajosPorEspacios } from '../utils/functions';

const getPrimaryKeyValues = (row: any, primaryKey: string[]): string => {
    return primaryKey.map(key => row[key]).join('-');
};

interface GenericDataGridProps {
    // tableName: string; // Eliminado, se obtiene de useParams
}

interface CellFormatterProps {
    value: any;
    column: Column<any>;
    row: any;
    isCellSelected: boolean;
    isRowSelected: boolean;
    tabIndex: number;
    onRowChange: (updatedRow: any) => void;
}

const DefaultCellFormatter: React.FC<CellFormatterProps> = ({ value }) => {
    if (typeof value === 'object' && value !== null) {
        return <span>[Objeto]</span>;
    }
    return <span>{String(value)}</span>;
};

// --- COMPONENTE DE FILTRO ---
// Interfaz para las propiedades del renderizador de filtro
interface FilterRendererProps<R, S> {
    column: Column<R, S>;
    filters: Record<string, string>;
    setFilters: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

// Componente funcional para el input de filtro
function textEditor<R, S>({
    column,
    filters,
    setFilters
}: FilterRendererProps<R, S>) {
    // console.log(`Ejecutando textEditor para columna: ${column.name}`); // Actívalo si necesitas depurar
    return (
        <InputBase
            value={filters[column.key] || ''}
            onChange={(e) =>
                setFilters({
                    ...filters,
                    [column.key]: e.target.value
                })
            }
            placeholder={``}
            sx={{
                width: '100%',
                margin: '0',
                border: '1px solid #ccc',
                borderRadius: '4px',
                padding: '2px 4px',
                fontSize: '0.8rem',
                boxSizing: 'border-box',
            }}
            onClick={(e) => e.stopPropagation()} // Importante: evita que el click en el input active la selección de fila/columna de la grilla
        />
    );
}
// --- FIN COMPONENTE DE FILTRO ---


const GenericDataGrid: React.FC<GenericDataGridProps> = () => {
    const { tableName } = useParams<{ tableName?: string }>();
    const [tableDefinition, setTableDefinition] = useState<TableDefinition | null>(null);
    const [tableData, setTableData] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // --- ESTADO PARA LOS FILTROS ---
    const [filters, setFilters] = useState<Record<string, string>>({});

    const theme = useTheme();

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

    // --- DEFINICIÓN DE COLUMNAS CON renderHeaderCell ---
    const columns: Column<any>[] = useMemo(() => {
        if (!tableDefinition) return [];

        return tableDefinition.fields.map((field: FieldDefinition) => ({
            key: quitarGuionesBajos(field.name),
            name: field.label || cambiarGuionesBajosPorEspacios(field.name),
            resizable: true,
            sortable: true,
            editable: true,
            formatter: DefaultCellFormatter,
            flexGrow: 1,
            minWidth: 60, // Ancho mínimo suficiente para el input de filtro

            // Definición del renderHeaderCell (¡el nombre correcto!)
            renderHeaderCell: ({ column }) => {
                // console.log(`Renderizando header para: ${column.name}`); // Actívalo si necesitas depurar
                return (
                    <div
                        // Asignamos la clase de react-data-grid para asegurar el correcto renderizado
                        className="rdg-cell"
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            height: '100%', // Que ocupe toda la altura del encabezado (70px)
                            justifyContent: 'space-between', // Espacio entre el nombre y el input
                            alignItems: 'flex-start', // Alinea el contenido a la izquierda/arriba
                            padding: '4px', // Padding general dentro del encabezado
                            boxSizing: 'border-box',
                        }}
                    >
                        <span style={{ fontWeight: 'bold', paddingBottom: '4px' }}>{column.name}</span>
                        {/* Renderizamos el componente de filtro */}
                        {textEditor({ column: column, filters, setFilters })}
                    </div>
                );
            }
        }));
    }, [tableDefinition, filters]); // Dependencia: tableDefinition y filters para que los encabezados se re-rendericen al cambiar el filtro

    // --- FILTRADO DE DATOS ---
    const filteredRows = useMemo(() => {
        let rows = tableData;
        Object.keys(filters).forEach(key => {
            const filterValue = filters[key].toLowerCase();
            if (filterValue) {
                rows = rows.filter(row => {
                    const cellValue = String(row[key] || '').toLowerCase();
                    return cellValue.includes(filterValue);
                });
            }
        });
        return rows;
    }, [tableData, filters]);

    const showNoRowsMessage = filteredRows.length === 0 && !loading && !error;

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
                {cambiarGuionesBajosPorEspacios(tableDefinition.title || tableDefinition.name)}
            </Typography>
            <Box
                sx={{
                    flexGrow: showNoRowsMessage ? 0 : 1,
                    height: showNoRowsMessage ? '150px' : '100%',
                    boxSizing: 'border-box',
                    position: 'relative',
                    overflowX: 'auto',
                    overflowY: 'auto',
                    px: 2,
                    pb: 2
                }}
            >
                <DataGrid
                    columns={columns} // Usamos las columnas generadas con el renderHeaderCell
                    rows={filteredRows} // Usamos las filas filtradas
                    enableVirtualization={true}
                    rowKeyGetter={(row: any) => getPrimaryKeyValues(row, primaryKey)}
                    style={{ height: '100%', width: '100%', boxSizing: 'border-box' }}
                    headerRowHeight={70} // Altura de la fila del encabezado para dar espacio al filtro
                />
                {showNoRowsMessage && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: '70px',
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