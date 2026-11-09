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
const tabVender = document.getElementById('tab-vender');
const tabPendientes = document.getElementById('tab-pendientes');
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
    const verPendientes = vista === 'pendientes';
    viewVender.classList.toggle('hidden', verPendientes);
    viewPedidos.classList.toggle('hidden', !verPendientes);
    tabVender.classList.toggle('active', !verPendientes);
    tabPendientes.classList.toggle('active', verPendientes);

    if (verPendientes) renderizarPendientes();
}

tabVender.addEventListener('click', () => mostrarVista('vender'));
tabPendientes.addEventListener('click', () => mostrarVista('pendientes'));
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
// 7. SINCRONIZACIÓN CON SUPABASE
// ==========================================
const SUPABASE_URL = 'https://yepfezdzncnofalgkvet.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllcGZlemR6bmNub2ZhbGdrdmV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxNzUzMTAsImV4cCI6MjEwOTc1MTMxMH0.DxMx-NuB1CS6NGjhQvu4Q8CimCd4C3_v67zhbGDwXV0'; // <--- OJO AQUI
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.getElementById('btn-sync').addEventListener('click', async () => {
    const btnSync = document.getElementById('btn-sync');
    btnSync.disabled = true;
    btnSync.textContent = '⏳ Sincronizando...';

    try {
        const pendientes = await db.pedidos.where('sincronizado').equals(0).toArray();

        if (pendientes.length === 0) {
            alert('Todo está al día. No hay ventas pendientes por subir.');
            return;
        }

        let subidos = 0;

        for (const pedido of pendientes) {
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

        alert(`✅ ¡Listo! Se subieron ${subidos} pedidos a la nube.`);
    } catch (error) {
        console.error('Error al sincronizar con Supabase:', error);
        alert('❌ Error de conexión. Verifica tu internet y tus llaves de Supabase.');
    } finally {
        btnSync.disabled = false;
        btnSync.textContent = '🔄 Subir datos a la Nube';
    }
});

// ==========================================
// 8. REGISTRO DEL SERVICE WORKER (PWA)
// ==========================================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.error('Error al registrar SW', err));
}