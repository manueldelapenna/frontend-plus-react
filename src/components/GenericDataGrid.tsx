import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DataGrid, Column } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import { TableDefinition, FieldDefinition } from "backend-plus"; 

// CORRECCIÓN: react-router-dom es la importación correcta.
import { useParams } from 'react-router-dom';
import { fetchApi } from '../utils/fetchApi';
import { CircularProgress, Typography, Box, Alert, useTheme, InputBase, Button, IconButton } from '@mui/material';
import { quitarGuionesBajos, cambiarGuionesBajosPorEspacios } from '../utils/functions';

// --- CAMBIO DE ICONOS: Importar de Material-UI en lugar de lucide-react ---
import SearchIcon from '@mui/icons-material/Search';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import CloseIcon from '@mui/icons-material/Close'; // Usamos CloseIcon como equivalente a X de lucide-react
import AddIcon from '@mui/icons-material/Add';     // Equivalente a PlusIcon
import DeleteIcon from '@mui/icons-material/Delete'; // Equivalente a Trash2Icon
// --- FIN CAMBIO DE ICONOS ---

const getPrimaryKeyValues = (row: any, primaryKey: string[]): string => {
    return primaryKey.map(key => row[key]).join('-');
};

interface GenericDataGridProps {
    // tableName: string;
}

