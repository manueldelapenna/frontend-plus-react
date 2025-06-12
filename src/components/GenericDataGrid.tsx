import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { DataGrid, Column, RowsChangeData, DataGridHandle, SelectCellOptions, CellKeyDownArgs, CellMouseArgs } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import { TableDefinition, FieldDefinition } from "backend-plus";

import { useParams } from 'react-router-dom';
import { useApiCall } from '../hooks/useApiCall';
import {
    CircularProgress, Typography, Box, Alert, useTheme, InputBase, Button, IconButton,
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle
} from '@mui/material';
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
                : 'NULL_OR_UNDEFINED'; // Usar un indicador para nulos o indefinidos en PK
        })
        .join('|');
};

interface GenericDataGridProps {
    // tableName: string; // Comentado según tu código original
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
    onEnterPress?: (rowIndex: number, columnKey: string) => void;
    setTableData: React.Dispatch<React.SetStateAction<any[]>>;
    setLocalCellChanges: React.Dispatch<React.SetStateAction<Map<string, Set<string>>>>;
    localCellChanges: Map<string, Set<string>>; // Añadido como prop
    primaryKey: string[];
}

interface CellFeedback {
    rowId: string;
    columnKey: string | null;
    type: 'success' | 'error';
}

const NEW_ROW_INDICATOR = '.$new'; // Indicador para nuevas filas que aún no están en la base de datos

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
    onEnterPress,
    setTableData,
    setLocalCellChanges,
    localCellChanges,
    primaryKey
}: InputRendererProps<R, S>) {
    const tableName = tableDefinition.tableName!;
    const [editingValue, setEditingValue] = useState(row[column.key]);

    const { showSuccess, showError } = useSnackbar();

    const initialRowId = useMemo(() => getPrimaryKeyValues(row, primaryKey), [row, primaryKey]);
    const { callApi, loading, error } = useApiCall();
    const handleCommit = useCallback(async (currentValue: any, closeEditor: boolean, focusNextCell: boolean) => {
        const processedNewValue = typeof currentValue === 'string'
            ? (currentValue.trim() === '' ? null : currentValue.trim())
            : currentValue;

        const potentialUpdatedRow = { ...row, [column.key]: processedNewValue } as R;

        const arePKValuesFilled = tableDefinition.primaryKey.every(key =>
            potentialUpdatedRow[key] !== undefined && potentialUpdatedRow[key] !== null && String(potentialUpdatedRow[key]).trim() !== ''
        );
        const isNewRow = !arePKValuesFilled || potentialUpdatedRow[NEW_ROW_INDICATOR];

        const isMandatoryField = tableDefinition.primaryKey.includes(column.key) || (tableDefinition.fields.find(f => f.name === column.key)?.nullable === false);
        const isMandatoryFieldEmpty = isNewRow && isMandatoryField && (processedNewValue === null || processedNewValue === undefined || String(processedNewValue).trim() === '');

        if (processedNewValue === row[column.key] && !isNewRow && !isMandatoryFieldEmpty) {
            console.log("No se guardó: el valor no cambió (y no es una nueva fila o campo obligatorio vacío que se está iniciando).");
            onClose(false, focusNextCell);
            setLocalCellChanges(prev => {
                const newMap = new Map(prev);
                const columnKeys = newMap.get(initialRowId);
                if (columnKeys) {
                    columnKeys.delete(column.key);
                    if (columnKeys.size === 0) {
                        newMap.delete(initialRowId);
                    } else {
                        newMap.set(initialRowId, columnKeys);
                    }
                }
                return newMap;
            });
            return;
        }

        const oldRowData = { ...row };
        const primaryKeyValuesForBackend = tableDefinition.primaryKey.map(key => potentialUpdatedRow[key]);
        const currentRowIdBeforeUpdate = getPrimaryKeyValues(row, tableDefinition.primaryKey);

        onRowChange({ ...row, [column.key]: processedNewValue } as R, true);
        onClose(true, focusNextCell);

        if (isNewRow) {
            const areAllMandatoryFieldsFilled = tableDefinition.fields.every(fieldDef => {
                const isMandatory = (fieldDef.nullable === false || fieldDef.isPk);
                const fieldValue = potentialUpdatedRow[fieldDef.name];
                return !isMandatory || (fieldValue !== null && fieldValue !== undefined && String(fieldValue).trim() !== '');
            });

            if (!areAllMandatoryFieldsFilled) {
                console.log("Nueva fila: Faltan campos obligatorios. No se guarda en el backend todavía.");
                setLocalCellChanges(prev => {
                    const newMap = new Map(prev);
                    const currentColumnsInRow = newMap.get(initialRowId) || new Set();

                    tableDefinition.fields.forEach(fieldDef => {
                        const isMandatory = (fieldDef.nullable === false || fieldDef.isPk);
                        const isEditable = fieldDef.editable !== false;
                        const fieldValue = potentialUpdatedRow[fieldDef.name];
                        if (isMandatory && isEditable && (fieldValue === null || fieldValue === undefined || String(fieldValue).trim() === '')) {
                            currentColumnsInRow.add(fieldDef.name);
                        } else {
                            currentColumnsInRow.delete(fieldDef.name);
                        }
                    });
                    newMap.set(initialRowId, currentColumnsInRow);
                    return newMap;
                });
                return;
            } else {
                console.log("Nueva fila: Todos los campos obligatorios están llenos. Procediendo a guardar.");
                setLocalCellChanges(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(initialRowId);
                    return newMap;
                });
            }
        }
      
        const status = isNewRow ? 'new' : 'update';
        let rowToSend: Record<string, any> = {};
        if (isNewRow) {
            tableDefinition.fields.forEach(fieldDef => {
                const fieldValue = potentialUpdatedRow[fieldDef.name];
                if (fieldValue !== undefined && fieldValue !== null && String(fieldValue).trim() !== '') {
                    rowToSend[fieldDef.name] = fieldValue;
                } else if (tableDefinition.primaryKey.includes(fieldDef.name) && (fieldValue === null || fieldValue === undefined || String(fieldValue).trim() === '')) {
                    rowToSend[fieldDef.name] = fieldValue;
                }
            });
            if (localCellChanges.has(initialRowId)) {
                localCellChanges.get(initialRowId)?.forEach((colKey: string) => {
                    if (!rowToSend.hasOwnProperty(colKey)) {
                        rowToSend[colKey] = potentialUpdatedRow[colKey];
                    }
                });
            }
            delete rowToSend[NEW_ROW_INDICATOR];
        } else {
            rowToSend[column.key] = processedNewValue;
            tableDefinition.primaryKey.forEach(pkField => {
                rowToSend[pkField] = potentialUpdatedRow[pkField];
            });
        }
        try {
            const response = await callApi('table_record_save',{
                table:tableName,
                primaryKeyValues: primaryKeyValuesForBackend,
                newRow: rowToSend,
                oldRow: oldRowData,
                status
            });

            setLocalCellChanges(prev => {
                const newMap = new Map(prev);
                const columnKeys = newMap.get(initialRowId);
                if (columnKeys) {
                    columnKeys.delete(column.key);
                    if (columnKeys.size === 0) {
                        newMap.delete(initialRowId);
                    } else {
                        newMap.set(initialRowId, columnKeys);
                    }
                }
                return newMap;
            });
            showSuccess('Registro guardado exitosamente!');
            let finalRowIdForFeedback: string;
            let persistedRowData: R;

            if (response.row && isNewRow) {
                persistedRowData = { ...response.row };
                setTableData(prevData => {
                    const newData = [...prevData];
                    const originalRowId = getPrimaryKeyValues(oldRowData, tableDefinition.primaryKey);
                    const rowIndex = newData.findIndex(r => getPrimaryKeyValues(r, tableDefinition.primaryKey) === originalRowId);
                    if (rowIndex !== -1) {
                        newData[rowIndex] = persistedRowData;
                    } else {
                        console.warn("Fila no encontrada para actualizar después de la inserción. Podría haber un problema de sincronización.");
                        const newPrimaryKeyId = getPrimaryKeyValues(persistedRowData, tableDefinition.primaryKey);
                        const newRowIndex = newData.findIndex(r => getPrimaryKeyValues(r, tableDefinition.primaryKey) === newPrimaryKeyId);
                        if (newRowIndex !== -1) {
                            newData[newRowIndex] = persistedRowData;
                        }
                    }
                    return newData;
                });
                finalRowIdForFeedback = getPrimaryKeyValues(persistedRowData, tableDefinition.primaryKey);
            } else {
                persistedRowData = potentialUpdatedRow;
                const isPrimaryKeyColumn = tableDefinition.primaryKey.includes(column.key);
                finalRowIdForFeedback = isPrimaryKeyColumn
                    ? getPrimaryKeyValues(potentialUpdatedRow, tableDefinition.primaryKey)
                    : currentRowIdBeforeUpdate;
            }
            setCellFeedback({ rowId: finalRowIdForFeedback, columnKey: column.key, type: 'success' });
        } catch (err: any) {
            console.error('Error al guardar el registro:', err);
            setCellFeedback({ rowId: currentRowIdBeforeUpdate, columnKey: column.key, type: 'error' });
            onRowChange(oldRowData as R, true);
        }
    }, [
        column, row, onRowChange, tableName, tableDefinition.primaryKey,
        tableDefinition.fields, showSuccess, showError, setCellFeedback, onClose,
        setTableData, setLocalCellChanges, localCellChanges, initialRowId
    ]);

    const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
            handleCommit(editingValue, true, true);
            event.preventDefault();

            if (onEnterPress) {
                onEnterPress(rowIdx, column.key);
            }
        } else if (event.key === 'Tab') {
            handleCommit(editingValue, true, true);
        }
    }, [handleCommit, editingValue, column.key, rowIdx, onEnterPress]);

    const handleBlur = useCallback(() => {
        handleCommit(editingValue, true, false);
    }, [handleCommit, editingValue]);

    const fieldDefinition = tableDefinition.fields.find(f => f.name === column.key);
    const isFieldEditable = fieldDefinition?.editable !== false;

    return (
        <InputBase
            value={editingValue === null ? '' : editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
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

// Nuevo componente para el diálogo de confirmación
interface ConfirmDialogProps {
    open: boolean;
    onClose: (confirm: boolean) => void;
    title: string;
    message: string;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ open, onClose, title, message }) => {
    return (
        <Dialog
            open={open}
            onClose={() => onClose(false)}
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-description"
        >
            <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>
            <DialogContent>
                <DialogContentText id="confirm-dialog-description">
                    {message}
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => onClose(false)} color="primary">
                    Cancelar
                </Button>
                <Button onClick={() => onClose(true)} color="error" autoFocus>
                    Confirmar
                </Button>
            </DialogActions>
        </Dialog>
    );
};


