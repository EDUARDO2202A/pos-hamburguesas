// ==========================================
// 1. BASE DE DATOS LOCAL (DEXIE / INDEXEDDB)
// ==========================================
const db = new Dexie('POS_La40_DB');

// v3: Se agrega el campo "nombre_cliente" a los pedidos
db.version(3).stores({
    pedidos: '++id, fecha, total, sincronizado, estado, nombre_cliente',
    detalle_pedido: '++id, pedido_id, producto, cantidad, precio_unitario, notas'
}).upgrade(tx => {
    return tx.table('pedidos').toCollection().modify(pedido => {
        if (!pedido.estado) pedido.estado = 'entregado';
        if (!pedido.nombre_cliente) pedido.nombre_cliente = '';
    });
});

// ==========================================
// 2. ESTADO DE LA APLICACIÓN Y REFERENCIAS
// ==========================================
let carrito = [];
let productoActual = null; 
let cantidadModal = 1;
let cantidadConNota = 1;
let notasSeleccionadas = [];

// Elementos Generales
const ticketList = document.getElementById('ticket-list');
const totalPriceEl = document.getElementById('total-price');
const inputNombreCliente = document.getElementById('nombre-cliente');

// Elementos Pestañas
const viewVender = document.getElementById('view-vender');
const viewPedidos = document.getElementById('view-pedidos');
const viewVentas = document.getElementById('view-ventas');
const tabVender = document.getElementById('tab-vender');
const tabPendientes = document.getElementById('tab-pendientes');
const tabVentas = document.getElementById('tab-ventas');
const badgePendientes = document.getElementById('badge-pendientes');
const pedidosGrid = document.getElementById('pedidos-grid');
const sinPendientesEl = document.getElementById('sin-pendientes');

// Elementos Modal Normal
const modalNotas = document.getElementById('modal-notas');
const modalProductName = document.getElementById('modal-product-name');
const modalQtyVal = document.getElementById('modal-qty-val');
const splitBox = document.getElementById('split-box');
const modalSplitVal = document.getElementById('modal-split-val');
const customNoteInput = document.getElementById('custom-note');
const noteButtons = document.querySelectorAll('.btn-note');

// Elementos Modal Granel
const modalGranel = document.getElementById('modal-granel');
const inputGranelPesos = document.getElementById('input-granel-pesos');
const sliderGranelPesos = document.getElementById('slider-granel-pesos');
const textGranelGramos = document.getElementById('granel-gramos');
const customNoteGranel = document.getElementById('custom-note-granel');

// Elementos Registro de Ventas
const ventasRangoEl = document.getElementById('ventas-rango');
const ventasFechaInput = document.getElementById('ventas-fecha');
const ventasResumenEl = document.getElementById('ventas-resumen');
const ventasDetalleEl = document.getElementById('ventas-detalle');
const tablaProductosEl = document.getElementById('tabla-productos');
const tablaDetalleEl = document.getElementById('tabla-detalle');
const tituloDetalleEl = document.getElementById('titulo-detalle');
const nubeEstadoEl = document.getElementById('nube-estado');
const btnSubirNube = document.getElementById('btn-subir-nube');

// ==========================================
// 3. ABRIR MODALES AL TOCAR PRODUCTO DEL MENÚ
// ==========================================
document.querySelectorAll('.btn-product').forEach(btn => {
    btn.addEventListener('click', () => {
        const nombre = btn.dataset.name;
        const precio = parseFloat(btn.dataset.price);
        const tipo = btn.dataset.type; // Verifica si es venta a granel

        if (tipo === 'granel') {
            abrirModalGranel(nombre, precio);
        } else {
            abrirModalProducto({ nombre, precio, cantidad: 1, notas: '' }, null);
        }
    });
});

// --- LÓGICA MODAL GRANEL (POR PESO) ---
let precioKiloActual = 350;

function abrirModalGranel(nombre, precioKilo) {
    productoActual = { nombre: nombre, precioKilo: precioKilo };
    precioKiloActual = precioKilo;
    
    // Resetear a valores por defecto (ej. $70)
    inputGranelPesos.value = 70;
    sliderGranelPesos.value = 70;
    customNoteGranel.value = '';
    calcularGramos();
    
    modalGranel.classList.remove('hidden');
}

