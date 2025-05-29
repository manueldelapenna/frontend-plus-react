// src/components/ProcedureForm.tsx
import React, { useState, FormEvent, ChangeEvent, useCallback, useMemo } from 'react';
import { ProcedureDef, CoreFunction, ProcedureParameter } from "backend-plus";
import { useParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';

// Importaciones de Material-UI
import {
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  FormHelperText,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material';
import { SelectChangeEvent } from '@mui/material/Select';
import { quitarGuionesBajos } from '../utils/functions';

const ProcedureForm: React.FC = () => {
  const { procedureName } = useParams<{ procedureName: string }>();
  const { clientContext } = useApp();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [executionLog, setExecutionLog] = useState<string[]>([]);

  const procedure: ProcedureDef | undefined = useMemo(() => {
    if (procedureName && clientContext?.procedure) {
      return clientContext.procedure[procedureName];
    }
    return undefined;
  }, [procedureName, clientContext]);

  const [formValues, setFormValues] = useState<Record<string, any>>(() => {
    if (!procedure) return {};
    const initialValues: Record<string, any> = {};
    procedure.parameters.forEach(param => {
      if (param.defaultValue !== undefined) {
        initialValues[param.name] = param.defaultValue;
      } else if (param.specialDefaultValue) {
        switch (param.specialDefaultValue) {
          case 'current_date':
            initialValues[param.name] = new Date().toISOString().split('T')[0];
            break;
          case 'current_datetime':
            const now = new Date();
            initialValues[param.name] = now.toISOString().substring(0, 16);
            break;
          default:
            initialValues[param.name] = param.specialDefaultValue;
            break;
        }
      } else {
        initialValues[param.name] = '';
      }
    });
    return initialValues;
  });

  React.useEffect(() => {
    if (procedure) {
      const newInitialValues: Record<string, any> = {};
      procedure.parameters.forEach(param => {
        if (param.defaultValue !== undefined) {
          newInitialValues[param.name] = param.defaultValue;
        } else if (param.specialDefaultValue) {
          switch (param.specialDefaultValue) {
            case 'current_date':
              newInitialValues[param.name] = new Date().toISOString().split('T')[0];
              break;
            case 'current_datetime':
              const now = new Date();
              newInitialValues[param.name] = now.toISOString().substring(0, 16);
              break;
            default:
              newInitialValues[param.name] = param.specialDefaultValue;
              break;
          }
        } else {
          newInitialValues[param.name] = '';
        }
      });
      setFormValues(newInitialValues);
      setExecutionLog([]);
    }
  }, [procedure]);

  const addLogMessage = useCallback((message: string, isError: boolean = false) => {
    const timestamp = new Date().toLocaleTimeString('es-AR');
    setExecutionLog(prev => [...prev, `[${timestamp}] ${isError ? 'ERROR: ' : ''}${message}`]);
  }, []);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent<any>, child?: React.ReactNode) => {
    const { name, value } = e.target;
    let newValue: any = value;

    if ((e.target as HTMLInputElement).type === 'checkbox') {
      newValue = (e.target as HTMLInputElement).checked;
    }

    setFormValues(prevValues => ({
      ...prevValues,
      [name]: newValue,
    }));
    setError(null);
    setSuccessMessage(null);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    setExecutionLog([]);

    if (!procedure) {
        setError('Error: La definición del procedimiento no está disponible.');
        addLogMessage('Error: La definición del procedimiento no está disponible.', true);
        setIsLoading(false);
        return;
    }

    addLogMessage(`Iniciando ejecución del procedimiento: ${procedure.action}...`);

    const paramsToSend: Record<string, any> = {};
    let hasErrorInParams = false;

    procedure.parameters.forEach(param => {
      let value = formValues[param.name];

      switch (param.typeName) {
        case 'decimal':
        case 'double':
          paramsToSend[param.name] = value === '' || value === null ? null : parseFloat(value);
          if (paramsToSend[param.name] !== null && isNaN(paramsToSend[param.name])) {
            setError(`El valor para ${param.label || param.name} no es un número válido.`);
            addLogMessage(`Error de validación: El valor para ${param.label || param.name} no es un número válido.`, true);
            hasErrorInParams = true;
          }
          break;
        case 'integer':
        case 'bigint':
          paramsToSend[param.name] = value === '' || value === null ? null : parseInt(value, 10);
          if (paramsToSend[param.name] !== null && isNaN(paramsToSend[param.name])) {
            setError(`El valor para ${param.label || param.name} no es un entero válido.`);
            addLogMessage(`Error de validación: El valor para ${param.label || param.name} no es un entero válido.`, true);
            hasErrorInParams = true;
          }
          break;
        case 'boolean':
          paramsToSend[param.name] = !!value;
          break;
        case 'jsonb':
        case 'jsona':
          try {
            paramsToSend[param.name] = value === '' || value === null ? null : JSON.parse(value);
          } catch (jsonError: any) {
            setError(`Error en el formato JSON para ${param.label || param.name}: ${jsonError.message}`);
            addLogMessage(`Error de validación: Formato JSON inválido para ${param.label || param.name}.`, true);
            hasErrorInParams = true;
          }
          break;
        case 'bytea':
            paramsToSend[param.name] = value || null;
            break;
        default:
          paramsToSend[param.name] = value === '' ? null : value;
          break;
      }
    });

    if (hasErrorInParams) {
      setIsLoading(false);
      return;
    }

    addLogMessage(`Parámetros enviados: ${JSON.stringify(paramsToSend, null, 2)}`);

    try {
      addLogMessage('Invocando coreFunction...');
      //const result = await (procedure.coreFunction as CoreFunction<any>)(paramsToSend, clientContext); 
      
      setSuccessMessage(procedure.resultOk || 'Procedimiento ejecutado con éxito.');
      addLogMessage('Procedimiento ejecutado con éxito.');
      //addLogMessage(`Resultado: ${JSON.stringify(result, null, 2)}`);
      //console.log('Resultado del procedimiento:', result);
    } catch (err: any) {
      console.error('Error al ejecutar el procedimiento:', err);
      setError(err.message || 'Ocurrió un error al ejecutar el procedimiento.');
      addLogMessage(`Error en la ejecución: ${err.message || 'Error desconocido.'}`, true);
    } finally {
      setIsLoading(false);
      addLogMessage('Ejecución finalizada.');
    }
  };

  const renderInputField = useCallback((param: ProcedureParameter) => {
    const commonProps: any = { 
      id: param.name,
      name: param.name,
      label: param.label || param.name,
      variant: "outlined" as "outlined",
      fullWidth: true,
      margin: "dense" as "dense",
      size: "small" as "small",
      helperText: param.description,
      disabled: isLoading,
      onChange: handleChange,
      // Aplicar el tamaño de fuente general a los inputs
      sx: { fontSize: '0.8rem' } // Reducción sutil
    };

    if (param.options && param.options.length > 0) {
      return (
        <FormControl fullWidth margin="dense" size="small">
          <InputLabel id={`${param.name}-label`} sx={{ fontSize: '0.8rem' }}>{param.label || param.name}</InputLabel>
          <Select
            labelId={`${param.name}-label`}
            value={formValues[param.name] === undefined ? '' : formValues[param.name]}
            onChange={handleChange}
            name={param.name}
            id={param.name}
            label={param.label || param.name}
            disabled={isLoading}
            sx={{ fontSize: '0.8rem' }} // Reducción sutil
            renderValue={(selected) => (
              <Typography sx={{ fontSize: '0.8rem' }}>{selected as string}</Typography> // Asegurar que el valor renderizado también sea pequeño
            )}
          >
            {param.defaultValue === undefined && <MenuItem value="" sx={{ fontSize: '0.8rem' }}><em>Seleccione...</em></MenuItem>}
            {param.options.map(option => (
              <MenuItem key={option} value={option} sx={{ fontSize: '0.8rem' }}>
                {option}
              </MenuItem>
            ))}
          </Select>
          {param.description && <FormHelperText sx={{ fontSize: '0.7rem' }}>{param.description}</FormHelperText>} {/* Helper text aún más pequeño */}
        </FormControl>
      );
    }

    switch (param.typeName) {
      case 'text':
      case 'interval':
      case 'tsrange':
      case 'time_range':
      case 'daterange':
        return <TextField type="text" value={formValues[param.name] || ''} {...commonProps} />;
      case 'decimal':
      case 'double':
        return <TextField type="number" inputProps={{ step: "any", style: { fontSize: '0.8rem' } }} value={formValues[param.name] || ''} {...commonProps} />;
      case 'integer':
      case 'bigint':
        return <TextField type="number" inputProps={{ step: "1", style: { fontSize: '0.8rem' } }} value={formValues[param.name] || ''} {...commonProps} />;
      case 'boolean':
        return (
          <FormControlLabel
            control={
              <Checkbox
                checked={!!formValues[param.name]}
                onChange={handleChange}
                name={param.name}
                id={param.name}
                disabled={isLoading}
                size="small"
              />
            }
            label={<Typography sx={{ fontSize: '0.8rem' }}>{param.label || param.name}</Typography>} // Reducción sutil para el label
            sx={{ mt: 1, mb: 0 }}
          />
        );
      case 'date':
      case 'timestamp':
      case 'time':
        // Para inputs de fecha/hora, también aplicar el tamaño de fuente al InputLabel
        return <TextField type={param.typeName === 'date' ? 'date' : param.typeName === 'timestamp' ? 'datetime-local' : 'time'} value={formValues[param.name] || ''} {...commonProps} InputLabelProps={{ shrink: true, sx: { fontSize: '0.8rem' } }} />;
      case 'jsonb':
      case 'jsona':
        return <TextField multiline rows={5} value={formValues[param.name] || ''} {...commonProps} InputProps={{ sx: { fontSize: '0.8rem' } }} />; // También para el texto del input
      case 'bytea':
        return (
          <FormControl fullWidth margin="dense">
            <Typography variant="body2" color="textSecondary" component="label" htmlFor={param.name} sx={{ fontSize: '0.8rem' }}>
              {param.label || param.name}
            </Typography>
            <input
              type="file"
              id={param.name}
              name={param.name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const files = e.target.files;
                setFormValues(prev => ({ ...prev, [param.name]: files && files.length > 0 ? files[0] : undefined }));
              }}
              disabled={isLoading}
              style={{ padding: '6px 0', fontSize: '0.8rem' }} // Ajustar padding y fuente del input file
            />
            {param.description && <FormHelperText sx={{ fontSize: '0.7rem' }}>{param.description}</FormHelperText>}
          </FormControl>
        );
      default:
        return <TextField type="text" value={formValues[param.name] || ''} {...commonProps} />;
    }
  }, [formValues, handleChange, isLoading]);

  if (!procedure) {
    return (
      <Box sx={{ 
        p: 2, 
        width: '100%', 
        boxSizing: 'border-box', 
        mt: 0, // Aún más cerca del toolbar
        bgcolor: 'background.paper', 
        borderRadius: 2, 
        boxShadow: 3, 
        textAlign: 'center' 
      }}>
        <CircularProgress sx={{ mb: 2 }} />
        <Typography variant="h6" color="text.secondary">
          Cargando procedimiento o no encontrado...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      p: 2, 
      width: '100%', 
      boxSizing: 'border-box', 
      mt: 0, // Pegado al toolbar para máximo ahorro de espacio
      bgcolor: 'background.paper', 
      borderRadius: 2, 
      boxShadow: 3,
      fontSize: '0.8rem' // Ajuste global sutil para el tamaño de la letra base del Box
    }}>
      <Typography variant="h5" component="h2" gutterBottom align="left">
        {quitarGuionesBajos(procedure.proceedLabel || procedure.action)}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2, fontSize: '0.8rem' }}>{error}</Alert>}
      {successMessage && <Alert severity="success" sx={{ mb: 2, fontSize: '0.8rem' }}>{successMessage}</Alert>}

      <form onSubmit={handleSubmit}>
        {procedure.parameters.map(param => (
          <div key={param.name}>
            {renderInputField(param)}
          </div>
        ))}

        <Button
          type="submit"
          variant="contained"
          color="primary"
          // fullWidth // Quitado para que sea de tamaño normal y se alinee a la izquierda
          disabled={isLoading}
          sx={{ mt: 2 }} // Mantener un poco de margen superior
          size="medium" // Tamaño normal para un botón
          startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
        >
          {isLoading ? 'Ejecutando...' : (procedure.proceedLabel || 'Ejecutar')}
        </Button>
      </form>

      {executionLog.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="h6" gutterBottom sx={{ fontSize: '0.9rem' }}>
            Registro de Ejecución
          </Typography>
          <Box 
            sx={{ 
              bgcolor: 'grey.100', 
              p: 2, 
              borderRadius: 1, 
              maxHeight: '200px',
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.75rem', // Un poco más pequeña para el log
              whiteSpace: 'pre-wrap',
            }}
          >
            {executionLog.map((log, index) => (
              <Typography 
                key={index} 
                component="pre"
                sx={{ 
                  margin: 0, 
                  color: log.includes('ERROR:') ? 'error.main' : 'text.primary',
                  fontSize: 'inherit' // Heredar del padre, que ya está ajustado
                }}
              >
                {log}
              </Typography>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default ProcedureForm;