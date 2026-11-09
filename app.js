// ==========================================
// 1. CONFIGURACIÓN DE LA BASE DE DATOS LOCAL (DEXIE)
// ==========================================
const db = new Dexie("POS_HamburguesasDB");

db.version(1).stores({
    pedidos: '++id, fecha, total, sincronizado',
    detalle_pedido: '++id, id_pedido, nombre_producto, precio, notas'
});

// ==========================================
// 2. VARIABLES Y ELEMENTOS DEL DOM
// ==========================================
let ticket = [];
let itemIndexEnEdicion = null;

const ticketList = document.getElementById('ticket-list');
const totalPriceEl = document.getElementById('total-price');
const modalNotas = document.getElementById('modal-notas');
const customNoteInput = document.getElementById('custom-note');
const modalProductName = document.getElementById('modal-product-name');

// ==========================================
// 3. LÓGICA DEL CARRITO (TICKET) Y MODALES
// ==========================================
document.querySelectorAll('.btn-product').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const target = e.currentTarget;
        const nombre = target.getAttribute('data-name');
        const precio = parseFloat(target.getAttribute('data-price'));

        ticket.push({
            nombre: nombre,
            precio: precio,
            notas: []
        });

        renderizarTicket();
    });
});

function renderizarTicket() {
    ticketList.innerHTML = '';
    let total = 0;

    if (ticket.length === 0) {
        ticketList.innerHTML = '<li class="empty-msg">Toca un producto para empezar</li>';
        totalPriceEl.innerText = '0.00';
        return;
    }

    ticket.forEach((item, index) => {
        total += item.precio;

        const li = document.createElement('li');
        li.className = 'ticket-item';
        li.onclick = () => abrirModal(index); 

        let notasHtml = '';
        if (item.notas.length > 0) {
            notasHtml = `<div class="ticket-item-note">* ${item.notas.join(', ')}</div>`;
        }

        li.innerHTML = `
            <div class="ticket-item-header">
                <span>${item.nombre}</span>
                <span>$${item.precio.toFixed(2)}</span>
            </div>
            ${notasHtml}
        `;
        ticketList.appendChild(li);
    });

    totalPriceEl.innerText = total.toFixed(2);
}

function abrirModal(index) {
    itemIndexEnEdicion = index;
    const item = ticket[index];
    
    modalProductName.innerText = `Modificando: ${item.nombre}`;
    customNoteInput.value = ''; 
    
    document.querySelectorAll('.btn-note').forEach(btn => {
        btn.classList.remove('active');
        if(item.notas.includes(btn.innerText)) {
            btn.classList.add('active');
        }
    });

    modalNotas.classList.remove('hidden');
}

document.querySelectorAll('.btn-note').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.target.classList.toggle('active');
    });
});

document.getElementById('btn-save-note').addEventListener('click', () => {
    if (itemIndexEnEdicion !== null) {
        let notasSeleccionadas = [];
        
        document.querySelectorAll('.btn-note.active').forEach(btn => {
            notasSeleccionadas.push(btn.innerText);
        });

        if (customNoteInput.value.trim() !== '') {
            notasSeleccionadas.push(customNoteInput.value.trim());
        }

        ticket[itemIndexEnEdicion].notas = notasSeleccionadas;
        renderizarTicket();
    }
    modalNotas.classList.add('hidden');
});

document.getElementById('btn-delete-item').addEventListener('click', () => {
    if (itemIndexEnEdicion !== null) {
        ticket.splice(itemIndexEnEdicion, 1);
        renderizarTicket();
    }
    modalNotas.classList.add('hidden');
});

// ==========================================
// 4. COBRAR Y GUARDAR LOCALMENTE (INDEXEDDB)
// ==========================================
document.getElementById('btn-cobrar').addEventListener('click', async () => {
    if (ticket.length === 0) {
        alert("El ticket está vacío. Agrega productos primero.");
        return;
    }

    const totalOrden = ticket.reduce((sum, item) => sum + item.precio, 0);
    const fechaActual = new Date().toISOString();

    try {
        await db.transaction('rw', db.pedidos, db.detalle_pedido, async () => {
            const idPedido = await db.pedidos.add({
                fecha: fechaActual,
                total: totalOrden,
                sincronizado: 0
            });

            const detalles = ticket.map(item => ({
                id_pedido: idPedido,
                nombre_producto: item.nombre,
                precio: item.precio,
                notas: item.notas.join(' | ')
            }));

            await db.detalle_pedido.bulkAdd(detalles);
        });

        alert("¡Pedido cobrado y guardado localmente!");
        ticket = []; 
        renderizarTicket();

    } catch (error) {
        console.error("Error al guardar el pedido:", error);
        alert("Hubo un error al guardar. Intenta de nuevo.");
    }
});

// ==========================================
// 5. SINCRONIZACIÓN CON SUPABASE (NUBE)
// ==========================================
// REEMPLAZA ESTOS DOS VALORES CON LOS DE TU PROYECTO EN SUPABASE:
const SUPABASE_URL = 'https://yepfezdzncnofalgkvet.supabase.co/rest/v1/';
const SUPABASE_KEY = 'Contraseña12.';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.getElementById('btn-sync').addEventListener('click', async () => {
    const btnSync = document.getElementById('btn-sync');
    btnSync.disabled = true;
    btnSync.innerText = '⏳ Sincronizando...';

    try {
        const pedidosPendientes = await db.pedidos.where('sincronizado').equals(0).toArray();
        
        if (pedidosPendientes.length === 0) {
            alert("Todo está al día. No hay pedidos nuevos por subir.");
            return;
        }

        let sincronizadosCount = 0;

        for (let pedido of pedidosPendientes) {
            const detallesLocales = await db.detalle_pedido.where('id_pedido').equals(pedido.id).toArray();

            const { data: pedidoNube, error: errPedido } = await supabaseClient
                .from('pedidos')
                .insert([{
                    id_local: pedido.id,
                    fecha: pedido.fecha,
                    total: pedido.total
                }])
                .select()
                .single();

            if (errPedido) throw errPedido;

            const detallesParaNube = detallesLocales.map(d => ({
                id_pedido: pedidoNube.id,
                nombre_producto: d.nombre_producto,
                precio: d.precio,
                notas: d.notas
            }));

            const { error: errDetalles } = await supabaseClient
                .from('detalle_pedido')
                .insert(detallesParaNube);

            if (errDetalles) throw errDetalles;

            await db.pedidos.update(pedido.id, { sincronizado: 1 });
            sincronizadosCount++;
        }

        alert(`¡Listo! Se subieron ${sincronizadosCount} pedidos a la nube.`);

    } catch (error) {
        console.error("Error al sincronizar con Supabase:", error);
        alert("Error de conexión. Verifica tu internet y tus llaves de Supabase.");
    } finally {
        btnSync.disabled = false;
        btnSync.innerText = '🔄 Sincronizar a la Nube';
    }
});

// ==========================================
// 6. REGISTRO DEL SERVICE WORKER (PWA)
// ==========================================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('Service Worker registrado', reg))
        .catch(err => console.warn('Error al registrar Service Worker', err));
}