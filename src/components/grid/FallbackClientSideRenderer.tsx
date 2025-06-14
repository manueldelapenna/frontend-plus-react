import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { ClientSideRendererProps } from './clientSideRenderers'; // Asegúrate de importar la interfaz

const FallbackClientSideRenderer: React.FC<ClientSideRendererProps> = ({ column, row, fieldDefinition }) => {
    const value = row[column.key];
    const clientSideName = fieldDefinition?.clientSide || 'Desconocido';

    return (
        <Tooltip title={`Componente clientSide '${clientSideName}' no implementado. Mostrando valor por defecto.`}>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between', // Para espaciar el valor y el icono
                    gap: 1, // Espacio entre elementos
                    width: '100%',
                    height: '100%',
                    paddingLeft: '8px',
                    backgroundColor: 'rgba(255, 193, 7, 0.1)', // Amarillo claro para advertencia
                    border: '1px dashed rgba(255, 193, 7, 0.5)',
                    boxSizing: 'border-box',
                    overflow: 'hidden', // Evita que el contenido se desborde
                }}
            >
                <Typography variant="body2" noWrap sx={{ flexGrow: 1 }}>
                    {value !== null && value !== undefined ? String(value) : '*Vacío*'}
                </Typography>
                <WarningAmberIcon
                    sx={{
                        fontSize: 18,
                        color: 'warning.main',
                        marginRight: '4px' // Pequeño margen a la derecha del icono
                    }}
                />
            </Box>
        </Tooltip>
    );
};

export default FallbackClientSideRenderer;