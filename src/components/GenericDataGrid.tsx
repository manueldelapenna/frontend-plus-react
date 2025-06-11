import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { DataGrid, Column, RowsChangeData, DataGridHandle, SelectCellOptions, CellKeyDownArgs, CellMouseArgs } from 'react-data-grid';
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
    columnKey: string | null; // MODIFICADO: Puede ser null para indicar toda la fila
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
    localCellChanges, // Recibido como prop
    primaryKey
}: InputRendererProps<R, S>) {
    const tableName = tableDefinition.tableName!;
    const [editingValue, setEditingValue] = useState(row[column.key]);

    const { showSuccess, showError } = useSnackbar();

    const initialRowId = useMemo(() => getPrimaryKeyValues(row, primaryKey), [row, primaryKey]);
    
    // El useEffect que causaba el blanqueo ha sido eliminado.
    // El editingValue se inicializa una sola vez al montar el componente.

    const handleCommit = useCallback(async (currentValue: any, closeEditor: boolean, focusNextCell: boolean) => {
        const processedNewValue = typeof currentValue === 'string'
            ? (currentValue.trim() === '' ? null : currentValue.trim())
            : currentValue;

        const potentialUpdatedRow = { ...row, [column.key]: processedNewValue } as R;
        
        // MODIFICACIÓN: Lógica mejorada para determinar si es una fila nueva
        const arePKValuesFilled = tableDefinition.primaryKey.every(key => 
            potentialUpdatedRow[key] !== undefined && potentialUpdatedRow[key] !== null && String(potentialUpdatedRow[key]).trim() !== ''
        );
        const isNewRow = !arePKValuesFilled || potentialUpdatedRow[NEW_ROW_INDICATOR];
        // FIN MODIFICACIÓN

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

        try {
            const status = isNewRow ? 'new' : 'update';

            let rowToSend: Record<string, any> = {};

            if (isNewRow) {
                // Para una nueva fila, enviar todos los campos que tienen valor
                // y los de la PK (incluso si no tienen valor todavía, si es el caso)
                tableDefinition.fields.forEach(fieldDef => {
                    const fieldValue = potentialUpdatedRow[fieldDef.name];
                    if (fieldValue !== undefined && fieldValue !== null && String(fieldValue).trim() !== '') {
                        rowToSend[fieldDef.name] = fieldValue;
                    } else if (tableDefinition.primaryKey.includes(fieldDef.name) && (fieldValue === null || fieldValue === undefined || String(fieldValue).trim() === '')) {
                         // Si es PK y está vacío, asegurarse de que se envía como null/vacío para que el backend lo maneje
                        rowToSend[fieldDef.name] = fieldValue;
                    }
                });
                 // Asegurarse de que cualquier campo que ya haya sido marcado localmente y que ahora esté vacío, también se envíe como tal
                if (localCellChanges.has(initialRowId)) { // Accediendo a la prop
                    localCellChanges.get(initialRowId)?.forEach((colKey: string) => { // Especificando el tipo de colKey
                        if (!rowToSend.hasOwnProperty(colKey)) { // Si no se agregó ya por el forEach de fields
                             rowToSend[colKey] = potentialUpdatedRow[colKey];
                        }
                    });
                }
                delete rowToSend[NEW_ROW_INDICATOR]; // Asegurar que la marca interna no se envíe al backend
            } else {
                // Para una actualización de fila existente, solo el campo modificado y las PK
                rowToSend[column.key] = processedNewValue;
                tableDefinition.primaryKey.forEach(pkField => {
                    rowToSend[pkField] = potentialUpdatedRow[pkField];
                });
            }
            

            const body = new URLSearchParams();
            body.append('table', tableName);
            body.append('primaryKeyValues', JSON.stringify(primaryKeyValuesForBackend));
            body.append('newRow', JSON.stringify(rowToSend));
            body.append('oldRow', JSON.stringify(oldRowData));
            body.append('status', status);

            const response = await fetchApi(`/table_record_save`, {
                method: 'POST',
                body: body
            });

            // Se elimina la marca de cambio local de la celda que se acaba de guardar
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

            if (!response.ok) {
                const errorText = await response.text();
                showError(`Error ${response.status}: ${errorText}`);
                setCellFeedback({ rowId: currentRowIdBeforeUpdate, columnKey: column.key, type: 'error' });
                onRowChange(oldRowData as R, true); // Revertir el cambio visual si hay un error
                throw new Error(`Error al guardar el registro: ${response.status} - ${errorText}`);
            }
            const rawResponseTextData = await response.text();
            const jsonRespuesta = JSON.parse(rawResponseTextData.replace(/^--\n/, ''));

            if (jsonRespuesta.error) {
                showError(`Error ${jsonRespuesta.error.code}: ${jsonRespuesta.error.message}`);
                setCellFeedback({ rowId: currentRowIdBeforeUpdate, columnKey: column.key, type: 'error' });
                onRowChange(oldRowData as R, true); // Revertir el cambio visual si hay un error del backend
            } else {
                showSuccess('Registro guardado exitosamente!');
                
                let finalRowIdForFeedback: string;
                let persistedRowData: R;

                if (jsonRespuesta.row && isNewRow) {
                    persistedRowData = { ...jsonRespuesta.row };
                    setTableData(prevData => {
                        const newData = [...prevData];
                        const originalRowId = getPrimaryKeyValues(oldRowData, tableDefinition.primaryKey);
                        const rowIndex = newData.findIndex(r => getPrimaryKeyValues(r, tableDefinition.primaryKey) === originalRowId);
                        if (rowIndex !== -1) {
                            newData[rowIndex] = persistedRowData;
                        } else {
                            // Esto no debería pasar si initialRowId es correcto
                            console.warn("Fila no encontrada para actualizar después de la inserción. Podría haber un problema de sincronización.");
                            // Podríamos intentar buscarla por la PK generada en persistedRowData si el ID inicial era temporal
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
                
                // MODIFICACIÓN DEL FEEDBACK: Establecer la clave de la columna para feedback de éxito
                setCellFeedback({ rowId: finalRowIdForFeedback, columnKey: column.key, type: 'success' }); 
            }

        } catch (err: any) {
            console.error('Error al guardar el registro:', err);
            showError(`Fallo inesperado al guardar: ${err.message || 'Error desconocido'}`);
            setCellFeedback({ rowId: currentRowIdBeforeUpdate, columnKey: column.key, type: 'error' });
            onRowChange(oldRowData as R, true); // Revertir el cambio visual si hay un error en el fetch
        }
    }, [
        column,
        row,
        onRowChange,
        tableName,
        tableDefinition.primaryKey,
        tableDefinition.fields,
        showSuccess,
        showError,
        setCellFeedback,
        onClose,
        setTableData,
        setLocalCellChanges,
        localCellChanges, // Añadido como dependencia
        initialRowId
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
    const [localCellChanges, setLocalCellChanges] = useState<Map<string, Set<string>>>(new Map());
    const theme = useTheme();

    const { showSuccess, showError, showWarning, showInfo } = useSnackbar();

    const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);
    const dataGridRef = useRef<DataGridHandle>(null);

    // Reinicia estados al cambiar el nombre de la tabla
    useEffect(() => {
        // Establece loading a true aquí para que el spinner aparezca inmediatamente al cambiar de tabla.
        // Se inicializa en true arriba, pero si cambias de tabla sin recargar, este hook se encarga.
        setLoading(true); 
        setFilters({});
        setIsFilterRowVisible(false);
        setSelectedRows(new Set());
        setError(null);
        setTableDefinition(null);
        setTableData([]);
        setCellFeedback(null);
        setLocalCellChanges(new Map());
        if (feedbackTimerRef.current) {
            clearTimeout(feedbackTimerRef.current);
        }
    }, [tableName]);

    // Lógica de carga de datos y definición de la tabla
    useEffect(() => {
        // Si tableName es undefined al inicio, salimos.
        if (!tableName) {
            showError("Nombre de tabla no especificado en la URL.");
            setLoading(false); // Asegúrate de que loading se desactive
            return;
        }

        const fetchDataAndDefinition = async () => {
            setError(null); // Limpiar errores anteriores

            try {
                // Fetch de la definición de la tabla
                const bodyStructure = new URLSearchParams({ table: tableName });
                const responseDefinition = await fetchApi(`/table_structure`, {
                    method: 'POST',
                    body: bodyStructure
                });

                if (!responseDefinition.ok) {
                    const errorText = await responseDefinition.text();
                    const errorMessage = `Error ${responseDefinition.status}: ${errorText} al cargar la estructura de la tabla '${tableName}'`;
                    showError(errorMessage);
                    setError(errorMessage);
                    throw new Error(errorMessage);
                }
                const rawResponseTextDefinition = await responseDefinition.text();
                const definition: TableDefinition = JSON.parse(rawResponseTextDefinition.replace(/^--\n/, ''));
                setTableDefinition(definition);

                // Fetch de los datos de la tabla
                const bodyData = new URLSearchParams({ table: tableName });
                const responseData = await fetchApi(`/table_data`, {
                    method: 'POST',
                    body: bodyData
                });

                if (!responseData.ok) {
                    const errorText = await responseData.text();
                    const errorMessage = `Error ${responseData.status}: ${errorText} al cargar datos de '${tableName}'`;
                    showError(errorMessage);
                    setError(errorMessage);
                    throw new Error(errorMessage);
                }
                const rawResponseTextData = await responseData.text();
                const data = JSON.parse(rawResponseTextData.replace(/^--\n/, ''));
                setTableData(data);

            } catch (err: any) {
                console.error('Error general al cargar tabla:', err);
                // Si el error ya fue establecido por showError, no lo sobrescribimos.
                if (!error) { 
                    setError(`Error al cargar la tabla: ${err.message || 'Error desconocido'}`);
                }
                setTableDefinition(null);
                setTableData([]);
            } finally {
                setLoading(false); // Siempre desactiva el estado de carga al finalizar.
            }
        };

        fetchDataAndDefinition();
    }, [tableName, showError, error]); // `error` se agrega para asegurar que el `if (!error)` funcione correctamente

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
            if (selectedRows.has(getPrimaryKeyValues(row, primaryKey)) && !row[NEW_ROW_INDICATOR]) {
                rowsToDelete.push(row);
            }
        });

        // Eliminar inmediatamente las filas NUEVAS (no persistidas) del estado local
        const newTableDataAfterLocalDelete = tableData.filter(row => 
            !(selectedRows.has(getPrimaryKeyValues(row, primaryKey)) && row[NEW_ROW_INDICATOR])
        );
        setTableData(newTableDataAfterLocalDelete);

        // Limpiar los cambios locales de las filas seleccionadas
        setLocalCellChanges(prev => {
            const newMap = new Map(prev);
            selectedRows.forEach(rowId => {
                newMap.delete(rowId);
            });
            return newMap;
        });


        if (rowsToDelete.length === 0) {
            if (selectedRows.size > 0 && tableData.some(row => selectedRows.has(getPrimaryKeyValues(row, primaryKey)) && row[NEW_ROW_INDICATOR])) {
                showInfo('Las filas seleccionadas no guardadas han sido eliminadas localmente.');
            } else {
                showWarning('No se encontraron filas guardadas válidas seleccionadas para eliminar.');
            }
            setSelectedRows(new Set());
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
            showSuccess(`Filas eliminadas exitosamente: ${rowsToDelete.length}`);

            // Filtrar las filas que realmente se eliminaron del backend
            const finalTableData = newTableDataAfterLocalDelete.filter(row => !selectedRows.has(getPrimaryKeyValues(row, primaryKey)));
            setTableData(finalTableData);
            setSelectedRows(new Set());

        } catch (err: any) {
            console.error('Error al eliminar filas:', err);
            showError(`Fallo inesperado al eliminar: ${err.message || 'Error desconocido'}`);
            // NOTA: Si falla el borrado en el backend, las filas ya se eliminaron localmente arriba.
            // Para ser robustos, si la eliminación en el backend falla, deberíamos re-añadir
            // las filas `rowsToDelete` al `tableData` o volver a cargar los datos.
            // Por simplicidad, y asumiendo que un error aquí es excepcional, no se revierte automáticamente el estado.
        }
    }, [selectedRows, tableData, primaryKey, tableName, tableDefinition, showWarning, showError, showSuccess, showInfo, setLocalCellChanges]);

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
                            
                            // Si se llega al final de la cuadrícula, salir del loop o decidir qué hacer
                            if (filteredRows.length === 0 || (rowIndex === filteredRows.length - 1 && currentColumnIndex === currentColumns.length -1)) {
                                foundNextTarget = true; // No hay más celdas a las que ir
                                break;
                            }
                        }
                    }

                    const nextColumn = currentColumns[nextColumnIndex];
                    if (nextColumn) {
                        const fieldDefinition = tableDefinition.fields.find(f => f.name === nextColumn.key);
                        const isEditableField = fieldDefinition?.editable !== false;

                        if (nextColumn.key !== 'actions' && isEditableField) {
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

                    // 1. Feedback de error (prioridad máxima)
                    if (cellFeedback && cellFeedback.rowId === rowId && cellFeedback.type === 'error') {
                        // Si el error es para una celda específica O si es para toda la fila (no debería ser, pero por si acaso)
                        if (cellFeedback.columnKey === props.column.key || cellFeedback.columnKey === null) {
                            backgroundColor = theme.palette.error.light;
                        }
                    } 
                    // 2. Feedback de éxito (solo la celda)
                    else if (cellFeedback && cellFeedback.rowId === rowId && cellFeedback.type === 'success' && cellFeedback.columnKey === props.column.key) {
                        backgroundColor = theme.palette.success.light;
                    }
                    // 3. Cambios locales pendientes (celeste)
                    else {
                        // Mejoramos la determinación de si un campo obligatorio en una fila nueva está vacío
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
            renderSummaryCell: () => isFilterRowVisible ? (
                null
            ) : null,
        };

        const allColumns = [actionColumn, ...defaultColumns];

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
                                localCellChanges={localCellChanges} // Pasando como prop
                                primaryKey={primaryKey}
                            />
                        );
                    }
                };
            }
            return col;
        });

    }, [
        tableDefinition,
        isFilterRowVisible,
        filters,
        toggleFilterVisibility,
        cellFeedback,
        primaryKey,
        theme.palette.success.light,
        theme.palette.error.light,
        theme.palette.info.light,
        handleEnterKeyPressInEditor,
        setTableData,
        localCellChanges
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
        </Box>
    );
};
export default GenericDataGrid;