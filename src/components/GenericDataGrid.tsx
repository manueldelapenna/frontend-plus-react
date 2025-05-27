import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
    TextField, Button, Checkbox, CircularProgress, Alert, AlertTitle, Box, Typography,
    IconButton, InputAdornment, Menu, MenuItem, FormControl, InputLabel, Select
} from '@mui/material';
import {
    Add as AddIcon, Save as SaveIcon, Delete as DeleteIcon, Edit as EditIcon, Cancel as CancelIcon,
    Search as SearchIcon, FilterList as FilterListIcon, ArrowUpward as ArrowUpwardIcon, ArrowDownward as ArrowDownwardIcon
} from '@mui/icons-material';
import { fetchApi } from '../utils/fetchApi';
// Asegúrate de que FieldDefinition y TableDefinition se importen correctamente.
// Si vienen de tu backend-plus lib, está bien. Si las definiste en 'types/client-context-types', cámbialo.
import { FieldDefinition, TableDefinition } from "backend-plus";
import { useParams } from 'react-router-dom';
// import { useApp } from '../contexts/AppContext'; // Ya no es necesario si sacaste tableStructures

// Helper para obtener valores de Primary Key
const getPrimaryKeyValues = (row: any, primaryKeyFields: string[]): string => {
    if (!primaryKeyFields || primaryKeyFields.length === 0) {
        return row._tempId || JSON.stringify(row);
    }
    return primaryKeyFields.map(key => String(row[key])).join('__');
};