function calcularGramos() {
    const pesos = parseFloat(inputGranelPesos.value) || 0;
    // Fórmula: (Monto / PrecioPorKilo) * 1000 gramos
    const gramos = Math.round((pesos / precioKiloActual) * 1000);
    textGranelGramos.textContent = `${gramos}g`;
}

// Sincronizar slider e input numérico
inputGranelPesos.addEventListener('input', () => {
    sliderGranelPesos.value = inputGranelPesos.value;
    calcularGramos();
});
sliderGranelPesos.addEventListener('input', () => {
    inputGranelPesos.value = sliderGranelPesos.value;
    calcularGramos();
});

document.getElementById('btn-cancel-granel').addEventListener('click', () => {
    modalGranel.classList.add('hidden');
});

document.getElementById('btn-save-granel').addEventListener('click', () => {
    const pesos = parseFloat(inputGranelPesos.value) || 0;
    if (pesos <= 0) return alert('Ingresa un monto válido.');

    const gramos = textGranelGramos.textContent;
    const notaExtra = customNoteGranel.value.trim();
    const notasFinales = notaExtra ? `${gramos}, ${notaExtra}` : gramos;

    // Se agrega al carrito como 1 producto con el precio total en pesos y los gramos en las notas
    carrito.push({
        nombre: productoActual.nombre,
        precio: pesos,
        cantidad: 1,
        notas: notasFinales
    });

    renderizarTicket();
    modalGranel.classList.add('hidden');
});

// --- LÓGICA MODAL NORMAL ---
function abrirModalProducto(item, editIndex) {
    productoActual = { nombre: item.nombre, precio: item.precio, editIndex };
    cantidadModal = item.cantidad;
    cantidadConNota = item.cantidad;
    notasSeleccionadas = item.notas ? item.notas.split(', ') : [];
    customNoteInput.value = '';

    modalProductName.textContent = `${item.nombre} ($${item.precio})`;
    actualizarVistaModal();
    modalNotas.classList.remove('hidden');
}

function actualizarVistaModal() {
    modalQtyVal.textContent = cantidadModal;
    noteButtons.forEach(btn => {
        if (notasSeleccionadas.includes(btn.textContent)) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    const hayNotas = notasSeleccionadas.length > 0 || customNoteInput.value.trim() !== '';
    if (cantidadModal > 1 && hayNotas && productoActual.editIndex === null) {
        splitBox.classList.remove('hidden');
        if (cantidadConNota > cantidadModal) cantidadConNota = cantidadModal;
        if (cantidadConNota < 1) cantidadConNota = 1;
        modalSplitVal.textContent = cantidadConNota;
    } else {
        splitBox.classList.add('hidden');
        cantidadConNota = cantidadModal;
    }

    document.getElementById('btn-save-note').textContent = productoActual.editIndex !== null ? 'Actualizar' : 'Agregar al Ticket';
    document.getElementById('btn-cancel-modal').textContent = productoActual.editIndex !== null ? 'Eliminar' : 'Cancelar';
}

document.getElementById('btn-qty-minus').addEventListener('click', () => { if (cantidadModal > 1) { cantidadModal--; actualizarVistaModal(); } });
document.getElementById('btn-qty-plus').addEventListener('click', () => { cantidadModal++; cantidadConNota = cantidadModal; actualizarVistaModal(); });
document.querySelectorAll('.btn-quick-qty').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.add) cantidadModal += parseInt(btn.dataset.add);
        else if (btn.dataset.set) cantidadModal = parseInt(btn.dataset.set);
        cantidadConNota = cantidadModal;
        actualizarVistaModal();
    });
});
document.getElementById('btn-split-minus').addEventListener('click', () => { if (cantidadConNota > 1) { cantidadConNota--; modalSplitVal.textContent = cantidadConNota; } });
document.getElementById('btn-split-plus').addEventListener('click', () => { if (cantidadConNota < cantidadModal) { cantidadConNota++; modalSplitVal.textContent = cantidadConNota; } });

noteButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const nota = btn.textContent;
        if (notasSeleccionadas.includes(nota)) notasSeleccionadas = notasSeleccionadas.filter(n => n !== nota);
        else notasSeleccionadas.push(nota);
        actualizarVistaModal();
    });
});
customNoteInput.addEventListener('input', actualizarVistaModal);

document.getElementById('btn-save-note').addEventListener('click', () => {
    let listaNotas = [...notasSeleccionadas];
    const notaExtra = customNoteInput.value.trim();
    if (notaExtra) listaNotas.push(notaExtra);
    const textoNotas = listaNotas.join(', ');

    if (productoActual.editIndex !== null) {
        carrito[productoActual.editIndex].cantidad = cantidadModal;
        carrito[productoActual.editIndex].notas = textoNotas;
    } else {
        if (textoNotas !== '' && cantidadConNota < cantidadModal) {
            const normales = cantidadModal - cantidadConNota;
            agregarOAgruparCarrito(productoActual.nombre, productoActual.precio, normales, '');
            agregarOAgruparCarrito(productoActual.nombre, productoActual.precio, cantidadConNota, textoNotas);
        } else {
            agregarOAgruparCarrito(productoActual.nombre, productoActual.precio, cantidadModal, textoNotas);
        }
    }
    renderizarTicket();
    modalNotas.classList.add('hidden');
});

function agregarOAgruparCarrito(nombre, precio, cantidad, notas) {
    const existente = carrito.find(item => item.nombre === nombre && item.notas === notas);
    if (existente) existente.cantidad += cantidad;
    else carrito.push({ nombre, precio, cantidad, notas });
}

document.getElementById('btn-cancel-modal').addEventListener('click', () => {
    if (productoActual.editIndex !== null) { carrito.splice(productoActual.editIndex, 1); renderizarTicket(); }
    modalNotas.classList.add('hidden');
});

// ==========================================
// 4. RENDERIZAR TICKET
// ==========================================
function renderizarTicket() {
    ticketList.innerHTML = '';
    let total = 0;

    if (carrito.length === 0) {
        ticketList.innerHTML = '<li class="empty-msg">Toca un producto para empezar</li>';
        totalPriceEl.textContent = '0.00';
        return;
    }

    carrito.forEach((item, index) => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;

        const li = document.createElement('li');
        li.className = 'ticket-item';
        li.innerHTML = `
            <div class="ticket-item-info">
                <strong><span class="ticket-item-qty">${item.cantidad}x</span>${item.nombre}</strong>
                ${item.notas ? `<span class="ticket-item-notes">⚠️ ${item.notas}</span>` : ''}
            </div>
            <div class="ticket-item-price">$${subtotal.toFixed(2)}</div>
        `;
        // Evitamos abrir el modal de edición si es venta a granel para mantenerlo simple
        if (!item.notas.includes('g')) {
            li.addEventListener('click', () => abrirModalProducto(item, index));
        }
        ticketList.appendChild(li);
    });

    totalPriceEl.textContent = total.toFixed(2);
}

// ==========================================
// 5. COBRAR Y GUARDAR LOCALMENTE
// ==========================================
document.getElementById('btn-cobrar').addEventListener('click', async () => {
    if (carrito.length === 0) {
        alert('Agrega al menos un producto antes de cobrar.');
        return;
    }

    const totalVenta = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    const nombreCliente = inputNombreCliente.value.trim();

    try {
        const pedidoId = await db.pedidos.add({
            fecha: new Date().toISOString(),
            total: totalVenta,
            sincronizado: 0,
            estado: 'pendiente',
            nombre_cliente: nombreCliente
        });

        const detalles = carrito.map(item => ({
            pedido_id: pedidoId,
            producto: item.nombre,
            cantidad: item.cantidad,
            precio_unitario: item.precio,
            notas: item.notas
        }));

        await db.detalle_pedido.bulkAdd(detalles);

        // Resetear carrito y nombre
        carrito = [];
        inputNombreCliente.value = '';
        renderizarTicket();
        actualizarBadgePendientes();
        alert(`✅ Orden #${pedidoId} cobrada ($${totalVenta.toFixed(2)})`);
    } catch (error) {
        console.error('Error al guardar localmente:', error);
        alert('❌ Error al guardar la venta.');
    }
});