const GenericDataGrid: React.FC<GenericDataGridProps> = () => {
    const { tableName } = useParams<{ tableName?: string }>();
    const [tableDefinition, setTableDefinition] = useState<TableDefinition | null>(null);
    const [tableData, setTableData] = useState<any[]>([]);
    const [isFilterRowVisible, setIsFilterRowVisible] = useState<boolean>(false);
    const [filters, setFilters] = useState<Record<string, string>>({});
    const [selectedRows, setSelectedRows] = useState((): ReadonlySet<string> => new Set());
    const [cellFeedback, setCellFeedback] = useState<CellFeedback | null>(null);
    const [localCellChanges, setLocalCellChanges] = useState<Map<string, Set<string>>>(new Map());
    const theme = useTheme();

    // Estados para el diálogo de confirmación
    const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
    const [rowToDelete, setRowToDelete] = useState<any | null>(null);
    // Nuevo estado para controlar las filas que están en proceso de transición de salida
    const [exitingRowIds, setExitingRowIds] = useState<Set<string>>(new Set());

    const { showSuccess, showError, showWarning, showInfo } = useSnackbar();

    const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);
    const dataGridRef = useRef<DataGridHandle>(null);
    const { callApi, loading, error } = useApiCall();

    // Reinicia estados al cambiar el nombre de la tabla
    useEffect(() => {
        setFilters({});
        setIsFilterRowVisible(false);
        setSelectedRows(new Set());
        setTableDefinition(null);
        setTableData([]);
        setCellFeedback(null);
        setLocalCellChanges(new Map());
        setOpenConfirmDialog(false); // Resetear confirmación
        setRowToDelete(null); // Resetear fila a borrar
        setExitingRowIds(new Set()); // Resetear filas en transición
        if (feedbackTimerRef.current) {
            clearTimeout(feedbackTimerRef.current);
        }
    }, [tableName]);

    // Lógica de carga de datos y definición de la tabla
    useEffect(() => {
        if (!tableName) {
            showError("Nombre de tabla no especificado en la URL.");
            return;
        }
        const fetchDataAndDefinition = async () => {
            try {
                const definition: TableDefinition = await callApi('table_structure',{table:tableName});
                setTableDefinition(definition);
                const data = await callApi('table_data',{table:tableName});
                setTableData(data);
            } catch (err: any) {
                setTableDefinition(null);
                setTableData([]);
            } finally {}
        };
        fetchDataAndDefinition();
    }, [tableName, showError, error]);

    useEffect(() => {
        if (cellFeedback) {
            if (feedbackTimerRef.current) {
                clearTimeout(feedbackTimerRef.current);
            }
            const timerDuration = cellFeedback.type === 'success' ? 4000 : 3000;
            feedbackTimerRef.current = setTimeout(() => {
                setCellFeedback(null);
            }, timerDuration);
        }
        return () => {
            if (feedbackTimerRef.current) {
                clearTimeout(feedbackTimerRef.current);
            }
        };
    }, [cellFeedback]);

    const primaryKey = useMemo(() => {
        if (!tableDefinition) return ['id'];
        return tableDefinition.primaryKey && tableDefinition.primaryKey.length > 0 ? tableDefinition.primaryKey : ['id'];
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
        newRow[NEW_ROW_INDICATOR] = true;

        setTableData(prevData => [newRow, ...prevData]);
        setSelectedRows(new Set());

        const tempRowId = getPrimaryKeyValues(newRow, primaryKey);
        setLocalCellChanges(prev => {
            const newMap = new Map(prev);
            const mandatoryEditableColumns = new Set<string>();

            tableDefinition.fields.forEach(field => {
                const isMandatory = (field.nullable === false || field.isPk);
                const isEditable = field.editable !== false;

                if (isMandatory && isEditable) {
                    mandatoryEditableColumns.add(field.name);
                }
            });
            newMap.set(tempRowId, mandatoryEditableColumns);
            return newMap;
        });

    }, [tableDefinition, showWarning, primaryKey]);

    const handleDeleteRow = useCallback(async (row: any) => {
        setRowToDelete(row);
        setOpenConfirmDialog(true);
    }, []);

    const handleConfirmDelete = useCallback(async (confirm: boolean) => {
        setOpenConfirmDialog(false);
        if (!confirm || !rowToDelete) {
            showWarning('Eliminación cancelada por el usuario.');
            setRowToDelete(null);
            return;
        }

        if (!tableDefinition || !tableName) {
            showError('No se puede eliminar la fila sin la definición de la tabla o el nombre de la tabla.');
            setRowToDelete(null);
            return;
        }

        const rowId = getPrimaryKeyValues(rowToDelete, primaryKey);

        // Paso 1: Marcar la fila para iniciar la transición de salida
        // Agrega la fila a exitingRowIds. Esto aplicará los estilos de transición
        setExitingRowIds(prev => new Set(prev).add(rowId));

        // Permite un pequeño retraso para que el navegador aplique los estilos iniciales
        // y luego active la transición a `max-height: 0` y `opacity: 0`.
        // La duración de este setTimeout (ej. 10ms) es crítica para que la transición se "enganche".
        setTimeout(async () => {
            // Si es una fila nueva, elimínala solo localmente
            if (rowToDelete[NEW_ROW_INDICATOR]) {
                setTimeout(() => { // Este setTimeout coincide con la duración de la transición CSS
                    setTableData(prevData => prevData.filter(row => getPrimaryKeyValues(row, primaryKey) !== rowId));
                    setLocalCellChanges(prev => {
                        const newMap = new Map(prev);
                        newMap.delete(rowId);
                        return newMap;
                    });
                    setSelectedRows(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(rowId);
                        return newSet;
                    });
                    setExitingRowIds(prev => { // Quitar de las filas en transición
                        const newSet = new Set(prev);
                        newSet.delete(rowId);
                        return newSet;
                    });
                    showInfo(`Fila no guardada '${rowId}' eliminada localmente.`);
                    setRowToDelete(null);
                }, 500); // Duración de la transición CSS
                return;
            }

            // Si es una fila persistida, intenta eliminarla del backend
            try {
                const primaryKeyValues = tableDefinition.primaryKey.map((key)=> rowToDelete[key]);
                await callApi('table_record_delete', {
                    table:tableName,
                    primaryKeyValues:primaryKeyValues
                });

                console.log(`Fila con ID ${rowId} eliminada exitosamente del backend.`);
                // Permitir un breve momento para la transición visual
                setTimeout(() => {
                    setTableData(prevData => prevData.filter(row => getPrimaryKeyValues(row, primaryKey) !== rowId));
                    setLocalCellChanges(prev => {
                        const newMap = new Map(prev);
                        newMap.delete(rowId);
                        return newMap;
                    });
                    setSelectedRows(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(rowId);
                        return newSet;
                    });
                    setExitingRowIds(prev => { // Quitar de las filas en transición
                        const newSet = new Set(prev);
                        newSet.delete(rowId);
                        return newSet;
                    });
                    showSuccess(`Fila '${rowId}' eliminada exitosamente.`);
                    setRowToDelete(null);
                }, 500); // Duración de la transición CSS

            } catch (err: any) {
                console.error(`Error al eliminar la fila '${rowId}':`, err);
                setExitingRowIds(prev => { // Quitar de las filas en transición en caso de error
                    const newSet = new Set(prev);
                    newSet.delete(rowId);
                    return newSet;
                });
                setRowToDelete(null);
            }
        }, 10); // Un pequeño retraso para que la transición se active
    }, [rowToDelete, tableDefinition, tableName, primaryKey, showInfo, showSuccess, showError, showWarning, setTableData, setLocalCellChanges, setSelectedRows]);


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

    const handleEnterKeyPressInEditor = useCallback((rowIndex: number, columnKey: string, currentColumns: Column<any>[]) => {
        if (dataGridRef.current && tableDefinition) {
            const currentColumnIndex = currentColumns.findIndex((col: Column<any>) => col.key === columnKey);

            if (currentColumnIndex !== -1) {
                let nextColumnIndex = currentColumnIndex + 1;
                let nextRowIndex = rowIndex;

                let foundNextTarget = false;
                while (!foundNextTarget) {
                    if (nextColumnIndex >= currentColumns.length) {
                        nextColumnIndex = 0;
                        nextRowIndex++;

                        if (nextRowIndex >= filteredRows.length) {
                            nextRowIndex = 0;
                            nextColumnIndex = 0;

                            if (filteredRows.length === 0 || (rowIndex === filteredRows.length - 1 && currentColumnIndex === currentColumns.length - 1)) {
                                foundNextTarget = true;
                                break;
                            }
                        }
                    }

                    const nextColumn = currentColumns[nextColumnIndex];
                    if (nextColumn) {
                        const fieldDefinition = tableDefinition.fields.find(f => f.name === nextColumn.key);
                        const isEditableField = fieldDefinition?.editable !== false;

                        if (nextColumn.key !== 'filterToggle' && nextColumn.key !== 'deleteAction' && isEditableField) {
                            foundNextTarget = true;
                        } else {
                            nextColumnIndex++;
                        }
                    } else {
                        nextColumnIndex++;
                    }
                }

                if (foundNextTarget) {
                    dataGridRef.current.selectCell({ rowIdx: nextRowIndex, idx: nextColumnIndex }, { enableEditor: false, scrollIntoView: true } as SelectCellOptions);
                }
            }
        }
    }, [filteredRows, tableDefinition]);

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

                    let backgroundColor = 'transparent';

                    if (cellFeedback && cellFeedback.rowId === rowId && cellFeedback.type === 'error') {
                        if (cellFeedback.columnKey === props.column.key || cellFeedback.columnKey === null) {
                            backgroundColor = theme.palette.error.light;
                        }
                    }
                    else if (cellFeedback && cellFeedback.rowId === rowId && cellFeedback.type === 'success' && cellFeedback.columnKey === props.column.key) {
                        backgroundColor = theme.palette.success.light;
                    }
                    else {
                        const isNewRowLocalCheck = props.row[NEW_ROW_INDICATOR];
                        const isMandatory = tableDefinition.primaryKey.includes(props.column.key) || (tableDefinition.fields.find(f => f.name === props.column.key)?.nullable === false);
                        const hasValue = props.row[props.column.key] !== null && props.row[props.column.key] !== undefined && String(props.row[props.column.key]).trim() !== '';

                        if ((isNewRowLocalCheck && isMandatory && !hasValue) || (localCellChanges.has(rowId) && localCellChanges.get(rowId)?.has(props.column.key))) {
                            backgroundColor = theme.palette.info.light;
                        }
                    }

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
            };
        });

        const filterToggleColumn: Column<any> = {
            key: 'filterToggle',
            name: '',
            width: 50,
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
            renderSummaryCell: () => null,
        };

        const deleteActionColumn: Column<any> = {
            key: 'deleteAction',
            name: '', // Nombre vacío para el encabezado
            width: 50, // Ancho ligeramente más grande para el botón sin texto
            resizable: false,
            sortable: false,
            frozen: true,
            renderHeaderCell: () => null, // No mostrar texto en el encabezado
            renderSummaryCell: () => null,
            renderCell: ({ row }) => {
                if (!tableDefinition.allow?.delete) {
                    return null;
                }
                return (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                        <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            onClick={() => handleDeleteRow(row)} // Llama a la función que abre el diálogo
                            title="Eliminar fila"
                            sx={{
                                minWidth: 35, // Ajusta el ancho mínimo para el botón
                                height: 30, // Ajusta la altura
                                p: 0.5, // Reduce el padding si es necesario
                                '& .MuiButton-startIcon': { m: 0 } // Elimina el margen del icono si no hay texto
                            }}
                        >
                            <DeleteIcon sx={{ fontSize: 18 }} /> {/* Icono más grande para ser el único elemento */}
                        </Button>
                    </Box>
                );
            },
        };

        const allColumns = [filterToggleColumn, deleteActionColumn, ...defaultColumns];

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
                                onEnterPress={(rowIndex, columnKey) => handleEnterKeyPressInEditor(rowIndex, columnKey, allColumns)}
                                setTableData={setTableData}
                                setLocalCellChanges={setLocalCellChanges}
                                localCellChanges={localCellChanges}
                                primaryKey={primaryKey}
                            />
                        );
                    }
                };
            }
            return col;
        });

    }, [
        tableDefinition, isFilterRowVisible, filters, toggleFilterVisibility,
        cellFeedback, primaryKey, theme.palette.success.light, theme.palette.error.light,
        theme.palette.info.light, handleEnterKeyPressInEditor, setTableData,
        localCellChanges, handleDeleteRow
    ]);

    const showNoRowsMessage = filteredRows.length === 0 && !loading && !error;

    const handleRowsChange = useCallback((updatedRows: any[]) => {
        setTableData(updatedRows);
    }, []);

    const handleCellClick = useCallback((args: CellMouseArgs<any, { id: string }>) => {
        const fieldDefinition = tableDefinition?.fields.find(f => f.name === args.column.key);
        const isEditable = fieldDefinition?.editable !== false;

        console.log("Clicked column index:", args.column.idx);
        console.log("Clicked row index:", args.rowIdx);
        console.log("Is editable:", isEditable);
    }, [tableDefinition]);


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
                <Alert severity="error">{error.message}</Alert>
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
                
            </Box>
            {tableDefinition.allow?.insert && (
                <Box sx={{ display: 'flex', px:2, pt:2, pb: 2 }}>
                
                    <Button
                        variant="contained"
                        onClick={handleAddRow}
                        startIcon={<AddIcon />}
                    >
                        Nuevo Registro
                    </Button>
                </Box>
            )}
            <Box sx={{px:2, pt:2, pb: 2 }}>
                <Box>{`${filteredRows.length} registros filtrados`}</Box>
                <Box>{`${tableData.length} registros total`}</Box>
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
                    rows={filteredRows.map(row => ({
                        ...row,
                        // Aquí aplicamos los estilos inline para la transición
                        // Si la fila está en exitingRowIds, establecerá max-height: 0 y opacity: 0
                        // Si no, establecerá un max-height adecuado (ej. 35px, la altura por defecto de la fila)
                        // y opacity: 1. La transición en el CSS manejará la animación.
                        style: exitingRowIds.has(getPrimaryKeyValues(row, primaryKey))
                            ? { maxHeight: 0, opacity: 0, overflow: 'hidden' } // Oculta contenido si se "desliza"
                            : { maxHeight: '35px', opacity: 1 } // Altura normal de la fila de react-data-grid
                    }))}
                    enableVirtualization={true}
                    rowKeyGetter={(row: any) => getPrimaryKeyValues(row, primaryKey)}
                    onSelectedRowsChange={setSelectedRows}
                    onRowsChange={handleRowsChange}
                    selectedRows={selectedRows}
                    // La altura de la fila se gestionará con maxHeight y la transición
                    rowHeight={(row) => exitingRowIds.has(getPrimaryKeyValues(row, primaryKey)) ? 0 : 35}
                    style={{ height: '100%', width: '100%', boxSizing: 'border-box' }}
                    headerRowHeight={35}
                    topSummaryRows={isFilterRowVisible ? [{ id: 'filterRow' }] : undefined}
                    summaryRowHeight={isFilterRowVisible ? 35 : 0}
                    onCellClick={handleCellClick}
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

            {/* Diálogo de Confirmación */}
            <ConfirmDialog
                open={openConfirmDialog}
                onClose={handleConfirmDelete}
                title="Confirmar Eliminación"
                message={rowToDelete && rowToDelete[NEW_ROW_INDICATOR]
                    ? `¿Estás seguro de que quieres eliminar esta nueva fila (ID: ${getPrimaryKeyValues(rowToDelete, primaryKey)}) localmente?`
                    : rowToDelete
                        ? `¿Estás seguro de que quieres eliminar la fila con ID: ${getPrimaryKeyValues(rowToDelete, primaryKey)} de la base de datos? Esta acción es irreversible.`
                        : '¿Estás seguro de que quieres eliminar este registro? Esta acción es irreversible.'
                }
            />
        </Box>
    );
};
export default GenericDataGrid;