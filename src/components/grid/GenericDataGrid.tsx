import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { DataGrid, Column, DataGridHandle, SelectCellOptions, CellMouseArgs, RenderCellProps, RenderHeaderCellProps } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';

import { useApiCall } from '../../hooks/useApiCall';
import {
    CircularProgress, Typography, Box, Alert, useTheme, Button, IconButton
} from '@mui/material';
import { cambiarGuionesBajosPorEspacios } from '../../utils/functions';

import SearchIcon from '@mui/icons-material/Search';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

import { useSnackbar } from '../../contexts/SnackbarContext';

import PkHeaderRenderer from './PkHeaderRenderer';
import PkCellRenderer from './PkCellRenderer';

import {
    CellFeedback,
    FieldDefinition,
    TableDefinition,
    FilterRendererProps,
    InputRendererProps,
    ConfirmDialogProps,
    CustomHeaderCellProps,
    CustomCellProps
} from '../../types';

import { ConfirmDialog } from '../ConfirmDialog';

import FilterInputRenderer from './FilterInputRender';
import InputRenderer from './InputRendered';

// *** NUEVA IMPORTACIÓN DEL FALLBACK Y CLIENT SIDE RENDERERS ***
import { clientSideRenderers, ClientSideRendererProps } from './clientSideRenderers';
import FallbackClientSideRenderer from './FallbackClientSideRenderer'; // Importa el FallbackRenderer directamente

interface GenericDataGridProps {
    tableName: string;
}

export const getPrimaryKeyValues = (row: Record<string, any>, primaryKey: string[]): string => {
    return primaryKey
        .map(key => {
            return row[key] !== undefined && row[key] !== null
                ? String(row[key])
                : 'NULL_OR_UNDEFINED';
        })
        .join('|');
};

export const NEW_ROW_INDICATOR = '.$new';

