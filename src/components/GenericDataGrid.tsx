import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { DataGrid, Column, RowsChangeData, DataGridHandle, SelectCellOptions } from 'react-data-grid'; // Importamos DataGridHandle y SelectCellOptions
import 'react-data-grid/lib/styles.css';
import { TableDefinition, FieldDefinition } from "backend-plus";

import { useParams } from 'react-router-dom';
import { fetchApi } from '../utils/fetchApi';
import { CircularProgress, Typography, Box, Alert, useTheme, InputBase, Button, IconButton } from '@mui/material';
import { quitarGuionesBajos, cambiarGuionesBajosPorEspacios } from '../utils/functions';

import SearchIcon from '@mui/icons-material/Search';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

import { useSnackbar } from '../contexts/SnackbarContext';

/**
 * Genera una cadena única para identificar una fila basándose en sus valores de clave primaria.
 * Esto es crucial para `react-data-grid` y `ReadonlySet` de `selectedRows`.
 * Si la clave primaria es compuesta, los valores se concatenan con un separador.
 * @param row La fila de datos.
 * @param primaryKey Un array de nombres de campos que componen la clave primaria.
 * @returns Una cadena única que identifica la fila.
 */
const getPrimaryKeyValues = (row: Record<string, any>, primaryKey: string[]): string => {
    return primaryKey
        .map(key => {
            return row[key] !== undefined && row[key] !== null
                ? String(row[key])
                : 'NULL_OR_UNDEFINED';
        })
        .join('|');
};

interface GenericDataGridProps {
    // tableName: string;
}

interface FilterRendererProps<R extends Record<string, any>, S> {
    column: Column<R, S>;
    filters: Record<string, string>;
    setFilters: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

interface InputRendererProps<R extends Record<string, any>, S> {
    column: Column<R, S>,
    row: R,
    rowIdx: number;
    onRowChange: (row: R, commitChanges?: boolean) => void;
    onClose: (commitChanges?: boolean, shouldFocusCell?: boolean) => void;
    tableDefinition: TableDefinition,
    setCellFeedback: (feedback: CellFeedback | null) => void;
    onEnterPress?: (rowIndex: number, columnKey: string) => void; // Nueva prop
}

interface CellFeedback {
    rowId: string;
    columnKey: string;
    type: 'success' | 'error';
}

function FilterInputRenderer<R extends Record<string, any>, S>({
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

function InputRenderer<R extends Record<string, any>, S>({
    column,
    row,
    rowIdx,
    tableDefinition,
    onRowChange,
    onClose,
    setCellFeedback,
    onEnterPress
}: InputRendererProps<R, S>) {
    const tableName = tableDefinition.tableName!;
    const [value, setValue] = useState(row[column.key]);

    const { showSuccess, showError } = useSnackbar();

    useEffect(() => {
        setValue(row[column.key]);
    }, [row, column.key]);

    const handleCommit = useCallback(async (currentValue: any, closeEditor: boolean, focusNextCell: boolean) => {
        const processedNewValue = typeof currentValue === 'string'
            ? (currentValue.trim() === '' ? null : currentValue.trim())
            : currentValue;

        if (processedNewValue === row[column.key]) {
            console.log("No se guardó: el valor no cambió.");
            onClose(false, focusNextCell);
            return;
        }

        const primaryKeyValuesForBackend = tableDefinition.primaryKey.map(key => row[key]);
        const changedFields: Record<string, any> = {
            [column.key]: processedNewValue
        };
        const oldRowData = { ...row };
        const currentRowId = getPrimaryKeyValues(row, tableDefinition.primaryKey);

        onRowChange({ ...row, [column.key]: processedNewValue } as R, true);
        onClose(true, focusNextCell);

        try {
            const body = new URLSearchParams();
            body.append('table', tableName);
            body.append('primaryKeyValues', JSON.stringify(primaryKeyValuesForBackend));
            body.append('newRow', JSON.stringify(changedFields));
            body.append('oldRow', JSON.stringify(oldRowData));
            body.append('status', 'update');

            const response = await fetchApi(`/table_record_save`, {
                method: 'POST',
                body: body
            });

            if (!response.ok) {
                const errorText = await response.text();
                showError(`Error ${response.status}: ${errorText}`);
                setCellFeedback({ rowId: currentRowId, columnKey: column.key, type: 'error' });
                onRowChange(oldRowData as R, true);
                throw new Error(`Error al guardar el registro: ${response.status} - ${errorText}`);
            }
            const rawResponseTextData = await response.text();
            const jsonRespuesta = JSON.parse(rawResponseTextData.replace(/^--\n/, ''));

            if (jsonRespuesta.error) {
                showError(`Error ${jsonRespuesta.error.code}: ${jsonRespuesta.error.message}`);
                setCellFeedback({ rowId: currentRowId, columnKey: column.key, type: 'error' });
                onRowChange(oldRowData as R, true);
            } else {
                showSuccess('Registro guardado exitosamente!');
                setCellFeedback({ rowId: currentRowId, columnKey: column.key, type: 'success' });
            }

        } catch (err: any) {
            console.error('Error al guardar el registro:', err);
            showError(`Fallo inesperado al guardar: ${err.message || 'Error desconocido'}`);
            setCellFeedback({ rowId: currentRowId, columnKey: column.key, type: 'error' });
            onRowChange(oldRowData as R, true);
        }
    }, [column, row, onRowChange, tableName, tableDefinition.primaryKey, showSuccess, showError, setCellFeedback, onClose]);

    const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
            handleCommit(value, true, true);
            event.preventDefault();

            if (onEnterPress) {
                onEnterPress(rowIdx, column.key);
            }
        } else if (event.key === 'Tab') {
            handleCommit(value, true, true);
        }
    }, [handleCommit, value, column.key, rowIdx, onEnterPress]);