// ==========================================
// 6. PESTAÑAS Y PEDIDOS PENDIENTES
// ==========================================
function mostrarVista(vista) {
    viewVender.classList.toggle('hidden', vista !== 'vender');
    viewPedidos.classList.toggle('hidden', vista !== 'pendientes');
    viewVentas.classList.toggle('hidden', vista !== 'ventas');
    tabVender.classList.toggle('active', vista === 'vender');
    tabPendientes.classList.toggle('active', vista === 'pendientes');
    tabVentas.classList.toggle('active', vista === 'ventas');

    if (vista === 'pendientes') renderizarPendientes();
    if (vista === 'ventas') renderizarVentas();
}

tabVender.addEventListener('click', () => mostrarVista('vender'));
tabPendientes.addEventListener('click', () => mostrarVista('pendientes'));
tabVentas.addEventListener('click', () => mostrarVista('ventas'));
document.getElementById('btn-volver').addEventListener('click', () => mostrarVista('vender'));

async function actualizarBadgePendientes() {
    const cantidad = await db.pedidos.where('estado').equals('pendiente').count();
    badgePendientes.textContent = cantidad;
    badgePendientes.classList.toggle('zero', cantidad === 0);
}

function minutosDesde(fechaISO) {
    return Math.max(0, Math.floor((Date.now() - new Date(fechaISO).getTime()) / 60000));
}

async function renderizarPendientes() {
    const pendientes = await db.pedidos.where('estado').equals('pendiente').sortBy('id');
    const ids = pendientes.map(p => p.id);
    const detalles = ids.length ? await db.detalle_pedido.where('pedido_id').anyOf(ids).toArray() : [];

    pedidosGrid.innerHTML = '';
    sinPendientesEl.classList.toggle('hidden', pendientes.length > 0);

    pendientes.forEach(pedido => {
        const minutos = minutosDesde(pedido.fecha);
        const hora = new Date(pedido.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

        const card = document.createElement('div');
        card.className = 'pedido-card' + (minutos >= 10 ? ' urgente' : '');

        const head = document.createElement('div');
        head.className = 'pedido-head';
        
        const numWrap = document.createElement('div');
        const num = document.createElement('span');
        num.className = 'pedido-num';
        num.textContent = `Pedido #${pedido.id}`;
        numWrap.appendChild(num);
        
        // Mostrar nombre si existe
        if (pedido.nombre_cliente) {
            const nombre = document.createElement('strong');
            nombre.className = 'pedido-nombre-cliente';
            nombre.textContent = `👤 ${pedido.nombre_cliente}`;
            numWrap.appendChild(nombre);
        }

        const tiempo = document.createElement('span');
        tiempo.className = 'pedido-tiempo';
        tiempo.textContent = `${hora} · hace ${minutos} min`;
        
        head.append(numWrap, tiempo);

        const lista = document.createElement('ul');
        lista.className = 'pedido-items';
        detalles.filter(d => d.pedido_id === pedido.id).forEach(d => {
                const li = document.createElement('li');
                const strong = document.createElement('strong');
                const qty = document.createElement('span');
                qty.className = 'ticket-item-qty';
                qty.textContent = `${d.cantidad}x`;
                strong.append(qty, document.createTextNode(d.producto));
                li.appendChild(strong);
                if (d.notas) {
                    const nota = document.createElement('span');
                    nota.className = 'ticket-item-notes';
                    nota.textContent = `⚠️ ${d.notas}`;
                    li.appendChild(nota);
                }
                lista.appendChild(li);
            });

        const total = document.createElement('div');
        total.className = 'pedido-total';
        total.textContent = `Total: $${Number(pedido.total).toFixed(2)}`;

        const btnListo = document.createElement('button');
        btnListo.type = 'button';
        btnListo.className = 'btn-listo';
        btnListo.textContent = '✅ Listo / Entregado';
        btnListo.addEventListener('click', () => marcarEntregado(pedido.id));

        card.append(head, lista, total, btnListo);
        pedidosGrid.appendChild(card);
    });

    actualizarBadgePendientes();
}

async function marcarEntregado(pedidoId) {
    await db.pedidos.update(pedidoId, { estado: 'entregado' });
    renderizarPendientes();
}

setInterval(() => { if (!viewPedidos.classList.contains('hidden')) renderizarPendientes(); }, 30000);
actualizarBadgePendientes();

// ==========================================
// 7. REGISTRO DE VENTAS (DÍA / SEMANA / MES)
// ==========================================
let periodoVentas = 'dia';
let fechaVentas = inicioDelDia(new Date());

// --- Utilidades de fechas ---
function inicioDelDia(f) {
    return new Date(f.getFullYear(), f.getMonth(), f.getDate());
}

function fechaParaInput(f) {
    const mm = String(f.getMonth() + 1).padStart(2, '0');
    const dd = String(f.getDate()).padStart(2, '0');
    return `${f.getFullYear()}-${mm}-${dd}`;
}

function fechaDesdeInput(texto) {
    const [a, m, d] = texto.split('-').map(Number);
    return new Date(a, m - 1, d);
}

function textoFecha(f) {
    return f.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
}

// Devuelve el inicio (incluido) y el fin (excluido) del periodo elegido.
// La semana va de lunes a domingo.
function rangoPeriodo(periodo, ancla) {
    const a = inicioDelDia(ancla);
    let inicio, fin;

    if (periodo === 'dia') {
        inicio = a;
        fin = new Date(a.getFullYear(), a.getMonth(), a.getDate() + 1);
    } else if (periodo === 'semana') {
        const dif = (a.getDay() + 6) % 7; // lunes = 0
        inicio = new Date(a.getFullYear(), a.getMonth(), a.getDate() - dif);
        fin = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 7);
    } else {
        inicio = new Date(a.getFullYear(), a.getMonth(), 1);
        fin = new Date(a.getFullYear(), a.getMonth() + 1, 1);
    }
    return { inicio, fin };
}