const GenericDataGrid: React.FC<GenericDataGridProps> = ({ tableName }) => {
    const [tableDefinition, setTableDefinition] = useState<TableDefinition | null>(null);
    const [tableData, setTableData] = useState<any[]>([]);
    const [isFilterRowVisible, setIsFilterRowVisible] = useState<boolean>(false);
    const [filters, setFilters] = useState<Record<string, string>>({});
    const [selectedRows, setSelectedRows] = useState((): ReadonlySet<string> => new Set());
    const [cellFeedback, setCellFeedback] = useState<CellFeedback | null>(null);
    const [localCellChanges, setLocalCellChanges] = useState<Map<string, Set<string>>>(new Map());
    const theme = useTheme();

    const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
    const [rowToDelete, setRowToDelete] = useState<any | null>(null);
    const [exitingRowIds, setExitingRowIds] = useState<Set<string>>(new Set());

    const { showSuccess, showError, showWarning, showInfo } = useSnackbar();

    const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);
    const dataGridRef = useRef<DataGridHandle>(null);
    const { callApi, loading, error } = useApiCall();

    useEffect(() => {
        setFilters({});
        setIsFilterRowVisible(false);
        setSelectedRows(new Set());
        setTableDefinition(null);
        setTableData([]);
        setCellFeedback(null);
        setLocalCellChanges(new Map());
        setOpenConfirmDialog(false);
        setRowToDelete(null);
        setExitingRowIds(new Set());
        if (feedbackTimerRef.current) {
            clearTimeout(feedbackTimerRef.current);
        }
    }, [tableName]);

    useEffect(() => {
        const fetchDataAndDefinition = async () => {
            try {
                const definition: TableDefinition = await callApi('table_structure', { table: tableName });
                setTableDefinition(definition);
                const data = await callApi('table_data', { table: tableName });
                setTableData(data);
            } catch (err: any) {
                setTableDefinition(null);
                setTableData([]);
                showError(`Error al cargar datos para la tabla '${tableName}': ${err.message || 'Error desconocido'}`);
            } finally { }
        };
        fetchDataAndDefinition();
    }, [tableName, showError]);

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

        setExitingRowIds(prev => new Set(prev).add(rowId));

        setTimeout(async () => {
            if (rowToDelete[NEW_ROW_INDICATOR]) {
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
                    setExitingRowIds(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(rowId);
                        return newSet;
                    });
                    showInfo(`Fila no guardada '${rowId}' eliminada localmente.`);
                    setRowToDelete(null);
                }, 500);
                return;
            }

            try {
                const primaryKeyValues = tableDefinition.primaryKey.map((key) => rowToDelete[key]);
                await callApi('table_record_delete', {
                    table: tableName,
                    primaryKeyValues: primaryKeyValues
                });

                console.log(`Fila con ID ${rowId} eliminada exitosamente del backend.`);
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
                    setExitingRowIds(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(rowId);
                        return newSet;
                    });
                    showSuccess(`Fila '${rowId}' eliminada exitosamente.`);
                    setRowToDelete(null);
                }, 500);

            } catch (err: any) {
                console.error(`Error al eliminar la fila '${rowId}':`, err);
                showError(`Error al eliminar la fila '${rowId}': ${err.message || 'Error desconocido'}`);
                setExitingRowIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(rowId);
                    return newSet;
                });
                setRowToDelete(null);
            }
        }, 10);
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
                isPK: field.isPk,
                renderHeaderCell: (props: RenderHeaderCellProps<any, any>) => <PkHeaderRenderer {...props} />,
                renderSummaryCell: ({ column }) => {
                    return isFilterRowVisible ? (
                        <FilterInputRenderer
                            column={column}
                            filters={filters}
                            setFilters={setFilters}
                        />
                    ) : null;
                },
                renderCell: (props: RenderCellProps<any, any>) => {
                    const rowId = getPrimaryKeyValues(props.row, primaryKey);
                    const fieldDefinition = tableDefinition.fields.find(f => f.name === props.column.key);

                    // Lógica para renderizado clientSide
                    if (fieldDefinition?.clientSide) {
                        const ClientSideComponent = clientSideRenderers[fieldDefinition.clientSide];
                        if (ClientSideComponent) {
                            return (
                                <ClientSideComponent
                                    {...props}
                                    fieldDefinition={fieldDefinition}
                                    tableDefinition={tableDefinition}
                                    primaryKey={primaryKey}
                                />
                            );
                        } else {
                            // *** RENDERIZADO DEL FALLBACK SI EL COMPONENTE NO SE ENCUENTRA ***
                            return (
                                <FallbackClientSideRenderer
                                    {...props}
                                    fieldDefinition={fieldDefinition}
                                    tableDefinition={tableDefinition}
                                    primaryKey={primaryKey}
                                />
                            );
                        }
                    }

                    // Lógica existente para resaltar celdas con feedback o cambios locales
                    let cellBackgroundColor = 'transparent';
                    if (cellFeedback && cellFeedback.rowId === rowId && cellFeedback.columnKey === props.column.key) {
                        cellBackgroundColor = cellFeedback.type === 'error' ? theme.palette.error.light : theme.palette.success.light;
                    } else {
                        const isNewRowLocalCheck = props.row[NEW_ROW_INDICATOR];
                        const isMandatory = tableDefinition.primaryKey.includes(props.column.key) || (tableDefinition.fields.find(f => f.name === props.column.key)?.nullable === false);
                        const hasValue = props.row[props.column.key] !== null && props.row[props.column.key] !== undefined && String(props.row[props.column.key]).trim() !== '';

                        if ((isNewRowLocalCheck && isMandatory && !hasValue) || (localCellChanges.has(rowId) && localCellChanges.get(rowId)?.has(props.column.key))) {
                            cellBackgroundColor = theme.palette.info.light;
                        }
                    }

                    return (
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                backgroundColor: cellBackgroundColor,
                                transition: 'background-color 0.3s ease-in-out',
                                display: 'flex',
                                alignItems: 'center',
                                paddingLeft: '8px',
                                boxSizing: 'border-box',
                            }}
                        >
                            <PkCellRenderer
                                {...props}
                                column={{ ...props.column, isPK: !!field.isPk }}
                            />
                        </Box>
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
            name: '',
            width: 50,
            resizable: false,
            sortable: false,
            frozen: true,
            renderHeaderCell: () => null,
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
                            onClick={() => handleDeleteRow(row)}
                            title="Eliminar fila"
                            sx={{
                                minWidth: 35,
                                height: 30,
                                p: 0.5,
                                '& .MuiButton-startIcon': { m: 0 }
                            }}
                        >
                            <DeleteIcon sx={{ fontSize: 18 }} />
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
                <Box sx={{ display: 'flex', px: 2 }}>

                    <Button
                        variant="contained"
                        onClick={handleAddRow}
                        startIcon={<AddIcon />}
                    >
                        Nuevo Registro
                    </Button>
                </Box>
            )}
            <Box sx={{ px: 2, pt: 2, pb: 1, fontSize: '0.9rem' }}>
                {filteredRows.length == tableData.length ?
                    <Box>mostrando {`${tableData.length} registros`}</Box>
                    : <>
                        <Box>mostrando {`${filteredRows.length} registros filtrados`}</Box>
                    </>}
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
                        style: exitingRowIds.has(getPrimaryKeyValues(row, primaryKey))
                            ? { maxHeight: 0, opacity: 0, overflow: 'hidden' }
                            : { maxHeight: '35px', opacity: 1 }
                    }))}
                    enableVirtualization={true}
                    rowKeyGetter={(row: any) => getPrimaryKeyValues(row, primaryKey)}
                    onSelectedRowsChange={setSelectedRows}
                    onRowsChange={handleRowsChange}
                    selectedRows={selectedRows}
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