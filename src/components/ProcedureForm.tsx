// src/components/ProcedureForm.tsx
import React, { useState, FormEvent, ChangeEvent } from 'react';
import {ProcedureDef, CoreFunction, ProcedureParameter} from "backend-plus"
import { useParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';

// Props que espera nuestro componente ProcedureForm
interface ProcedureFormProps {
  onSubmit: (params: Record<string, any>) => any;
  // Opcional: para manejar errores de envío, etc.
  // onError?: (error: any) => void;
  // Opcional: para mostrar un spinner mientras se envía
  // isLoading?: boolean;
}

const ProcedureForm: React.FC = () => {
  // Estado local para los valores del formulario
  // Inicializamos los valores con los `defaultValue` o `specialDefaultValue`
  const { procedureName } = useParams<{ procedureName: string }>();
  const { clientContext } = useApp();
  const procedure: ProcedureDef = clientContext!.procedure[procedureName!];
  const [formValues, setFormValues] = useState<Record<string, any>>(() => {
    const initialValues: Record<string, any> = {};
    procedure.parameters.forEach(param => {
      if (param.defaultValue !== undefined) {
        initialValues[param.name] = param.defaultValue;
      } else if (param.specialDefaultValue) {
        // Aquí podríamos añadir lógica para resolver 'specialDefaultValue'
        // Por ejemplo, si 'specialDefaultValue' es 'current_date', lo resolvemos aquí.
        // Por ahora, solo lo asignamos directamente.
        switch (param.specialDefaultValue) {
          case 'current_date':
            initialValues[param.name] = new Date().toISOString().split('T')[0]; // Formato 'YYYY-MM-DD'
            break;
          // Agrega más casos según tus necesidades (ej: 'current_user', 'now', etc.)
          default:
            initialValues[param.name] = param.specialDefaultValue;
            break;
        }
      } else {
        // Asegurarse de que todos los campos tengan una entrada en formValues
        // Esto es útil para controlar inputs no controlados si no se inicializan.
        initialValues[param.name] = undefined; 
      }
    });
    return initialValues;
  });

  // Función para manejar el cambio en los inputs del formulario
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let newValue: any;

    if (type === 'checkbox') {
      newValue = (e.target as HTMLInputElement).checked;
    } else {
      newValue = value;
      // Convertir a número si el tipo es numérico y el valor no está vacío
      if (['decimal', 'integer', 'bigint', 'double'].includes(name) && newValue !== '') { // El name aquí debería ser el typeName
          // Esto es incorrecto, debería ser el typeName, no el name del input.
          // Correcto: if (['decimal', 'integer', 'bigint', 'double'].includes(e.target.dataset.typeName || '') && newValue !== '') {
          // Mejor: Hacer la conversión al momento de enviar, o usar input type="number" y parsear.
          // Por ahora, dejamos que sea string y la conversión se haga en `onSubmit` o en el backend.
      }
    }

    setFormValues(prevValues => ({
      ...prevValues,
      [name]: newValue,
    }));
  };

  // Función para manejar el envío del formulario
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Aquí puedes añadir lógica de validación antes de llamar a onSubmit
    //onSubmit(formValues);
  };

  // Función auxiliar para renderizar el campo de entrada adecuado
  const renderInputField = (param: ProcedureParameter) => {
    const commonProps = {
      id: param.name,
      name: param.name,
      value: formValues[param.name] === undefined ? '' : formValues[param.name], // Evita que 'undefined' se muestre en inputs
      onChange: handleChange,
      placeholder: param.description || '',
      className: 'form-control', // Clase CSS para estilado
    };

    switch (param.typeName) {
      case 'text':
      case 'interval': // 'interval' podría ser un input de texto para formatos como '1 year 2 months'
        return <input type="text" {...commonProps} />;
      case 'decimal':
      case 'double':
        return <input type="number" step="any" {...commonProps} />; // `step="any"` permite decimales
      case 'integer':
      case 'bigint':
        return <input type="number" step="1" {...commonProps} />; // `step="1"` para enteros
      case 'boolean':
        return (
          <input
            type="checkbox"
            {...commonProps}
            checked={!!formValues[param.name]} // Convertir a boolean
            value="" // Los checkboxes no usan el atributo value de la misma forma para su estado
          />
        );
      case 'date':
        return <input type="date" {...commonProps} />;
      case 'timestamp':
        return <input type="datetime-local" {...commonProps} />; // Para fecha y hora local
      case 'time':
        return <input type="time" {...commonProps} />;
      case 'jsonb':
      case 'jsona':
        return <textarea {...commonProps} rows={5}></textarea>; // Para JSON, un textarea es lo más práctico
      case 'bytea':
        // Para datos binarios (archivos), se necesita un manejo especial.
        // Aquí solo se renderiza un input de tipo file, pero la gestión de archivos (upload)
        // se debería hacer a través de la prop `onSubmit` y la configuración `multipart` de ProcedureDef.
        return <input type="file" {...commonProps} onChange={/* Necesitaría un handler específico para FileList */ e => console.log('File selected:', e.target.files)} />;
      case 'tsrange':
      case 'time_range':
      case 'daterange':
        // Estos tipos de rango requerirían dos campos de entrada (inicio y fin)
        // o un componente de selección de rango especializado.
        // Por simplicidad, aquí un input de texto. Considera crear un sub-componente.
        return <input type="text" {...commonProps} placeholder={`${param.label || param.name} (rango)`} />;
      default:
        // Si hay 'options', siempre es un select
        if (param.options && param.options.length > 0) {
          return (
            <select {...commonProps}>
              {/* Opcional: añadir una opción por defecto para "Seleccionar" */}
              {/* <option value="">-- Seleccione --</option> */}
              {param.options.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          );
        }
        // Tipo desconocido o no especificado, por defecto un input de texto
        return <input type="text" {...commonProps} />;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="procedure-form">
      <h3>{procedure.proceedLabel || procedure.action}</h3>
      {procedure.parameters.map(param => (
        <div key={param.name} className="form-group">
          <label htmlFor={param.name}>
            {param.label || param.name}
            {/* Si necesitas marcar campos obligatorios, aquí podrías añadir un "*" */}
          </label>
          {renderInputField(param)}
          {param.description && <small className="form-text text-muted">{param.description}</small>}
        </div>
      ))}

      <button type="submit" className="btn btn-primary">
        {procedure.proceedLabel || 'Ejecutar'}
      </button>
    </form>
  );
};

export default ProcedureForm;