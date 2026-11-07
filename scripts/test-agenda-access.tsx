import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
// tsx usa JSX clásico con el tsconfig del repo; Next aplica el runtime automático.
(globalThis as any).React = React;
const Module = require('node:module'); const original = Module._load;
let auth: any = {}; let pathname = '/dashboard';
Module._load = function(id: string, ...args: any[]) {
  if (id === '@/lib/auth-context') return { useAuth: () => auth };
  if (id === 'next/navigation') return { usePathname: () => pathname, useRouter: () => ({ replace() {} }) };
  return original.call(this, id, ...args);
};
const { ProtectedRoute } = require('../src/components/layout/protected-route');
const { AgendaHeader } = require('../src/components/agenda/agenda-header');
Module._load = original;
const view = () => renderToStaticMarkup(<ProtectedRoute><div>Contenido protegido</div></ProtectedRoute>);
let count = 0;
function t(name: string, fn: () => void) { fn(); count++; console.log('OK ' + name); }
t('sesión cargando muestra logo sin contenido ni candado', () => { auth = { loading: true }; const s = view(); assert.ok(s.includes('logo-horizontal')); assert.ok(!s.includes('Contenido protegido')); assert.ok(!s.includes('Acceso restringido')); });
t('profesional redirigiendo muestra logo', () => { auth = { loading: false, user: { role: 'barber' }, canAccess: () => false }; const s = view(); assert.ok(s.includes('logo-horizontal')); assert.ok(!s.includes('Acceso restringido')); });
t('profesional autorizado ve su agenda', () => { pathname = '/dashboard/mi-agenda'; auth.canAccess = () => true; assert.ok(view().includes('Contenido protegido')); });
t('restricción real de otro rol se conserva', () => { auth = { loading: false, user: { role: 'receptionist' }, canAccess: () => false }; assert.ok(view().includes('Acceso restringido')); });
const props = { name: 'Profesional Ejemplo', date: '2026-11-07', onDateChange() {}, onChangeDay() {}, barbers: [{id:'a',name:'Profesional Ejemplo'},{id:'b',name:'Otro'}], selectedBarber:'a', onBarberChange() {}, onBlock() {}, notifications:null };
t('profesional ve saludo sin desplegable', () => { const s = renderToStaticMarkup(<AgendaHeader {...props} canSelectProfessional={false}/>); assert.ok(s.includes('Profesional')); assert.ok(!s.includes('<select')); });
t('admin tiene selector junto a la fecha', () => { const s = renderToStaticMarkup(<AgendaHeader {...props} canSelectProfessional/>); assert.ok(s.includes('<select')); assert.ok(s.includes('Elegir fecha')); });
console.log(`${count} pruebas correctas`);