const GenericDataGrid: React.FC = () => {
    const { tableName } = useParams<{ tableName: string }>();

    // --- 1. HOOKS DE ESTADO ---
    const [tableDefinition, setTableDefinition] = useState<TableDefinition | null>(null);
    const [tableData, setTableData] = useState<any[]>([]);
    
    const [isLoadingStructure, setIsLoadingStructure] = useState<boolean>(true);
    const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const [editingRowId, setEditingRowId] = useState<string | null>(null);
    const [editedRowData, setEditedRowData] = useState<any | null>(null);
    const [isNewRow, setIsNewRow] = useState(false);

    const [columnFilters, setColumnFilters] = useState<{[key: string]: string}>({});
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);

    // --- 2. EFECTO PARA CARGAR LA ESTRUCTURA DE LA TABLA (`tableDefinition`) ---
    useEffect(() => {
        if (!tableName) {
            setError("Nombre de tabla no especificado en la URL.");
            setIsLoadingStructure(false);
            return;
        }

        const fetchDefinition = async () => {
            setIsLoadingStructure(true);
            setError(null);
            setTableDefinition(null);
            setTableData([]);

            try {
                const formData = new URLSearchParams({
                    table: tableName,
                });
                const response = await fetchApi(`/table_structure`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: formData
                });
                if (response.ok) {
                    const rawResponseText = await response.text();
                    const data = JSON.parse(rawResponseText.replace(/^--\n/, '')); 
                    setTableDefinition(data);
                    setError(null);
                } else {
                    const errorText = await response.text();
                    setError(`Error al cargar la estructura de la tabla '${tableName}': ${response.status} - ${errorText}`);
                    setTableDefinition(null);
                }
            } catch (err) {
                console.error('Error de red o inesperado al cargar la estructura:', err);
                setError(`Error de red o inesperado al cargar la estructura de la tabla '${tableName}'.`);
                setTableDefinition(null);
            } finally {
                setIsLoadingStructure(false);
            }
        };

        fetchDefinition();
    }, [tableName]);

    // --- 3. FUNCIONES DE CARGA DE DATOS (`WorkspaceData`) ---
    const fetchData = useCallback(async () => {
        if (!tableDefinition || !tableName) {
            setTableData([]);
            return;
        }

        setIsLoadingData(true);
        setError(null);

        try {
            const formData = new URLSearchParams({
                table: tableName,
            });
            const response = await fetchApi(`/table_data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData
            });
            
            const rawResponseText = await response.text();
            const data = JSON.parse(rawResponseText.replace(/^--\n/, '')); 
            setTableData(data);
        } catch (err: any) {
            setError(`Error al cargar datos de ${tableDefinition.name}: ${err.message}`);
            setTableData([]);
        } finally {
            setIsLoadingData(false);
        }
    }, [tableName, tableDefinition]);

    // --- 4. EFECTO PARA DISPARAR LA CARGA DE DATOS DESPUÉS DE LA ESTRUCTURA ---
    useEffect(() => {
        if (tableDefinition && !isLoadingStructure && !error) {
            fetchData();
        }
        if (!tableDefinition && !isLoadingStructure) {
            setTableData([]);
        }
    }, [fetchData, tableDefinition, isLoadingStructure, error]);


    // --- 5. HOOKS CON MEMOIZACIÓN (visibleFields, processedData) ---
    // Colocamos la desestructuración de tableDefinition AQUÍ,
    // después de que se haya asegurado que no es null por los `if (error) / if (isLoadingStructure) / if (!tableDefinition)`
    // y antes de cualquier `useMemo` o función que la necesite.
    const name = tableDefinition?.name;
    const fields = tableDefinition?.fields || [];
    const primaryKey = tableDefinition?.primaryKey || [];
    const allow = tableDefinition?.allow;


    const visibleFields = useMemo(() => {
        if (!tableDefinition) return [];
        return tableDefinition.fields.filter(field => field.visible !== false && field.clientSide === undefined);
    }, [tableDefinition]);

    const processedData = useMemo(() => {
        if (!tableDefinition || !tableData) return [];

        let currentData = [...tableData];

        currentData = currentData.filter(row => {
            return visibleFields.every(field => {
                const filterTerm = columnFilters[field.name];
                if (!filterTerm) return true;
                const value = String(row[field.name] ?? '').toLowerCase();
                return value.includes(filterTerm.toLowerCase());
            });
        });

        if (sortColumn && sortDirection) {
            currentData.sort((a, b) => {
                const aValue = a[sortColumn];
                const bValue = b[sortColumn];
                if (aValue === null || aValue === undefined) return sortDirection === 'asc' ? -1 : 1;
                if (bValue === null || bValue === undefined) return sortDirection === 'asc' ? 1 : -1;
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
                }
                const aStr = String(aValue).toLowerCase();
                const bStr = String(bValue).toLowerCase();
                if (aStr < bStr) return sortDirection === 'asc' ? -1 : 1;
                if (aStr > bStr) return sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return currentData;
    }, [tableData, columnFilters, sortColumn, sortDirection, visibleFields, tableDefinition]);


    // --- 6. FUNCIONES QUE SE USAN EN EL JSX ---
    // Estas funciones ahora pueden acceder a `name`, `fields`, `primaryKey`, `allow`
    // directamente porque fueron desestructuradas arriba, en el scope del componente.

    const handleEditClick = (row: any) => {
        if (editingRowId) {
            alert("Por favor, guarda o cancela la edición de la fila actual antes de editar otra.");
            return;
        }
        setEditingRowId(getPrimaryKeyValues(row, primaryKey));
        setEditedRowData({ ...row });
        setIsNewRow(false);
    };

    const handleCancelEdit = () => {
        setEditingRowId(null);
        setEditedRowData(null);
        setIsNewRow(false);
        setTableData(prevData => prevData.filter(row => !(isNewRow && row._tempId && getPrimaryKeyValues(row, primaryKey) === editingRowId)));
    };

    const handleChange = (fieldName: string, value: any) => {
        setEditedRowData((prev: any) => ({ ...prev, [fieldName]: value }));
    };

    const handleSaveClick = async () => {
        if (!tableDefinition) {
            setError("No se puede guardar: la definición de la tabla no está disponible.");
            return;
        }
        setError(null);
        setIsLoadingData(true);
        const pkValues = getPrimaryKeyValues(editedRowData, primaryKey);

        try {
            if (isNewRow) {
                const newRecord = { ...editedRowData };
                delete newRecord._tempId;

                const response = await fetchApi(`${process.env.REACT_APP_BACKEND_URL}/api/data/${name}`, {
                    method: 'POST',
                    body: newRecord,
                });
                setTableData(prevData => prevData.map(row =>
                    (row._tempId && getPrimaryKeyValues(row, primaryKey) === pkValues) ? response : row
                ));
            } else {
                const updatePayload = { ...editedRowData };
                primaryKey.forEach(key => delete updatePayload[key]);
                fields.filter(f => f.editable === false).forEach(f => delete updatePayload[f.name]);

                await fetchApi(`${process.env.REACT_APP_BACKEND_URL}/api/data/${name}/${encodeURIComponent(pkValues)}`, {
                    method: 'PUT',
                    body: updatePayload,
                });
                setTableData(prevData => prevData.map(row =>
                    getPrimaryKeyValues(row, primaryKey) === pkValues ? { ...editedRowData } : row
                ));
            }
            setEditingRowId(null);
            setEditedRowData(null);
            setIsNewRow(false);
            // fetchData(); 
        } catch (err: any) {
            setError(`Error al guardar datos: ${err.message}`);
        } finally {
            setIsLoadingData(false);
        }
    };

    const handleDeleteClick = async (row: any) => {
        if (!tableDefinition) {
            setError("No se puede eliminar: la definición de la tabla no está disponible.");
            return;
        }
        if (!window.confirm(`¿Estás seguro de que quieres eliminar este registro?`)) {
            return;
        }
        setError(null);
        setIsLoadingData(true);
        const pkValues = getPrimaryKeyValues(row, primaryKey);
        try {
            await fetchApi(`${process.env.REACT_APP_BACKEND_URL}/api/data/${name}/${encodeURIComponent(pkValues)}`, {
                method: 'DELETE',
            });
            setTableData(prevData => prevData.filter(r => getPrimaryKeyValues(r, primaryKey) !== pkValues));
        } catch (err: any) {
            setError(`Error al eliminar registro: ${err.message}`);
        } finally {
            setIsLoadingData(false);
        }
    };

    const handleAddRow = () => {
        if (!tableDefinition) return;
        if (editingRowId) {
            alert("Por favor, guarda o cancela la fila actual antes de añadir una nueva.");
            return;
        }
        const newRow: any = { _tempId: Date.now().toString() };
        fields.forEach(field => {
            if (field.defaultValue !== undefined) {
                newRow[field.name] = field.defaultValue;
            } else if (field.defaultDbValue !== undefined) {
                try {
                    newRow[field.name] = JSON.parse(field.defaultDbValue.replace(/'/g, '"'));
                } catch {
                    newRow[field.name] = field.defaultDbValue;
                }
            } else if (!field.nullable) {
                if (field.typeName === 'text') newRow[field.name] = '';
                if (field.typeName === 'integer' || field.typeName === 'bigint') newRow[field.name] = 0;
                if (field.typeName === 'boolean') newRow[field.name] = false;
            }
        });
        setTableData((prevData:any) => [newRow, ...prevData]);
        setEditingRowId(newRow._tempId);
        setEditedRowData(newRow);
        setIsNewRow(true);
    };

    const handleSortClick = (columnName: string) => {
        if (sortColumn === columnName) {
            if (sortDirection === 'asc') setSortDirection('desc');
            else if (sortDirection === 'desc') {
                setSortColumn(null);
                setSortDirection(null);
            } else {
                setSortDirection('asc');
            }
        } else {
            setSortColumn(columnName);
            setSortDirection('asc');
        }
    };

    const handleColumnFilterChange = (columnName: string, value: string) => {
        setColumnFilters(prev => ({
            ...prev,
            [columnName]: value
        }));
    };

    const renderCell = (row: any, field: FieldDefinition) => {
        if (!tableDefinition) return null; 

        const isEditing = getPrimaryKeyValues(row, primaryKey);
        const value = isEditing === editingRowId ? editedRowData?.[field.name] : row[field.name];

        const canEditCell = isEditing === editingRowId && field.editable !== false && tableDefinition.editable !== false && field.clientSide === undefined;

        if (!canEditCell) {
            if (field.typeName === 'boolean') return value ? 'Sí' : 'No';
            if (field.typeName === 'jsonb') return value ? JSON.stringify(value) : '';
            if (field.typeName === 'timestamp' || field.typeName === 'date') return value ? new Date(value).toLocaleString() : '';
            return String(value ?? '');
        }

        switch (field.typeName) {
            case 'boolean':
                return (
                    <Checkbox
                        checked={Boolean(value)}
                        onChange={(e) => handleChange(field.name, e.target.checked)}
                        sx={{ p: 0.5 }}
                    />
                );
            case 'integer':
            case 'bigint':
                return (
                    <TextField
                        type="number"
                        value={value ?? ''}
                        onChange={(e) => handleChange(field.name, parseInt(e.target.value, 10) || (field.nullable ? null : 0))}
                        size="small"
                        fullWidth
                        sx={{ '& .MuiInputBase-input': { p: 1 } }}
                    />
                );
            case 'text':
                return (
                    <TextField
                        type="text"
                        value={value ?? ''}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                        size="small"
                        fullWidth
                        multiline={false}
                        rows={1}
                        sx={{ '& .MuiInputBase-input': { p: 1 } }}
                    />
                );
            case 'timestamp':
            case 'date':
                return (
                    <TextField
                        type={field.typeName === 'date' ? 'date' : 'datetime-local'}
                        value={value ? new Date(value).toISOString().slice(0, field.typeName === 'date' ? 10 : 16) : ''}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                        size="small"
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        sx={{ '& .MuiInputBase-input': { p: 1 } }}
                    />
                );
            case 'jsonb':
                return (
                    <TextField
                        type="text"
                        value={typeof value === 'object' && value !== null ? JSON.stringify(value) : value ?? ''}
                        onChange={(e) => {
                            try {
                                handleChange(field.name, JSON.parse(e.target.value));
                            } catch {
                                handleChange(field.name, e.target.value);
                            }
                        }}
                        size="small"
                        fullWidth
                        multiline
                        rows={2}
                        sx={{ '& .MuiInputBase-input': { p: 1 } }}
                    />
                );
            default:
                return (
                    <TextField
                        type="text"
                        value={value ?? ''}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                        size="small"
                        fullWidth
                        sx={{ '& .MuiInputBase-input': { p: 1 } }}
                    />
                );
        }
    };


    // --- 7. RETURN CONDICIONALES PARA ESTADOS DE CARGA/ERROR ---

    if (error) {
        return (
            <Alert severity="error">
                <AlertTitle>Error</AlertTitle>
                {error}
            </Alert>
        );
    }

    if (isLoadingStructure) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <CircularProgress />
                <Typography ml={2}>Cargando estructura de tabla "{tableName}"...</Typography>
            </Box>
        );
    }

    if (!tableDefinition) {
        return (
            <Alert severity="warning">
                <AlertTitle>Advertencia</AlertTitle>
                No se pudo cargar la definición de la tabla "{tableName}". Verifique la URL o la configuración del backend.
            </Alert>
        );
    }
    
    // Ahora que tableDefinition está disponible y sin errores, podemos usar name, fields, etc.
    // **¡YA NO NECESITAS ESTA LÍNEA AQUÍ PORQUE LAS VARIABLES FUERON DECLARADAS ARRIBA!**
    // const { name, fields, primaryKey, allow } = tableDefinition; // ELIMINAR O COMENTAR ESTA LÍNEA

    if (isLoadingData) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <CircularProgress />
                <Typography ml={2}>Cargando datos para "{tableDefinition.title || tableDefinition.name}"...</Typography>
            </Box>
        );
    }

    // --- 8. RENDERIZADO PRINCIPAL DEL COMPONENTE (JSX) ---
    return (
        <Box sx={{ p: 3, width: '100%', boxSizing: 'border-box' }}>
            <Typography variant="h5" gutterBottom>{tableDefinition.title || tableDefinition.name}</Typography>

            {allow?.insert && (tableDefinition.editable !== false) && (
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={handleAddRow}
                    sx={{ mb: 2 }}
                    disabled={editingRowId !== null}
                >
                    Añadir {tableDefinition.elementName || 'Registro'}
                </Button>
            )}

            <TableContainer component={Paper} sx={{ display: 'block' }}>
                <Table sx={{ minWidth: 1500 }} aria-label={`${name} data grid`}>
                    <TableHead>
                        <TableRow>
                            {visibleFields.map((field) => (
                                <TableCell key={field.name} sx={{ minWidth: 150, p: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Typography variant="subtitle2" component="div" sx={{ flexGrow: 1 }}>
                                            {field.label || field.title || field.name}
                                        </Typography>

                                        <IconButton
                                            size="small"
                                            onClick={() => handleSortClick(field.name)}
                                            color={sortColumn === field.name ? 'primary' : 'default'}
                                        >
                                            {sortColumn === field.name && sortDirection === 'asc' && <ArrowUpwardIcon fontSize="small" />}
                                            {sortColumn === field.name && sortDirection === 'desc' && <ArrowDownwardIcon fontSize="small" />}
                                            {sortColumn !== field.name && <FilterListIcon fontSize="small" sx={{ opacity: 0.5 }} />}
                                        </IconButton>
                                    </Box>
                                    <TextField
                                        variant="standard"
                                        size="small"
                                        placeholder="Filtrar..."
                                        value={columnFilters[field.name] || ''}
                                        onChange={(e) => handleColumnFilterChange(field.name, e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        fullWidth
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon sx={{ fontSize: 16 }} />
                                                </InputAdornment>
                                            ),
                                            disableUnderline: true,
                                        }}
                                        sx={{ mt: 0.5, '& .MuiInputBase-input': { p: 0.5, fontSize: 12 } }}
                                    />
                                </TableCell>
                            ))}
                            <TableCell align="right" sx={{ minWidth: 180, p: 1 }}>Acciones</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {processedData.length === 0 && !isLoadingData && !error && (
                            <TableRow>
                                <TableCell colSpan={visibleFields.length + 1} align="center">
                                    No hay datos para mostrar con los filtros aplicados.
                                </TableCell>
                            </TableRow>
                        )}
                        {processedData.map((row) => {
                            const rowId = getPrimaryKeyValues(row, primaryKey);
                            const isEditing = rowId === editingRowId;

                            return (
                                <TableRow key={rowId}>
                                    {visibleFields.map((field) => (
                                        <TableCell key={field.name} sx={{ minWidth: 150, p: 1 }}>
                                            {renderCell(row, field)}
                                        </TableCell>
                                    ))}
                                    <TableCell align="right" sx={{ minWidth: 180, p: 1 }}>
                                        {isEditing ? (
                                            <>
                                                <Button
                                                    onClick={handleSaveClick}
                                                    color="primary"
                                                    startIcon={<SaveIcon />}
                                                    size="small"
                                                    sx={{ mr: 1 }}
                                                >
                                                    Guardar
                                                </Button>
                                                <Button
                                                    onClick={handleCancelEdit}
                                                    color="secondary"
                                                    startIcon={<CancelIcon />}
                                                    size="small"
                                                >
                                                    Cancelar
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                {allow?.update && (tableDefinition.editable !== false) && (
                                                    <Button
                                                        onClick={() => handleEditClick(row)}
                                                        color="info"
                                                        startIcon={<EditIcon />}
                                                        size="small"
                                                        sx={{ mr: 1 }}
                                                        disabled={editingRowId !== null}
                                                    >
                                                        Editar
                                                    </Button>
                                                )}
                                                {allow?.delete && (tableDefinition.editable !== false) && (
                                                    <Button
                                                        onClick={() => handleDeleteClick(row)}
                                                        color="error"
                                                        startIcon={<DeleteIcon />}
                                                        size="small"
                                                        disabled={editingRowId !== null}
                                                    >
                                                        Eliminar
                                                    </Button>
                                                )}
                                            </>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default GenericDataGrid;