    const handleBlur = useCallback(() => {
        handleCommit(value, true, false);
    }, [handleCommit, value]);

    const fieldDefinition = tableDefinition.fields.find(f => f.name === column.key);
    const isFieldEditable = fieldDefinition?.editable !== false;

    const backgroundColor = 'transparent';

    return (
        <InputBase
            value={value === null ? '' : value}
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
            disabled={!isFieldEditable}
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
    const [cellFeedback, setCellFeedback] = useState<CellFeedback | null>(null);
    const theme = useTheme();

    const { showSuccess, showError, showWarning, showInfo } = useSnackbar();

    const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);
    const dataGridRef = useRef<DataGridHandle>(null);

    useEffect(() => {
        setFilters({});
        setIsFilterRowVisible(false);
        setSelectedRows(new Set());
        setError(null);
        setTableDefinition(null);
        setTableData([]);
        setCellFeedback(null);
        if (feedbackTimerRef.current) {
            clearTimeout(feedbackTimerRef.current);
        }
    }, [tableName]);

    useEffect(() => {
        if (!tableName) {
            showError("Nombre de tabla no especificado en la URL.");
            setLoading(false);
            return;
        }

        const fetchDataAndDefinition = async () => {
            setLoading(true);
            setError(null);

            try {
                const bodyStructure = new URLSearchParams({ table: tableName });
                const responseDefinition = await fetchApi(`/table_structure`, {
                    method: 'POST',
                    body: bodyStructure
                });

                if (!responseDefinition.ok) {
                    const errorText = await responseDefinition.text();
                    showError(`Error al cargar la estructura de la tabla '${tableName}': ${responseDefinition.status} - ${errorText}`);
                    setError(`Error al cargar la estructura de la tabla: ${responseDefinition.status} - ${errorText}`);
                    throw new Error(`Error al cargar la estructura de la tabla '${tableName}'`);
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
                    showError(`Error al cargar datos de '${tableName}': ${responseData.status} - ${errorText}`);
                    setError(`Error al cargar datos de la tabla: ${responseData.status} - ${errorText}`);
                    throw new Error(`Error al cargar datos de '${tableName}'`);
                }
                const rawResponseTextData = await responseData.text();
                const data = JSON.parse(rawResponseTextData.replace(/^--\n/, ''));
                setTableData(data);
            } catch (err: any) {
                console.error('Error general al cargar tabla:', err);
                setError(`Error al cargar la tabla: ${err.message || 'Error desconocido'}`);
                setTableDefinition(null);
                setTableData([]);
            } finally {
                setLoading(false);
            }
        };

        fetchDataAndDefinition();
    }, [tableName, showError]);