function periodoEsActual(inicio, fin) {
    const ahora = Date.now();
    return ahora >= inicio.getTime() && ahora < fin.getTime();
}

function describirRango(periodo, inicio, fin) {
    if (periodo === 'dia') {
        return periodoEsActual(inicio, fin) ? `Hoy, ${textoFecha(inicio)}` : textoFecha(inicio);
    }
    if (periodo === 'semana') {
        const ultimo = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate() - 1);
        const corto = { day: 'numeric', month: 'long' };
        return `Semana del ${inicio.toLocaleDateString('es-MX', corto)} al ${ultimo.toLocaleDateString('es-MX', corto)}`;
    }
    return inicio.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
}

// Frase para iniciar el resumen: "Hoy", "Esta semana", "Ese mes"...
function sujetoDelPeriodo(periodo, inicio, fin) {
    const actual = periodoEsActual(inicio, fin);
    if (periodo === 'dia') return actual ? 'Hoy' : `El ${textoFecha(inicio)}`;
    if (periodo === 'semana') return actual ? 'Esta semana' : 'En esa semana';
    return actual ? 'Este mes' : 'En ese mes';
}

// --- Utilidades de texto ---
function formatoPesos(n) {
    return Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function plural(n, singular, pluralTxt) {
    return n === 1 ? singular : pluralTxt;
}

function textoGramos(g) {
    if (g >= 1000) {
        const kilos = Math.floor(g / 1000);
        const resto = g % 1000;
        const base = `${kilos} ${plural(kilos, 'kilo', 'kilos')}`;
        return resto ? `${base} y ${resto} gramos` : base;
    }
    return `${g} gramos`;
}

function unirConY(lista) {
    if (lista.length <= 1) return lista.join('');
    return `${lista.slice(0, -1).join(', ')} y ${lista[lista.length - 1]}`;
}

// --- Consulta a la base de datos ---
async function pedidosEnRango(inicio, fin) {
    return db.pedidos
        .where('fecha')
        .between(inicio.toISOString(), fin.toISOString(), true, false)
        .sortBy('fecha');
}

// --- Dibujar una tabla ---
// numericas: posiciones de columnas que se alinean a la derecha
function dibujarTabla(contenedor, encabezados, filas, pie, numericas = []) {
    contenedor.innerHTML = '';
    const tabla = document.createElement('table');
    tabla.className = 'tabla-ventas';

    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');
    encabezados.forEach((texto, i) => {
        const th = document.createElement('th');
        th.textContent = texto;
        if (numericas.includes(i)) th.className = 'num';
        trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    tabla.appendChild(thead);

    const tbody = document.createElement('tbody');
    filas.forEach(fila => {
        const tr = document.createElement('tr');
        fila.forEach((celda, i) => {
            const td = document.createElement('td');
            const esObjeto = typeof celda === 'object' && celda !== null;
            td.textContent = esObjeto ? celda.texto : celda;
            if (esObjeto && celda.clase) td.classList.add(celda.clase);
            if (numericas.includes(i)) td.classList.add('num');
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    tabla.appendChild(tbody);

    if (pie) {
        const tfoot = document.createElement('tfoot');
        const trPie = document.createElement('tr');
        pie.forEach((texto, i) => {
            const td = document.createElement('td');
            td.textContent = texto;
            if (numericas.includes(i)) td.className = 'num';
            trPie.appendChild(td);
        });
        tfoot.appendChild(trPie);
        tabla.appendChild(tfoot);
    }

    contenedor.appendChild(tabla);
}

// --- Dibujar todo el registro de ventas ---
// --- Dibujar todo el registro de ventas (Dashboard Moderno) ---
// --- Dibujar todo el registro de ventas (Dashboard Moderno) ---
async function renderizarVentas() {
    const { inicio, fin } = rangoPeriodo(periodoVentas, fechaVentas);

    // Controles
    ventasFechaInput.value = fechaParaInput(fechaVentas);
    ventasRangoEl.textContent = describirRango(periodoVentas, inicio, fin);
    document.querySelectorAll('.periodo-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.periodo === periodoVentas);
    });

    // Datos
    const pedidos = await pedidosEnRango(inicio, fin);
    const ids = pedidos.map(p => p.id);
    const detalles = ids.length ? await db.detalle_pedido.where('pedido_id').anyOf(ids).toArray() : [];

    const detallesPorPedido = new Map();
    detalles.forEach(d => {
        if (!detallesPorPedido.has(d.pedido_id)) detallesPorPedido.set(d.pedido_id, []);
        detallesPorPedido.get(d.pedido_id).push(d);
    });

    const totalVentas = pedidos.reduce((suma, p) => suma + Number(p.total), 0);

    // Totales por producto
    const productos = new Map();
    detalles.forEach(d => {
        const info = productos.get(d.producto) || { cantidad: 0, total: 0, gramos: 0 };
        info.cantidad += d.cantidad;
        info.total += d.precio_unitario * d.cantidad;
        const m = /^(\d+)\s*g\b/.exec(d.notas || '');
        if (m) info.gramos += parseInt(m[1], 10) * d.cantidad;
        productos.set(d.producto, info);
    });

    // Producto Estrella (el que más piezas vendió)
    let productoEstrella = 'Ninguno';
    const masVendidos = [...productos.entries()]
        .filter(([, info]) => info.gramos === 0)
        .sort((a, b) => b[1].cantidad - a[1].cantidad);
    
    if (masVendidos.length > 0) {
        productoEstrella = `${masVendidos[0][0]} (${masVendidos[0][1].cantidad})`;
    }

    // --- 1. RENDERIZAR KPIs (Tarjetas de Impacto) ---
    ventasResumenEl.className = ''; 
    ventasResumenEl.innerHTML = `
        <div class="kpi-grid">
            <div class="kpi-card ingresos">
                <div class="kpi-title"> Ingresos Totales</div>
                <div class="kpi-value">${formatoPesos(totalVentas)}</div>
            </div>
            <div class="kpi-card pedidos">
                <div class="kpi-title"> Total Pedidos</div>
                <div class="kpi-value">${pedidos.length}</div>
            </div>
           
            <div class="kpi-card">
                <div class="kpi-title"> Más Vendido</div>
                <div class="kpi-value" style="font-size:1.2rem;">${productoEstrella}</div>
            </div>
        </div>
    `;

    // --- NUEVO: RECUADRO DE RESUMEN DE PRODUCTOS VENDIDOS ---
    const productosOrdenados = [...productos.entries()].sort((a, b) => b[1].total - a[1].total);
    
    if (productosOrdenados.length > 0) {
        let listaHTML = '';
        productosOrdenados.forEach(([nombre, info]) => {
            const cuantos = info.gramos > 0 
                ? `${textoGramos(info.gramos)}` // Muestra ej. "200 gramos"
                : `${info.cantidad}x`;          // Muestra ej. "5x"
            
            listaHTML += `
                <div class="producto-item-list">
                    <span class="prod-cant">${cuantos}</span>
                    <span class="prod-nombre">${nombre}</span>
                    <span class="prod-total">${formatoPesos(info.total)}</span>
                </div>
            `;
        });

        ventasResumenEl.innerHTML += `
            <div class="resumen-productos-card">
                <h4>Desglose de total de venta</h4>
                ${listaHTML}
            </div>
        `;
    }

    // --- Tablas y Detalles ---
    ventasDetalleEl.classList.toggle('hidden', pedidos.length === 0);

    if (pedidos.length > 0) {
        tablaProductosEl.innerHTML = ''; // Limpiamos la tabla vieja porque ya tenemos el nuevo recuadro

        // Tarjetas de Pedidos Individuales
        if (periodoVentas === 'dia') {
            tituloDetalleEl.textContent = 'Desglose de Pedidos';
            tablaDetalleEl.innerHTML = ''; 
            tablaDetalleEl.className = ''; 
            
            const grid = document.createElement('div');
            grid.className = 'pedidos-grid'; 

            pedidos.forEach(p => {
                const hora = new Date(p.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
                
                const itemsStr = (detallesPorPedido.get(p.id) || [])
                    .map(d => `<b>${d.cantidad}x</b> ${d.producto} <span style="color:#e65100; font-size:0.85rem;">${d.notas ? `(${d.notas})` : ''}</span>`)
                    .join('<br>');

                const badgeEstado = p.estado === 'pendiente' 
                    ? '<span class="badge badge-yellow">🕒 Por hacer</span>' 
                    : '<span class="badge badge-green">✅ Entregado</span>';
                    
                const badgeNube = p.sincronizado 
                    ? '<span class="badge badge-blue">☁️ En la nube</span>' 
                    : '<span class="badge badge-red">⚠️ Sin subir</span>';

                const cliHTML = p.nombre_cliente ? `<div class="pedido-nombre-cliente">👤 ${p.nombre_cliente}</div>` : '';

                grid.innerHTML += `
                    <div class="pedido-card">
                        <div class="pedido-head" style="border-bottom: 1px solid #eee; padding-bottom: 8px;">
                            <div>
                                <span class="pedido-num">#${p.id}</span>
                                ${cliHTML}
                            </div>
                            <span class="pedido-tiempo">${hora}</span>
                        </div>
                        <div class="detalle-pedido-items">${itemsStr}</div>
                        <div class="pedido-footer">
                            <div class="badge-group">
                                ${badgeEstado}
                                ${badgeNube}
                            </div>
                            <div class="pedido-total" style="font-size: 1.4rem; color: #2e7d32;">
                                ${formatoPesos(p.total)}
                            </div>
                        </div>
                    </div>
                `;
            });
            tablaDetalleEl.appendChild(grid);
        } else {
            // Vista Semanal / Mensual (Agrupado por día)
            tituloDetalleEl.textContent = 'Ventas día por día';
            tablaDetalleEl.className = 'tabla-wrap'; 

            const porDia = new Map();
            pedidos.forEach(p => {
                const dia = inicioDelDia(new Date(p.fecha));
                const clave = fechaParaInput(dia);
                const info = porDia.get(clave) || { fecha: dia, pedidos: 0, total: 0 };
                info.pedidos += 1;
                info.total += Number(p.total);
                porDia.set(clave, info);
            });

            const filasDias = [...porDia.values()]
                .sort((a, b) => a.fecha - b.fecha)
                .map(info => [textoFecha(info.fecha), String(info.pedidos), formatoPesos(info.total)]);
            
            dibujarTabla(
                tablaDetalleEl,
                ['Día', 'Pedidos', 'Total del día'],
                filasDias,
                ['TOTAL', String(pedidos.length), formatoPesos(totalVentas)],
                [1, 2]
            );
        }
    }

    // --- Estado de la subida a la nube ---
    const sinSubir = pedidos.filter(p => !p.sincronizado);
    const totalSinSubir = sinSubir.reduce((suma, p) => suma + Number(p.total), 0);
    const etiquetaPeriodo = periodoVentas === 'dia'
        ? (periodoEsActual(inicio, fin) ? 'de hoy' : 'de este día')
        : (periodoVentas === 'semana' ? 'de esta semana' : 'de este mes');

    if (pedidos.length === 0) {
        nubeEstadoEl.textContent = 'No hay ventas para subir en este periodo.';
    } else if (sinSubir.length === 0) {
        nubeEstadoEl.textContent = '✅ Todas las ventas de este periodo ya están guardadas en la nube.';
    } else {
        nubeEstadoEl.textContent = `☁️ Faltan por subir a la nube ${sinSubir.length} ${plural(sinSubir.length, 'pedido', 'pedidos')} (${formatoPesos(totalSinSubir)}).`;
    }

    btnSubirNube.disabled = sinSubir.length === 0;
    btnSubirNube.textContent = `☁️ Subir ventas ${etiquetaPeriodo}`;
}

// ==========================================
// 8. SINCRONIZACIÓN CON SUPABASE (POR PERIODO)
// ==========================================
const SUPABASE_URL = 'https://yepfezdzncnofalgkvet.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllcGZlemR6bmNub2ZhbGdrdmV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxNzUzMTAsImV4cCI6MjEwOTc1MTMxMH0.DxMx-NuB1CS6NGjhQvu4Q8CimCd4C3_v67zhbGDwXV0'; // <--- OJO AQUI
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Sube a Supabase la lista de pedidos que se le pase y los marca como subidos
async function subirPedidosANube(listaPedidos) {
    let subidos = 0;

    for (const pedido of listaPedidos) {
        const { data: pedidoNube, error: errPedido } = await supabaseClient
            .from('pedidos')
            .insert([{
                id_local: pedido.id,
                fecha: pedido.fecha,
                total: pedido.total,
                nombre_cliente: pedido.nombre_cliente || null // Se envía a Supabase
            }])
            .select()
            .single();

        if (errPedido) throw errPedido;

        const detallesLocales = await db.detalle_pedido.where('pedido_id').equals(pedido.id).toArray();
        const detallesNube = detallesLocales.map(d => ({
            pedido_id: pedidoNube.id,
            producto: d.producto,
            cantidad: d.cantidad,
            precio_unitario: d.precio_unitario,
            notas: d.notas
        }));

        const { error: errDetalle } = await supabaseClient
            .from('detalle_pedido')
            .insert(detallesNube);

        if (errDetalle) throw errDetalle;

        await db.pedidos.update(pedido.id, { sincronizado: 1 });
        subidos++;
    }

    return subidos;
}

// Botón "Subir ventas" de la pestaña Ventas: sube lo que falta del periodo que se está viendo
btnSubirNube.addEventListener('click', async () => {
    const { inicio, fin } = rangoPeriodo(periodoVentas, fechaVentas);
    const pedidos = await pedidosEnRango(inicio, fin);
    const faltantes = pedidos.filter(p => !p.sincronizado);

    if (faltantes.length === 0) {
        alert('Todo está al día. No hay ventas pendientes por subir en este periodo.');
        return;
    }

    btnSubirNube.disabled = true;
    btnSubirNube.textContent = '⏳ Subiendo...';

    try {
        const subidos = await subirPedidosANube(faltantes);
        alert(`✅ ¡Listo! Se subieron ${subidos} pedidos a la nube.`);
    } catch (error) {
        console.error('Error al sincronizar con Supabase:', error);
        alert('❌ Error de conexión. Verifica tu internet y tus llaves de Supabase.');
    } finally {
        renderizarVentas(); // Actualiza el estado y el texto del botón
    }
});

// ==========================================
// 9. REGISTRO DEL SERVICE WORKER (PWA)
// ==========================================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.error('Error al registrar SW', err));
}