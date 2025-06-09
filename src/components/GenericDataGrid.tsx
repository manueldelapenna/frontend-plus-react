import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DataGrid, Column } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import { TableDefinition, FieldDefinition } from "backend-plus"; 

import { useParams } from 'react-router-dom';
import { fetchApi } from '../utils/fetchApi';
import { CircularProgress, Typography, Box, Alert, useTheme, InputBase, Button, IconButton } from '@mui/material';
import { quitarGuionesBajos, cambiarGuionesBajosPorEspacios } from '../utils/functions';

import SearchIcon from '@mui/icons-material/Search';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

import { useSnackbar } from '../contexts/SnackbarContext'; // ¡Importa el hook!


//investigar mejor para ver como tiene que andar en la grilla
const getPrimaryKeyValues = (row: any, primaryKey: string[]): any => {
    // CORRECCIÓN: getPrimaryKeyValues debería devolver un string único
    // para usarlo con ReadonlySet de selectedRows.
    // Opcional: concatenar valores de PK con un separador si la PK es compuesta.
    return primaryKey.map(key => row[quitarGuionesBajos(key)]).join('|');
};

interface GenericDataGridProps {
    // tableName: string;
}

interface FilterRendererProps<R, S> {
    column: Column<R, S>;
    filters: Record<string, string>;
    setFilters: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

interface InputRendererProps<R, S> {
    column: Column<R, S>,
    row: any,
    rowIdx: number;
    onRowChange: (row: R, commitChanges?: boolean) => void;
    onClose: (commitChanges?: boolean, shouldFocusCell?: boolean) => void;
    tableDefinition:TableDefinition,
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

function InputRenderer<R, S>({
    column,
    row,
    tableDefinition,
    rowIdx,
    onRowChange,
    onClose,
}: InputRendererProps<R, S>) {
    const tableName = tableDefinition.tableName!;
    const [value, setValue] = useState(row[column.key]);
    
    // Aquí inicializamos el hook de snackbar
    const { showSuccess, showError, showWarning, showInfo } = useSnackbar();

    useEffect(() => {
        setValue(row[column.key]);
    }, [row, column.key]);

    const handleCommit = useCallback(async (currentValue: any, closeEditor: boolean, focusNextCell: boolean) => {
        
        const processedNewValue = typeof currentValue === 'string' 
            ? (currentValue.trim() === '' ? null : currentValue.trim())
            : currentValue;
                    
        if (processedNewValue === row[column.key]) { // Usamos processedNewValue para la comparación
            console.log("no guardo, son iguales");
            onClose(false, focusNextCell);
            return;
        }

        // Obtener los valores de la clave primaria.
        // Asegúrate de que los nombres de las claves primarias coincidan con los nombres originales del backend
        // (es decir, sin quitar guiones bajos si el backend los espera así para las PKs)
        const primaryKeyValuesForBackend = tableDefinition.primaryKey.map(key => row[key]);

        // *** CAMBIO CLAVE AQUÍ: Crear un objeto con solo los campos modificados (y la PK si la necesitas para el backend) ***
        const changedFields: Record<string, any> = {
            [column.key]: processedNewValue
        };

        const oldRowData = { ...row }; // Mantén oldRowData como la fila completa si tu backend lo necesita para validaciones
        // Para newRow, si el backend solo necesita los cambios puntuales:
        // const newRowData = changedFields;
        // Si el backend aún necesita la fila completa para ciertos casos, pero quieres enviar solo los cambios:
        // podrías enviar 'changedFields' en un parámetro adicional.
        // Para este escenario, seguiremos enviando la fila completa actualizada, pero nos aseguraremos de que
        // `table_record_save` en el backend sepa cómo manejar solo los cambios.
        // Sin embargo, si quieres que 'newRow' SÓLO contenga los cambios, entonces:
        // const newRowData = changedFields; // Este es el cambio más directo a tu petición

        try {
            const body = new URLSearchParams();
            body.append('table', tableName);
            body.append('primaryKeyValues', JSON.stringify(primaryKeyValuesForBackend));
            body.append('newRow', JSON.stringify(changedFields)); // Ahora newRowData solo tiene el campo cambiado
            body.append('oldRow', JSON.stringify(oldRowData)); // oldRowData sigue siendo la fila completa original
            body.append('status', 'update');

            const response = await fetchApi(`/table_record_save`, {
                method: 'POST',
                body: body
            });

            if (!response.ok) {
                const errorText = await response.text();
                showError(`Error al guardar el registro: ${response.status} - ${errorText}`);
                throw new Error(`Error al guardar el registro: ${response.status} - ${errorText}`);
            }
            const rawResponseTextData = await response.text();
            const jsonRespuesta = JSON.parse(rawResponseTextData.replace(/^--\n/, ''));
            if(jsonRespuesta.error){
                showError(`Error ${jsonRespuesta.error.code}. ${jsonRespuesta.error.message}.`);
            } else {
                // Si la respuesta del backend incluye la fila completa actualizada, úsala.
                // Si no, asume que tu `updatedRow` local es suficiente.
                showSuccess('Registro guardado exitosamente!');
                onRowChange({ ...row, [column.key]: processedNewValue } as R, true); // Actualiza la fila localmente con el nuevo valor
            }
            if (closeEditor) {
                onClose(true, focusNextCell);
            }

        } catch (err: any) {
            console.error('Error al guardar el registro:', err);
            showError(`Fallo inesperado al guardar: ${err.message || 'Error desconocido'}`);
            onClose(false, focusNextCell);
        }
    }, [column, row, onRowChange, onClose, tableName, tableDefinition.primaryKey, showSuccess, showError]);

    const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
            handleCommit(value, true, true);
            event.preventDefault();
        }
    }, [handleCommit, value]);

    const handleBlur = useCallback(() => {
        handleCommit(value, true, false);
    }, [handleCommit, value]);

    return (
        <InputBase
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={''}
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
            autoFocus
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
    
    // Aquí inicializamos el hook de snackbar
    const { showSuccess, showError, showWarning, showInfo } = useSnackbar();

    useEffect(() => {
        setFilters({});
        setIsFilterRowVisible(false);
        setSelectedRows(new Set());
    }, [tableName]);

    useEffect(() => {
        if (!tableName) {
            // Reemplaza setError con showError para un feedback más integrado
            showError("Nombre de tabla no especificado en la URL."); 
            setLoading(false);
            return;
        }

        const fetchDataAndDefinition = async () => {
            setLoading(true);
            setError(null); // Puedes mantener este setError si aún quieres un mensaje grande en la UI, pero el snackbar es el feedback principal
            setTableDefinition(null);
            setTableData([]);

            try {
                const bodyStructure = new URLSearchParams({ table: tableName });
                const responseDefinition = await fetchApi(`/table_structure`, {
                    method: 'POST',
                    body: bodyStructure
                });

                if (!responseDefinition.ok) {
                    const errorText = await responseDefinition.text();
                    // Utiliza showError aquí
                    showError(`Error al cargar la estructura de la tabla '${tableName}': ${responseDefinition.status} - ${errorText}`);
                    throw new Error(`Error al cargar la estructura de la tabla '${tableName}': ${responseDefinition.status} - ${errorText}`);
                }
                const rawResponseTextDefinition = await responseDefinition.text();
                const definition: TableDefinition = JSON.parse(rawResponseTextDefinition.replace(/^--\n/, ''));
                setTableDefinition(definition);

                const bodyDefinition = new URLSearchParams({ table: tableName });
                const responseData = await fetchApi(`/table_data`, {
                    method: 'POST',
                    body: bodyDefinition
                });

                if (!responseData.ok) {
                    const errorText = await responseData.text();
                    // Utiliza showError aquí
                    showError(`Error al cargar datos de '${tableName}': ${responseData.status} - ${errorText}`);
                    throw new Error(`Error al cargar datos de '${tableName}': ${responseData.status} - ${errorText}`);
                }
                const rawResponseTextData = await responseData.text();
                const data = JSON.parse(rawResponseTextData.replace(/^--\n/, ''));
                setTableData(data);
            } catch (err: any) {
                console.error('Error al cargar datos de la tabla:', err);
                // Ya se llamó a showError si es un error de fetch, pero puedes mantener el setError si tienes un componente Alert
                // que muestra este `error` de forma permanente en la UI.
                setError(`Error al cargar la tabla: ${err.message || 'Error desconocido'}`); // Mantiene el Alert visible si quieres
                setTableDefinition(null);
                setTableData([]);
            } finally {
                setLoading(false);
            }
        };

        fetchDataAndDefinition();
    }, [tableName, showError, showSuccess]); // Asegúrate de incluir los métodos del snackbar en las dependencias

    const primaryKey = useMemo(() => {
        if (!tableDefinition) return ['id'];
        return tableDefinition.primaryKey || ['id'];
    }, [tableDefinition]);

    const toggleFilterVisibility = useCallback(() => {
        setIsFilterRowVisible(prev => {
            if (prev) {
                setFilters({});
                showInfo('Filtros limpiados y ocultados.'); // Mensaje al ocultar filtros
            } else {
                showInfo('Filtros mostrados.'); // Mensaje al mostrar filtros
            }
            return !prev;
        });
    }, [showInfo]); // Añade showInfo a las dependencias

    const handleAddRow = useCallback(() => {
        if (!tableDefinition) {
            showWarning('No se puede agregar una fila sin la definición de la tabla.'); // Mensaje de advertencia
            return;
        }

        const newRow: Record<string, any> = {};
        tableDefinition.fields.forEach(field => {
            newRow[quitarGuionesBajos(field.name)] = null;
        });
        
        // Lógica para ID temporal si es necesario
        if (primaryKey.length === 1) { 
            const pkFieldName = primaryKey[0]; 
            const pkFieldDefinition = tableDefinition.fields.find(f => f.name === pkFieldName);
            if ((pkFieldDefinition as any)?.sequence) { 
                // Aquí, si generas un ID temporal, quizás quieras mostrar un info:
                showInfo('Nueva fila agregada con un ID temporal. Guarda para persistir.');
            }
        }
        
        setTableData(prevData => [newRow, ...prevData]);
        setSelectedRows(new Set());
        showSuccess('Nueva fila agregada localmente.'); // Mensaje de éxito
    }, [tableDefinition, primaryKey, showWarning, showInfo, showSuccess]); // Añade métodos del snackbar a las dependencias


    const handleDeleteSelectedRows = useCallback(async () => {
        if (selectedRows.size === 0) {
            showWarning('Por favor, selecciona al menos una fila para eliminar.');
            return;
        }

        if (!tableDefinition) {
            showError('No se puede eliminar filas sin la definición de la tabla.');
            return;
        }

        // Obtener los valores de la clave primaria de las filas seleccionadas
        const primaryKeyValuesToDelete: any[] = [];
        const rowsToDelete: any[] = [];
        tableData.forEach(row => {
            const pkValue = getPrimaryKeyValues(row, primaryKey);
            if (selectedRows.has(pkValue)) {
                primaryKeyValuesToDelete.push(row); // Envía la fila completa o solo la PK
                rowsToDelete.push(row);
            }
        });

        if (primaryKeyValuesToDelete.length === 0) {
            showWarning('No se encontraron filas seleccionadas para eliminar.');
            return;
        }

        try {
            const body = new URLSearchParams();
            body.append('table', tableName!); // tableName no será nulo aquí
            body.append('rowsToDelete', JSON.stringify(rowsToDelete)); // Envía las filas o un identificador claro
            body.append('status', 'delete');

            const response = await fetchApi(`/table_record_delete`, {
                method: 'POST',
                body: body
            });

            if (!response.ok) {
                const errorText = await response.text();
                showError(`Error al eliminar las filas: ${response.status} - ${errorText}`);
                throw new Error(`Error al eliminar las filas: ${response.status} - ${errorText}`);
            }

            const message = await response.text();
            console.log('Filas eliminadas exitosamente:', message);
            showSuccess(`Filas eliminadas exitosamente: ${selectedRows.size}`);

            const newTableData = tableData.filter(row => !selectedRows.has(getPrimaryKeyValues(row, primaryKey)));
            setTableData(newTableData);
            setSelectedRows(new Set());

        } catch (err: any) {
            console.error('Error al eliminar filas:', err);
            showError(`Fallo inesperado al eliminar: ${err.message || 'Error desconocido'}`);
        }
    }, [selectedRows, tableData, primaryKey, tableName, tableDefinition, showWarning, showError, showSuccess]);


    const columns: Column<any>[] = useMemo(() => {
        if (!tableDefinition) return [];

        const defaultColumns: Column<any>[] = tableDefinition.fields.map((field: FieldDefinition) => ({
            key: quitarGuionesBajos(field.name),
            name: field.label || cambiarGuionesBajosPorEspacios(field.name),
            resizable: true,
            sortable: true,
            editable: true, // asumiendo que siempre es editable para usar tu InputRenderer
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
            },
            renderEditCell: field.editable ? (props) => <InputRenderer {...props} tableDefinition={tableDefinition} /> : undefined,
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
                    {isFilterRowVisible ? <SearchOffIcon sx={{ fontSize: 20 }} /> : <SearchIcon sx={{ fontSize: 20 }} />}
                </IconButton>
            ),
            renderSummaryCell: () => false && isFilterRowVisible ? (
                <IconButton
                    color="inherit"
                    onClick={toggleFilterVisibility}
                    size="small"
                    title="Ocultar filtros"
                    sx={{ p: 0.5 }}
                >
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
    
    const handleRowsChange = useCallback((updatedRows: any[]) => {
        setTableData(updatedRows);
    }, []);

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <CircularProgress />
                <Typography variant="h6" sx={{ ml: 2 }}>Cargando tabla...</Typography>
            </Box>
        );
    }

    if (error) {
        // Aquí puedes decidir si quieres que el error se muestre solo en el snackbar
        // o si quieres mantener el Alert grande en la UI.
        // Si lo mantienes, el usuario verá ambos.
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <Alert severity="error">{error}</Alert>
            </Box>
        );
    }

    if (!tableDefinition) {
        // Similar al caso anterior, si quieres un mensaje grande además del snackbar.
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
                        onClick={handleDeleteSelectedRows} // Habilitamos el onClick aquí
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
                    rowKeyGetter={(row: any) => getPrimaryKeyValues(row, primaryKey)} // Asegúrate de que esto funcione con tu getPrimaryKeyValues
                    onSelectedRowsChange={setSelectedRows}
                    onRowsChange={handleRowsChange}
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
                            left: theme => theme.spacing(2),
                            right: theme => theme.spacing(2),
                            bottom: theme => theme.spacing(2),
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