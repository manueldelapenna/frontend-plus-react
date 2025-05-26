import React, { useState, useEffect } from 'react';
import {ProcedureDef} from "backend-plus";
import { Link } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';


interface MenuItem {
    id: number;
    label: string;
    url: string;
}

const Menu: React.FC = () => {
    const { clientContext } = useApp();

    return (
        <nav className="main-menu">
            <ul>
                <li>
                    <Link to="/menu">Inicio / Dashboard</Link>
                </li>
                {/* --- Enlaces estáticos actualizados --- */}
                <li>
                    <Link to="/table/users">Gestionar Usuarios</Link>
                </li>
                <li>
                    <Link to="/table/products">Gestionar Productos</Link>
                </li>

                {/* --- Enlaces dinámicos actualizados --- */}
                {clientContext && clientContext.tableStructures && Object.keys(clientContext.tableStructures).length > 0 && (
                    <>
                        <li className="menu-category-header">Gestión de Datos Dinámicos</li>
                        {Object.keys(clientContext.tableStructures).map((tableName) => (
                            <li key={tableName}>
                                {/* ¡¡Enlace ACTUALIZADO a /table/${tableName}!! */}
                                <Link to={`/table/${tableName}`}>
                                    {clientContext.tableStructures[tableName].label || tableName.charAt(0).toUpperCase() + tableName.slice(1)}
                                </Link>
                            </li>
                        ))}
                    </>
                )}

                {clientContext && clientContext.procedures && clientContext.procedures.length > 0 && (
                    <>
                        <li className="menu-category-header">Procesos / Procedimientos</li>
                        {/*clientContext.procedures.map((proc: ProcedureDef : => (
                            <li key={proc.id}>
                                {/*<Link to={`/procedures/${proc.name}`}>{proc.name}</Link>
                            </li>
                        ))*/}
                    </>
                )}
            </ul>
        </nav>
    );
}
export default Menu;
