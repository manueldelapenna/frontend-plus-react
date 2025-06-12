import React from 'react';
// IMPORTACIÓN ADAPTADA: Asegúrate de que esta ruta sea correcta
// Ahora apunta a la nueva ubicación de SuccessDisplay en 'pages'
import SuccessDisplay from './SuccessDisplay'; 
// Si tienes más componentes como 'AnotherResultComponent', los importarías aquí
// import AnotherResultComponent from '../../pages/procedure-results/AnotherResultComponent'; 

type ResultComponentMap = {
    [key: string]: React.FC<any>; // Un objeto que mapea strings a componentes funcionales de React
};

export const resultComponents: ResultComponentMap = {
    'successful_operation': SuccessDisplay, // Si 'resultOk' es 'successful_operation', renderiza SuccessDisplay
    // Aquí añadirías más mapeos si tuvieras otros tipos de 'resultOk'
    // 'otro_tipo_de_resultado': AnotherResultComponent,
};