    useEffect(() => {
        if (cellFeedback) {
            if (feedbackTimerRef.current) {
                clearTimeout(feedbackTimerRef.current);
            }
            feedbackTimerRef.current = setTimeout(() => {
                setCellFeedback(null);
            }, 3000);
        }
        return () => {
            if (feedbackTimerRef.current) {
                clearTimeout(feedbackTimerRef.current);
            }
        };
    }, [cellFeedback]);


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
        if (!tableDefinition) {
            showWarning('No se puede agregar una fila sin la definición de la tabla.');
            return;
        }

        const newRow: Record<string, any> = {};
        tableDefinition.fields.forEach(field => {
            newRow[field.name] = null;
        });

        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        newRow[primaryKey[0]] = tempId;
        setTableData(prevData => [newRow, ...prevData]);
        setSelectedRows(new Set());
        showSuccess('Nueva fila agregada localmente.');
    }, [tableDefinition, primaryKey, showWarning, showSuccess]);


    const handleDeleteSelectedRows = useCallback(async () => {
        if (selectedRows.size === 0) {
            showWarning('Por favor, selecciona al menos una fila para eliminar.');
            return;
        }

        if (!tableDefinition || !tableName) {
            showError('No se puede eliminar filas sin la definición de la tabla o el nombre de la tabla.');
            return;
        }

        const rowsToDelete: any[] = [];
        tableData.forEach(row => {
            if (selectedRows.has(getPrimaryKeyValues(row, primaryKey))) {
                rowsToDelete.push(row);
            }
        });

        if (rowsToDelete.length === 0) {
            showWarning('No se encontraron filas válidas seleccionadas para eliminar.');
            return;
        }

        try {
            const body = new URLSearchParams();
            body.append('table', tableName);
            body.append('rowsToDelete', JSON.stringify(rowsToDelete));
            body.append('status', 'delete');

            const response = await fetchApi(`/table_record_delete`, {
                method: 'POST',
                body: body
            });

            if (!response.ok) {
                const errorText = await response.text();
                showError(`Error ${response.status}: ${errorText}`);
                throw new Error(`Error al eliminar las filas: ${response.status} - ${errorText}`);
            }

            const message = await response.text();
            console.log('Backend response:', message);
            showSuccess(`Filas eliminadas exitosamente: ${selectedRows.size}`);

            const newTableData = tableData.filter(row => !selectedRows.has(getPrimaryKeyValues(row, primaryKey)));
            setTableData(newTableData);
            setSelectedRows(new Set());

        } catch (err: any) {
            console.error('Error al eliminar filas:', err);
            showError(`Fallo inesperado al eliminar: ${err.message || 'Error desconocido'}`);
        }
    }, [selectedRows, tableData, primaryKey, tableName, tableDefinition, showWarning, showError, showSuccess]);

    // filteredRows se define aquí, antes de handleEnterKeyPressInEditor y columns
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

    // handleEnterKeyPressInEditor necesita acceso a `columns` y `filteredRows`
    // Para que `columns` esté disponible, la pasaremos como argumento
    const handleEnterKeyPressInEditor = useCallback((rowIndex: number, columnKey: string, currentColumns: Column<any>[]) => {
        if (dataGridRef.current && tableDefinition) {
            const currentColumnIndex = currentColumns.findIndex((col: Column<any>) => col.key === columnKey);

            if (currentColumnIndex !== -1) {
                let nextColumnIndex = currentColumnIndex + 1;
                let nextRowIndex = rowIndex;

                let foundNextTarget = false;
                while (!foundNextTarget) {
                    if (nextColumnIndex >= currentColumns.length) {
                        nextColumnIndex = 0; // Vuelve a la primera columna
                        nextRowIndex++; // Salta a la siguiente fila

                        if (nextRowIndex >= filteredRows.length) {
                            nextRowIndex = 0;
                            nextColumnIndex = 0;
                            // Si se llega al final de la grilla y se vuelve al principio,
                            // podemos considerar salir del bucle si ya no hay más celdas.
                            // Esto evita bucles infinitos en tablas vacías o con una sola fila.
                            if (filteredRows.length === 0 || (rowIndex === 0 && currentColumnIndex === currentColumns.length -1)) {
                                foundNextTarget = true; // Salimos del bucle si ya recorrimos todo
                                break; // Salimos del while
                            }
                        }
                    }

                    const nextColumn = currentColumns[nextColumnIndex];
                    const isEditableField = tableDefinition.fields.find(f => f.name === nextColumn.key)?.editable !== false;

                    // Si es la columna de acciones o no es editable, avanzamos
                    if (nextColumn.key !== 'actions' && isEditableField) {
                        foundNextTarget = true;
                    } else {
                        nextColumnIndex++;
                    }
                }
                
                // Mueve el foco a la celda. Esto NO inicia la edición automáticamente.
                dataGridRef.current.selectCell({ rowIdx: nextRowIndex, idx: nextColumnIndex }, { enableEditor: false, scrollIntoView: true } as SelectCellOptions); 
            }
        }
    }, [filteredRows, tableDefinition]); // Dependencias: filteredRows, tableDefinition

    const columns: Column<any>[] = useMemo(() => {
        if (!tableDefinition) return [];

        const defaultColumns: Column<any>[] = tableDefinition.fields.map((field: FieldDefinition) => {
            const isFieldEditable = field.editable !== false;

            return {
                key: field.name,
                name: field.label || cambiarGuionesBajosPorEspacios(field.name),
                resizable: true,
                sortable: true,
                editable: isFieldEditable,
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
                renderCell: (props) => {
                    const rowId = getPrimaryKeyValues(props.row, primaryKey);
                    const isFeedbackCell = cellFeedback && cellFeedback.rowId === rowId && cellFeedback.columnKey === props.column.key;
                    const backgroundColor = isFeedbackCell
                        ? (cellFeedback?.type === 'success' ? theme.palette.success.light : theme.palette.error.light)
                        : 'transparent';

                    return (
                        <div
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                backgroundColor: backgroundColor,
                                transition: 'background-color 0.3s ease-in-out',
                                display: 'flex',
                                alignItems: 'center',
                                paddingLeft: '8px',
                                boxSizing: 'border-box',
                            }}
                        >
                            {props.row[props.column.key] === null ? '' : props.row[props.column.key]}
                        </div>
                    );
                },
                // renderEditCell se definirá en el paso final
            };
        });

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
                null
            ) : null,
        };

        const allColumns = [actionColumn, ...defaultColumns];

        // Mapea de nuevo para agregar renderEditCell después de que `handleEnterKeyPressInEditor` esté definido.
        return allColumns.map(col => {
            if (col.editable) {
                return {
                    ...col,
                    renderEditCell: (props) => {
                        const fieldDefinition = tableDefinition.fields.find(f => f.name === props.column.key);
                        const isFieldEditable = fieldDefinition?.editable !== false;
                        if (!isFieldEditable) return null;
                        return (
                            <InputRenderer
                                {...props}
                                tableDefinition={tableDefinition}
                                setCellFeedback={setCellFeedback}
                                // Aquí pasamos 'columns' para que handleEnterKeyPressInEditor tenga la lista completa
                                onEnterPress={(rowIndex, columnKey) => handleEnterKeyPressInEditor(rowIndex, columnKey, allColumns)}
                            />
                        );
                    }
                };
            }
            return col;
        });

    }, [tableDefinition, isFilterRowVisible, filters, toggleFilterVisibility, cellFeedback, primaryKey, theme.palette.success.light, theme.palette.error.light, handleEnterKeyPressInEditor]); // Dependencia de handleEnterKeyPressInEditor

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
                    ref={dataGridRef}
                    columns={columns}
                    rows={filteredRows}
                    enableVirtualization={true}
                    rowKeyGetter={(row: any) => getPrimaryKeyValues(row, primaryKey)}
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