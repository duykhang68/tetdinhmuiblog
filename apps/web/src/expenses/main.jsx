import React from 'react';
import {createRoot} from 'react-dom/client';
import Expenses from './Expenses.jsx';
import './expenses.css';
createRoot(document.getElementById('root')).render(<React.StrictMode><Expenses/></React.StrictMode>);