interface FilterRendererProps<R, S> {
    column: Column<R, S>;
    filters: Record<string, string>;
    setFilters: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

function FilterInputRenderer<R, S>({
    column,
    filters,
    setFilters
}: FilterRendererProps<R, S>) {
    return (
        <InputBase
            value={filters[column.key] || ''}
            onChange={(e) =>
                setFilters({
                    ...filters,
                    [column.key]: e.target.value
                })
            }
            placeholder={`Filtrar...`}
            sx={{
                width: '100%',
                margin: '0',
                border: '1px solid #ccc',
                borderRadius: '4px',
                padding: '2px 4px',
                fontSize: '0.8rem',
                boxSizing: 'border-box',
            }}
            onClick={(e) => e.stopPropagation()}
        />
    );
}

const GenericDataGrid: React.FC<GenericDataGridProps> = () => {
    const { tableName } = useParams<{ tableName?: string }>();
    const [tableDefinition, setTableDefinition] = useState<TableDefinition | null>(null);
    const [tableData, setTableData] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const [isFilterRowVisible, setIsFilterRowVisible] = useState<boolean>(false);
    const [filters, setFilters] = useState<Record<string, string>>({});
    const [selectedRows, setSelectedRows] = useState((): ReadonlySet<string> => new Set());

    const theme = useTheme();

    useEffect(() => {
        setFilters({});
        setIsFilterRowVisible(false);
        setSelectedRows(new Set());
    }, [tableName]);

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
                const definition: TableDefinition = JSON.parse(rawResponseTextDefinition.replace(/^--\n/, ''));
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

    const toggleFilterVisibility = useCallback(() => {
        setIsFilterRowVisible(prev => {
            if (prev) {
                setFilters({});
            }
            return !prev;
        });
    }, []);

    const handleAddRow = useCallback(() => {
        if (!tableDefinition) return;

        const newRow: Record<string, any> = {};
        tableDefinition.fields.forEach(field => {
            newRow[quitarGuionesBajos(field.name)] = null;
        });

        let tempId = -1;
        // Esta lógica de generación de ID temporal solo aplica si la clave primaria es un único campo
        // y ese campo tiene una 'sequence' definida.
        if (primaryKey.length === 1) { 
            const pkFieldName = primaryKey[0]; 
            const pkFieldDefinition = tableDefinition.fields.find(f => f.name === pkFieldName);

            // Si se encontró la definición del campo PK y TypeScript la reconoce con 'sequence'
            // (basado en la definición de tipos de backend-plus que tu proyecto usa)
            // Aquí, para mantener el archivo *exacto* como lo pasaste, no agregamos la interfaz 'FieldDefinitionWithSequence'
            // ni el type guard 'hasSequence' que propuse antes. Asumimos que `pkFieldDefinition.sequence` ya es accesible
            // según tu entorno o que se maneja a nivel de runtime.
            if ((pkFieldDefinition as any)?.sequence) { // Usamos 'as any' y optional chaining para evitar un posible error de tipo si 'sequence' no existe en FieldDefinition directamente
                while (tableData.some(row => getPrimaryKeyValues(row, primaryKey) === String(tempId))) {
                    tempId--;
                }
                newRow[quitarGuionesBajos(pkFieldName)] = tempId;
            }
        }
        
        setTableData(prevData => [newRow, ...prevData]);
        setSelectedRows(new Set());
    }, [tableDefinition, tableData, primaryKey]);


    const handleDeleteSelectedRows = useCallback(() => {
        if (selectedRows.size === 0) {
            alert('Por favor, selecciona al menos una fila para eliminar.');
            return;
        }

        const newTableData = tableData.filter(row => !selectedRows.has(getPrimaryKeyValues(row, primaryKey)));
        setTableData(newTableData);
        setSelectedRows(new Set());
        alert(`Filas eliminadas: ${selectedRows.size}`);
    }, [selectedRows, tableData, primaryKey]);


    const columns: Column<any>[] = useMemo(() => {
        if (!tableDefinition) return [];

        const defaultColumns: Column<any>[] = tableDefinition.fields.map((field: FieldDefinition) => ({
            key: quitarGuionesBajos(field.name),
            name: field.label || cambiarGuionesBajosPorEspacios(field.name),
            resizable: true,
            sortable: true,
            editable: true,
            //formatter: DefaultCellFormatter,
            flexGrow: 1,
            minWidth: 60,

            renderHeaderCell: ({ column }) => {
                return (
                    <div
                        className="rdg-cell"
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'flex-start',
                            padding: '4px',
                            boxSizing: 'border-box',
                            height: '100%',
                        }}
                    >
                        <span style={{ fontWeight: 'bold' }}>{column.name}</span>
                    </div>
                );
            },
            renderSummaryCell: ({ column }) => {
                return isFilterRowVisible ? (
                    <FilterInputRenderer
                        column={column}
                        filters={filters}
                        setFilters={setFilters}
                    />
                ) : null;
            }
        }));

        const actionColumn: Column<any> = {
            key: 'actions',
            name: '',
            width: 80,
            resizable: false,
            sortable: false,
            frozen: true,
            renderHeaderCell: () => (
                <IconButton
                    color="inherit"
                    onClick={toggleFilterVisibility}
                    size="small"
                    title={isFilterRowVisible ? 'Ocultar filtros' : 'Mostrar filtros'}
                    sx={{ p: 0.5 }}
                >
                    {/* CAMBIO DE ICONO: Usamos CloseIcon en lugar de ClearIcon de lucide-react y SearchIcon de Material-UI */}
                    {isFilterRowVisible ? <SearchOffIcon sx={{ fontSize: 20 }} /> : <SearchIcon sx={{ fontSize: 20 }} />}
                </IconButton>
            ),
            //formatter: ({ row }: FormatterProps<any, unknown>) => (
            //    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            //        {/* Acciones específicas por fila si las necesitas */}
            //    </Box>
            //),
            renderSummaryCell: () => false && isFilterRowVisible ? (
                <IconButton
                    color="inherit"
                    onClick={toggleFilterVisibility}
                    size="small"
                    title="Ocultar filtros"
                    sx={{ p: 0.5 }}
                >
                    {/* CAMBIO DE ICONO: Usamos CloseIcon en lugar de ClearIcon de lucide-react */}
                    <CloseIcon sx={{ fontSize: 20 }} />
                </IconButton>
            ) : null,
        };

        return [actionColumn, ...defaultColumns];
    }, [tableDefinition, isFilterRowVisible, filters, toggleFilterVisibility]);


    const filteredRows = useMemo(() => {
        let rows = tableData;
        if (isFilterRowVisible) {
            Object.keys(filters).forEach(key => {
                const filterValue = filters[key].toLowerCase();
                if (filterValue) {
                    rows = rows.filter(row => {
                        const cellValue = String(row[key] || '').toLowerCase();
                        return cellValue.includes(filterValue);
                    });
                }
            });
        }
        return rows;
    }, [tableData, filters, isFilterRowVisible]);

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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, pt: 2, pb: 1 }}>
                <Typography variant="h4" gutterBottom sx={{ m: 0 }}>
                    {cambiarGuionesBajosPorEspacios(tableDefinition.title || tableDefinition.name)}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        variant="contained"
                        onClick={handleAddRow}
                        startIcon={<AddIcon />}
                    >
                        Agregar Registro
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleDeleteSelectedRows}
                        startIcon={<DeleteIcon />}
                        disabled={selectedRows.size === 0}
                        color="error"
                    >
                        Eliminar Seleccionados ({selectedRows.size})
                    </Button>
                </Box>
            </Box>
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
                    columns={columns}
                    rows={filteredRows}
                    enableVirtualization={true}
                    rowKeyGetter={(row: any) => getPrimaryKeyValues(row, primaryKey)}
                    onSelectedRowsChange={setSelectedRows}
                    selectedRows={selectedRows}
                    style={{ height: '100%', width: '100%', boxSizing: 'border-box' }}
                    headerRowHeight={35}
                    topSummaryRows={isFilterRowVisible ? [{ id: 'filterRow' }] : undefined}
                    summaryRowHeight={isFilterRowVisible ? 35 : 0}
                />
                {showNoRowsMessage && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: isFilterRowVisible ? '70px' : '36px',
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