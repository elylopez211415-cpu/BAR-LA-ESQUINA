/* ==========================================================
   Bar La Esquina - app.js
   ========================================================== */

/* REGISTRO DE IA
   Completá acá el registro del uso de IA (herramienta, fecha, prompt, qué se usó).
   Todo el código de abajo va después de este comentario.
*/

"use strict";

/* ----------------------------------------------------------
   1. DATOS
   ---------------------------------------------------------- */
const CLAVE_STORAGE = "bar-datos";

// { id, nombre, categoria, precio, disponible }
const productos = [];

// { id, numero, capacidad, estado }  estado: "libre" | "ocupada"
const mesas = [];

// { id, mesaId, items, estado, apertura, cierre, total, formaPago }
// items: [{ productoId, nombre, precio, cantidad }]
// estado: "abierto" | "cerrado"
const pedidos = [];

/* ----------------------------------------------------------
   2. DATOS DE EJEMPLO
   ---------------------------------------------------------- */
const PRODUCTOS_EJEMPLO = [
  { nombre: "Cerveza artesanal", categoria: "Bebidas", precio: 3500, disponible: true },
  { nombre: "Gaseosa", categoria: "Bebidas", precio: 2200, disponible: true },
  { nombre: "Hamburguesa completa", categoria: "Comidas", precio: 8500, disponible: true },
  { nombre: "Papas fritas", categoria: "Comidas", precio: 4800, disponible: true },
  { nombre: "Flan con dulce de leche", categoria: "Postres", precio: 3900, disponible: true }
];

function crearMesasIniciales() {
  mesas.length = 0;
  for (let i = 1; i <= 8; i++) {
    mesas.push({
      id: i,
      numero: i,
      capacidad: i <= 4 ? 2 : 4,
      estado: "libre"
    });
  }
}

// Agrega los productos de ejemplo que todavía no estén en la carta
function agregarProductosEjemplo() {
  PRODUCTOS_EJEMPLO.forEach((ejemplo) => {
    const yaEsta = productos.some(
      (p) => p.nombre.localeCompare(ejemplo.nombre, "es", { sensitivity: "base" }) === 0
    );
    if (!yaEsta) {
      productos.push({ id: siguienteId(productos), ...ejemplo });
    }
  });
}

function crearDatosIniciales() {
  crearMesasIniciales();
  productos.length = 0;
  agregarProductosEjemplo();
  pedidos.length = 0;
}

/* ----------------------------------------------------------
   3. GUARDAR Y CARGAR (localStorage)
   ---------------------------------------------------------- */
function guardarDatos() {
  try {
    localStorage.setItem(
      CLAVE_STORAGE,
      JSON.stringify({ productos, mesas, pedidos })
    );
    return true;
  } catch (error) {
    console.error("No se pudieron guardar los datos:", error);
    return false;
  }
}

// Devuelve true si había datos guardados y válidos, false si no.
function cargarDatos() {
  try {
    const texto = localStorage.getItem(CLAVE_STORAGE);
    if (!texto) return false;

    const datos = JSON.parse(texto);
    if (!Array.isArray(datos.productos) ||
        !Array.isArray(datos.mesas) ||
        !Array.isArray(datos.pedidos)) {
      return false;
    }

    // Si lo guardado está dañado o es de una versión vieja, se ignora
    if (validarDatos(datos) !== "") return false;

    productos.splice(0, productos.length, ...datos.productos);
    mesas.splice(0, mesas.length, ...datos.mesas);
    pedidos.splice(0, pedidos.length, ...datos.pedidos);

    // Sin mesas no se puede usar el Salón: se vuelven a crear
    if (mesas.length === 0) crearMesasIniciales();
    return true;
  } catch (error) {
    console.error("No se pudieron cargar los datos:", error);
    return false;
  }
}

/* ----------------------------------------------------------
   4. MENÚ: UNA SECCIÓN VISIBLE A LA VEZ
   ---------------------------------------------------------- */
const SECCIONES = ["salon", "carta", "caja"];

function mostrarSeccion(id) {
  if (!SECCIONES.includes(id)) id = "salon";
  if (id === "caja") renderCaja(); // por si cambió el día con la página abierta

  SECCIONES.forEach((seccionId) => {
    const seccion = document.getElementById(seccionId);
    const enlace = document.getElementById("nav-" + seccionId);
    const activa = seccionId === id;

    seccion.classList.toggle("visible", activa);
    seccion.hidden = !activa;
    enlace.classList.toggle("activo", activa);

    if (activa) {
      enlace.setAttribute("aria-current", "page");
    } else {
      enlace.removeAttribute("aria-current");
    }
  });
}

function iniciarMenu() {
  // El hash (#salon, #carta, #caja) manda; así funcionan también
  // los botones atrás/adelante del navegador.
  window.addEventListener("hashchange", () => {
    mostrarSeccion(location.hash.slice(1));
    // Cada sección se muestra desde arriba (sin saltos raros del navegador)
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  mostrarSeccion(location.hash.slice(1));
}

/* ----------------------------------------------------------
   5. CARTA: ALTA, EDICIÓN, BAJA Y LISTADO DE PRODUCTOS
   ---------------------------------------------------------- */
const formatoPesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

const CATEGORIAS_BASE = ["Bebidas", "Comidas", "Postres", "Otros"];

// null = se está creando un producto; un id = se está editando ese producto
let productoEditandoId = null;

function siguienteId(lista) {
  return lista.reduce((maximo, item) => Math.max(maximo, item.id), 0) + 1;
}

// Categorías base + cualquier otra que ya exista en los productos
function obtenerCategorias() {
  const extras = productos
    .map((p) => p.categoria)
    .filter((c) => !CATEGORIAS_BASE.includes(c));
  const unicas = [...new Set(extras)].sort((a, b) => a.localeCompare(b, "es"));
  return [...CATEGORIAS_BASE, ...unicas];
}

function llenarCategorias(seleccionada = "") {
  const select = document.getElementById("producto-categoria");
  select.replaceChildren(new Option("Elegí una categoría", ""));
  obtenerCategorias().forEach((categoria) => {
    select.appendChild(new Option(categoria, categoria));
  });
  select.value = seleccionada;
}

/* ---------- Validación y mensajes ---------- */
function validarProducto(nombre, categoria, precio) {
  if (nombre === "") {
    return "El nombre no puede estar vacío.";
  }

  const repetido = productos.some(
    (p) =>
      p.id !== productoEditandoId &&
      p.nombre.localeCompare(nombre, "es", { sensitivity: "base" }) === 0
  );
  if (repetido) {
    return "Ya existe un producto con ese nombre.";
  }

  if (categoria === "") {
    return "Elegí una categoría.";
  }

  if (!Number.isFinite(precio) || precio <= 0) {
    return "El precio tiene que ser mayor que cero.";
  }

  return "";
}

function mostrarErrorProducto(texto) {
  const aviso = document.getElementById("error-producto");
  aviso.textContent = texto;
  aviso.hidden = texto === "";
}

/* ---------- Formulario ---------- */
function manejarEnvioProducto(evento) {
  evento.preventDefault();

  const nombre = document
    .getElementById("producto-nombre")
    .value.trim()
    .replace(/\s+/g, " ");
  const categoria = document.getElementById("producto-categoria").value;
  const precio = Number(document.getElementById("producto-precio").value);
  const disponible = document.getElementById("producto-disponible").checked;

  const error = validarProducto(nombre, categoria, precio);
  if (error) {
    mostrarErrorProducto(error);
    return;
  }

  if (productoEditandoId === null) {
    productos.push({
      id: siguienteId(productos),
      nombre,
      categoria,
      precio,
      disponible
    });
  } else {
    const producto = productos.find((p) => p.id === productoEditandoId);
    Object.assign(producto, { nombre, categoria, precio, disponible });
  }

  guardarDatos();
  salirDeEdicion();
  renderProductos();
}

function salirDeEdicion() {
  productoEditandoId = null;
  document.getElementById("form-producto").reset();
  llenarCategorias("");
  mostrarErrorProducto("");
  document.getElementById("btn-guardar-producto").textContent = "💾 Guardar producto";
  document.getElementById("btn-cancelar-edicion").hidden = true;
}

function editarProducto(id) {
  const producto = productos.find((p) => p.id === id);
  if (!producto) return;

  productoEditandoId = id;
  llenarCategorias(producto.categoria);
  document.getElementById("producto-nombre").value = producto.nombre;
  document.getElementById("producto-precio").value = producto.precio;
  document.getElementById("producto-disponible").checked = producto.disponible;
  mostrarErrorProducto("");
  document.getElementById("btn-guardar-producto").textContent = "💾 Guardar cambios";
  document.getElementById("btn-cancelar-edicion").hidden = false;

  document.getElementById("form-producto").scrollIntoView({ behavior: "smooth", block: "start" });
  document.getElementById("producto-nombre").focus({ preventScroll: true });
}

function borrarProducto(id) {
  const producto = productos.find((p) => p.id === id);
  if (!producto) return;

  if (!confirm(`¿Borrar "${producto.nombre}" de la carta?`)) return;

  productos.splice(productos.indexOf(producto), 1);
  if (productoEditandoId === id) salirDeEdicion();
  guardarDatos();
  renderProductos();
}

function cambiarDisponible(id, disponible) {
  const producto = productos.find((p) => p.id === id);
  if (!producto) return;

  producto.disponible = disponible;
  guardarDatos();
  renderProductos();
}

/* ---------- Listado agrupado por categoría ---------- */
function crearElemento(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

function crearBoton(clase, accion, texto) {
  const boton = crearElemento("button", clase, texto);
  boton.type = "button";
  boton.dataset.accion = accion;
  return boton;
}

function crearTarjetaProducto(producto) {
  const item = crearElemento("li", "producto");
  item.dataset.id = producto.id;
  item.classList.toggle("no-disponible", !producto.disponible);

  const info = crearElemento("div", "producto-info");
  info.append(
    crearElemento("strong", "producto-nombre", producto.nombre),
    crearElemento("span", "producto-precio", formatoPesos.format(producto.precio))
  );

  const acciones = crearElemento("div", "producto-acciones");

  // Interruptor de disponible
  const interruptor = crearElemento("label", "interruptor");
  const casilla = document.createElement("input");
  casilla.type = "checkbox";
  casilla.dataset.accion = "disponible";
  casilla.checked = producto.disponible;
  casilla.setAttribute("aria-label", `Disponible: ${producto.nombre}`);
  interruptor.append(
    casilla,
    crearElemento("span", "interruptor-pista"),
    crearElemento("span", "interruptor-texto", producto.disponible ? "Disponible" : "Agotado")
  );

  acciones.append(
    interruptor,
    crearBoton("btn-secundario", "editar", "✏️ Editar"),
    crearBoton("btn-peligro", "borrar", "🗑️ Borrar")
  );

  item.append(info, acciones);
  return item;
}

function renderProductos() {
  // Si cambia la carta, el select del pedido se actualiza también
  renderPanelPedido();

  const contenedor = document.getElementById("lista-productos");
  contenedor.replaceChildren();

  if (productos.length === 0) {
    contenedor.append(
      crearElemento("p", "vacio", "Todavía no hay productos en la carta."),
      crearBoton("", "cargar-ejemplos", "🍺 Cargar productos de ejemplo")
    );
    return;
  }

  obtenerCategorias().forEach((categoria) => {
    const delaCategoria = productos
      .filter((p) => p.categoria === categoria)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    if (delaCategoria.length === 0) return;

    const grupo = crearElemento("section", "categoria");
    grupo.appendChild(crearElemento("h4", "categoria-titulo", categoria));

    const lista = crearElemento("ul", "productos-categoria");
    delaCategoria.forEach((producto) => lista.appendChild(crearTarjetaProducto(producto)));

    grupo.appendChild(lista);
    contenedor.appendChild(grupo);
  });
}

function iniciarCarta() {
  const formulario = document.getElementById("form-producto");
  formulario.noValidate = true; // los mensajes los damos nosotros

  // Mensaje de error del formulario
  const aviso = crearElemento("p", "error-formulario");
  aviso.id = "error-producto";
  aviso.setAttribute("role", "alert");
  aviso.hidden = true;

  // Botón para cancelar una edición
  const cancelar = crearBoton("btn-secundario", "cancelar", "Cancelar");
  cancelar.id = "btn-cancelar-edicion";
  cancelar.hidden = true;

  const guardar = document.getElementById("btn-guardar-producto");
  guardar.before(aviso);
  guardar.after(cancelar);

  llenarCategorias("");

  formulario.addEventListener("submit", manejarEnvioProducto);
  cancelar.addEventListener("click", salirDeEdicion);

  // Un solo escuchador para todos los botones de la lista
  const lista = document.getElementById("lista-productos");

  lista.addEventListener("click", (evento) => {
    const boton = evento.target.closest("button[data-accion]");
    if (!boton) return;

    if (boton.dataset.accion === "cargar-ejemplos") {
      agregarProductosEjemplo();
      guardarDatos();
      llenarCategorias("");
      renderProductos();
      return;
    }

    const id = Number(boton.closest("li").dataset.id);

    if (boton.dataset.accion === "editar") editarProducto(id);
    if (boton.dataset.accion === "borrar") borrarProducto(id);
  });

  lista.addEventListener("change", (evento) => {
    if (evento.target.dataset.accion !== "disponible") return;
    const id = Number(evento.target.closest("li").dataset.id);
    cambiarDisponible(id, evento.target.checked);
  });

  renderProductos();
}

/* ----------------------------------------------------------
   6. SALÓN: MESAS Y PEDIDO DE LA MESA ELEGIDA
   ---------------------------------------------------------- */
let mesaSeleccionadaId = null;

function formatearHora(fechaISO) {
  return new Date(fechaISO).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function buscarPedidoAbierto(mesaId) {
  return pedidos.find((p) => p.mesaId === mesaId && p.estado === "abierto");
}

function calcularTotal(pedido) {
  return pedido.items.reduce((suma, item) => suma + item.precio * item.cantidad, 0);
}

function abrirPedido(mesa) {
  const pedido = {
    id: siguienteId(pedidos),
    mesaId: mesa.id,
    items: [],
    estado: "abierto",
    apertura: new Date().toISOString(),
    cierre: null,
    total: 0,
    formaPago: null
  };
  pedidos.push(pedido);
  mesa.estado = "ocupada";
  return pedido;
}

/* ---------- Mesas ---------- */
function crearTarjetaMesa(mesa) {
  const boton = crearElemento("button", "mesa " + mesa.estado);
  boton.type = "button";
  boton.dataset.id = mesa.id;
  boton.classList.toggle("seleccionada", mesa.id === mesaSeleccionadaId);
  boton.setAttribute("aria-pressed", String(mesa.id === mesaSeleccionadaId));

  boton.appendChild(crearElemento("span", "mesa-numero", "Mesa " + mesa.numero));
  boton.appendChild(
    crearElemento("span", "mesa-estado", mesa.estado === "libre" ? "Libre" : "Ocupada")
  );

  if (mesa.estado === "ocupada") {
    const pedido = buscarPedidoAbierto(mesa.id);
    const total = pedido ? calcularTotal(pedido) : 0;
    boton.appendChild(crearElemento("span", "mesa-total", formatoPesos.format(total)));
  }

  return boton;
}

function renderMesas() {
  const grilla = document.getElementById("grilla-mesas");
  grilla.replaceChildren(...mesas.map(crearTarjetaMesa));
}

/* ---------- Panel lateral del pedido ---------- */
function renderPanelPedido() {
  const titulo = document.getElementById("mesa-seleccionada");
  const lista = document.getElementById("lista-pedido");
  const total = document.getElementById("total-pedido-valor");
  lista.replaceChildren();

  const formulario = document.getElementById("form-item-pedido");
  const botonCerrar = document.getElementById("btn-cerrar-cuenta");
  botonCerrar.disabled = true;
  const mesa = mesas.find((m) => m.id === mesaSeleccionadaId);
  if (!mesa) {
    titulo.textContent = "Tocá una mesa para ver o abrir su pedido";
    total.textContent = formatoPesos.format(0);
    formulario.hidden = true;
    return;
  }

  const pedido = buscarPedidoAbierto(mesa.id);
  if (!pedido) {
    titulo.textContent = `Mesa ${mesa.numero} · libre`;
    total.textContent = formatoPesos.format(0);
    formulario.hidden = true;
    return;
  }

  formulario.hidden = false;
  botonCerrar.disabled = false;
  llenarProductosPedido();

  titulo.textContent =
    `Mesa ${mesa.numero} · ${mesa.capacidad} lugares · abierta a las ${formatearHora(pedido.apertura)}`;

  if (pedido.items.length === 0) {
    lista.appendChild(crearElemento("li", "vacio", "El pedido todavía no tiene productos."));
  } else {
    pedido.items.forEach((item) => lista.appendChild(crearFilaItem(item)));
  }

  total.textContent = formatoPesos.format(calcularTotal(pedido));
}

function renderSalon() {
  renderMesas();
  renderPanelPedido();
}

/* ---------- Armado del pedido ---------- */
function mostrarErrorItem(texto) {
  const aviso = document.getElementById("error-item");
  aviso.textContent = texto;
  aviso.hidden = texto === "";
}

// Solo productos disponibles, agrupados por categoría
function llenarProductosPedido() {
  const select = document.getElementById("item-producto");
  const boton = document.getElementById("btn-agregar-item");
  const anterior = select.value;
  select.replaceChildren();

  const disponibles = productos.filter((p) => p.disponible);
  select.disabled = disponibles.length === 0;
  boton.disabled = disponibles.length === 0;

  if (disponibles.length === 0) {
    select.appendChild(new Option("No hay productos disponibles", ""));
    return;
  }

  obtenerCategorias().forEach((categoria) => {
    const delaCategoria = disponibles
      .filter((p) => p.categoria === categoria)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    if (delaCategoria.length === 0) return;

    const grupo = document.createElement("optgroup");
    grupo.label = categoria;
    delaCategoria.forEach((p) => {
      grupo.appendChild(new Option(`${p.nombre} — ${formatoPesos.format(p.precio)}`, p.id));
    });
    select.appendChild(grupo);
  });

  // Se conserva el producto que estaba elegido, si sigue disponible
  if ([...select.options].some((o) => o.value === anterior)) {
    select.value = anterior;
  }
}

function crearFilaItem(item) {
  const fila = crearElemento("li", "item-pedido");
  fila.dataset.productoId = item.productoId;

  const info = crearElemento("div", "item-info");
  info.append(
    crearElemento("strong", "item-nombre", item.nombre),
    crearElemento("small", "item-unitario", formatoPesos.format(item.precio) + " c/u")
  );

  const controles = crearElemento("div", "item-controles");
  const menos = crearBoton("btn-cantidad", "restar", "−");
  menos.setAttribute("aria-label", `Quitar una unidad de ${item.nombre}`);
  const mas = crearBoton("btn-cantidad", "sumar", "+");
  mas.setAttribute("aria-label", `Sumar una unidad de ${item.nombre}`);
  controles.append(menos, crearElemento("span", "item-cantidad", String(item.cantidad)), mas);

  const subtotal = crearElemento("strong", "item-subtotal", formatoPesos.format(item.precio * item.cantidad));

  fila.append(info, controles, subtotal);
  return fila;
}

function guardarCambiosPedido(pedido) {
  pedido.total = calcularTotal(pedido);
  guardarDatos();
  renderSalon();
}

function agregarItem(evento) {
  evento.preventDefault();

  const pedido = buscarPedidoAbierto(mesaSeleccionadaId);
  if (!pedido) return;

  const producto = productos.find(
    (p) => p.id === Number(document.getElementById("item-producto").value) && p.disponible
  );
  const campoCantidad = document.getElementById("item-cantidad");
  const cantidad = Number(campoCantidad.value);

  if (!producto) {
    mostrarErrorItem("Elegí un producto disponible.");
    return;
  }
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    mostrarErrorItem("La cantidad tiene que ser un número entero mayor que cero.");
    return;
  }

  const existente = pedido.items.find((i) => i.productoId === producto.id);
  if (existente) {
    // Se suma a la línea que ya está (conserva el precio con el que se cargó)
    existente.cantidad += cantidad;
  } else {
    // Se guarda el nombre y el precio de este momento
    pedido.items.push({
      productoId: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      cantidad
    });
  }

  campoCantidad.value = 1;
  mostrarErrorItem("");
  guardarCambiosPedido(pedido);
}

// delta: +1 o -1. Si la cantidad llega a cero, el ítem se quita.
function cambiarCantidad(productoId, delta) {
  const pedido = buscarPedidoAbierto(mesaSeleccionadaId);
  if (!pedido) return;

  const item = pedido.items.find((i) => i.productoId === productoId);
  if (!item) return;

  item.cantidad += delta;
  if (item.cantidad <= 0) {
    pedido.items.splice(pedido.items.indexOf(item), 1);
  }
  guardarCambiosPedido(pedido);
}

/* ---------- Toque en una mesa ---------- */
function tocarMesa(id) {
  const mesa = mesas.find((m) => m.id === id);
  if (!mesa) return;

  // Libre -> se abre un pedido y la mesa pasa a ocupada.
  // Ocupada -> se muestra su pedido abierto (si por algún motivo no
  // existiera, se crea para que la mesa nunca quede sin pedido).
  if (mesa.estado === "libre" || !buscarPedidoAbierto(mesa.id)) {
    abrirPedido(mesa);
    guardarDatos();
  }

  mesaSeleccionadaId = mesa.id;
  mostrarErrorItem("");
  renderSalon();

  // En pantallas angostas el pedido queda debajo de las mesas: se lo muestra
  if (window.matchMedia("(max-width: 767px)").matches) {
    document.getElementById("panel-pedido").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function iniciarSalon() {
  const grilla = document.getElementById("grilla-mesas");
  grilla.setAttribute("role", "group");
  grilla.setAttribute("aria-label", "Mesas del salón");

  grilla.addEventListener("click", (evento) => {
    const boton = evento.target.closest(".mesa");
    if (boton) tocarMesa(Number(boton.dataset.id));
  });

  document.getElementById("form-item-pedido").noValidate = true;
  document.getElementById("form-item-pedido").addEventListener("submit", agregarItem);

  // Un solo escuchador para los botones + y − de todos los ítems
  document.getElementById("lista-pedido").addEventListener("click", (evento) => {
    const boton = evento.target.closest("button[data-accion]");
    if (!boton) return;
    const productoId = Number(boton.closest("li").dataset.productoId);

    if (boton.dataset.accion === "sumar") cambiarCantidad(productoId, 1);
    if (boton.dataset.accion === "restar") cambiarCantidad(productoId, -1);
  });

  renderSalon();
}

/* ----------------------------------------------------------
   7. CIERRE DE CUENTA Y TICKET
   ---------------------------------------------------------- */
const FORMAS_PAGO = {
  efectivo: "💵 Efectivo",
  debito: "💳 Débito",
  transferencia: "🏦 Transferencia"
};

function numeroDeMesa(mesaId) {
  const mesa = mesas.find((m) => m.id === mesaId);
  return mesa ? mesa.numero : mesaId;
}

function mostrarErrorCierre(texto) {
  const aviso = document.getElementById("error-cierre");
  aviso.textContent = texto;
  aviso.hidden = texto === "";
}

// Paso 1: validar que el pedido no esté vacío y pedir la forma de pago
function pedirCierre() {
  const pedido = buscarPedidoAbierto(mesaSeleccionadaId);
  if (!pedido) return;

  if (pedido.items.length === 0) {
    mostrarErrorItem("No se puede cerrar un pedido vacío.");
    return;
  }
  mostrarErrorItem("");

  document.getElementById("resumen-cierre").textContent =
    `Mesa ${numeroDeMesa(pedido.mesaId)} · Total ${formatoPesos.format(calcularTotal(pedido))}`;
  document.getElementById("form-cierre").reset();
  mostrarErrorCierre("");
  document.getElementById("dialogo-cierre").showModal();
}

// Paso 2: cerrar el pedido, liberar la mesa y mostrar el ticket
function confirmarCierre(evento) {
  evento.preventDefault();

  const elegida = document.querySelector('input[name="formaPago"]:checked');
  if (!elegida) {
    mostrarErrorCierre("Elegí una forma de pago.");
    return;
  }

  const pedido = buscarPedidoAbierto(mesaSeleccionadaId);
  if (!pedido) return;
  if (pedido.items.length === 0) {
    mostrarErrorCierre("No se puede cerrar un pedido vacío.");
    return;
  }

  const mesa = mesas.find((m) => m.id === pedido.mesaId);

  pedido.estado = "cerrado";
  pedido.cierre = new Date().toISOString();
  pedido.total = calcularTotal(pedido);
  pedido.formaPago = elegida.value;
  if (mesa) mesa.estado = "libre";

  guardarDatos();
  document.getElementById("dialogo-cierre").close();

  mesaSeleccionadaId = null;
  renderSalon();
  renderCaja();
  mostrarTicket(pedido);
}

function mostrarTicket(pedido) {
  const ticket = document.getElementById("ticket");
  ticket.replaceChildren();

  const encabezado = crearElemento("header", "ticket-encabezado");
  encabezado.append(
    crearElemento("h3", "", "Bar La Esquina"),
    crearElemento("p", "", `Mesa ${numeroDeMesa(pedido.mesaId)} · Pedido Nº ${pedido.id}`),
    crearElemento("p", "", `Apertura: ${formatearHora(pedido.apertura)} · Cierre: ${formatearHora(pedido.cierre)}`),
    crearElemento("p", "", new Date(pedido.cierre).toLocaleDateString("es-AR", { dateStyle: "long" }))
  );

  const detalle = crearElemento("ul", "ticket-items");
  pedido.items.forEach((item) => {
    const fila = crearElemento("li");
    const descripcion = crearElemento("span", "", `${item.cantidad} × ${item.nombre}`);
    descripcion.appendChild(crearElemento("small", "", ` (${formatoPesos.format(item.precio)} c/u)`));
    fila.append(descripcion, crearElemento("span", "", formatoPesos.format(item.precio * item.cantidad)));
    detalle.appendChild(fila);
  });

  const pie = crearElemento("footer", "ticket-pie");
  const total = crearElemento("p", "ticket-total");
  total.append("TOTAL ", crearElemento("strong", "", formatoPesos.format(pedido.total)));
  pie.append(
    total,
    crearElemento("p", "", `Forma de pago: ${FORMAS_PAGO[pedido.formaPago] || pedido.formaPago}`),
    crearElemento("p", "ticket-gracias", "¡Gracias por su visita!")
  );

  ticket.append(encabezado, detalle, pie);
  document.getElementById("dialogo-ticket").showModal();
}

function iniciarCierre() {
  document.getElementById("btn-cerrar-cuenta").addEventListener("click", pedirCierre);
  document.getElementById("form-cierre").addEventListener("submit", confirmarCierre);

  document.getElementById("btn-cancelar-cierre").addEventListener("click", () => {
    document.getElementById("dialogo-cierre").close();
  });
  document.getElementById("btn-cerrar-ticket").addEventListener("click", () => {
    document.getElementById("dialogo-ticket").close();
  });
}

/* ----------------------------------------------------------
   8. CAJA DEL DÍA
   ---------------------------------------------------------- */
function esDeHoy(fechaISO) {
  return new Date(fechaISO).toDateString() === new Date().toDateString();
}

function renderCaja() {
  const cuerpo = document.getElementById("tbody-caja");
  cuerpo.replaceChildren();

  const cerradosHoy = pedidos
    .filter((p) => p.estado === "cerrado" && p.cierre && esDeHoy(p.cierre))
    .sort((a, b) => a.cierre.localeCompare(b.cierre));

  if (cerradosHoy.length === 0) {
    const fila = crearElemento("tr");
    const celda = crearElemento("td", "vacio", "Todavía no hay cuentas cerradas hoy.");
    celda.colSpan = 4;
    fila.appendChild(celda);
    cuerpo.appendChild(fila);
  }

  const subtotales = {};
  Object.keys(FORMAS_PAGO).forEach((forma) => (subtotales[forma] = 0));
  let totalRecaudado = 0;

  cerradosHoy.forEach((pedido) => {
    const fila = crearElemento("tr");
    fila.append(
      crearElemento("td", "", formatearHora(pedido.cierre)),
      crearElemento("td", "", "Mesa " + numeroDeMesa(pedido.mesaId)),
      crearElemento("td", "", FORMAS_PAGO[pedido.formaPago] || pedido.formaPago),
      crearElemento("td", "", formatoPesos.format(pedido.total))
    );
    cuerpo.appendChild(fila);

    totalRecaudado += pedido.total;
    subtotales[pedido.formaPago] = (subtotales[pedido.formaPago] || 0) + pedido.total;
  });

  document.getElementById("total-caja").textContent = formatoPesos.format(totalRecaudado);

  const lista = document.getElementById("subtotales-pago");
  lista.replaceChildren();
  Object.entries(subtotales).forEach(([forma, monto]) => {
    const item = crearElemento("li");
    item.append(
      crearElemento("span", "", FORMAS_PAGO[forma] || forma),
      crearElemento("strong", "", formatoPesos.format(monto))
    );
    lista.appendChild(item);
  });
}

/* ----------------------------------------------------------
   9. EXPORTAR E IMPORTAR
   ---------------------------------------------------------- */
let temporizadorMensaje = null;

// tipo: "ok" o "error"
function mostrarMensajeDatos(texto, tipo) {
  const mensaje = document.getElementById("mensaje-datos");
  clearTimeout(temporizadorMensaje);

  mensaje.textContent = (tipo === "error" ? "⚠️ " : "✅ ") + texto;
  mensaje.className = "mensaje-" + tipo;
  mensaje.setAttribute("role", tipo === "error" ? "alert" : "status");
  mensaje.hidden = false;

  if (tipo === "ok") {
    temporizadorMensaje = setTimeout(() => (mensaje.hidden = true), 6000);
  }
}

/* ---------- Exportar ---------- */
function exportarDatos() {
  const datos = { productos, mesas, pedidos };
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = "bar.json";
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  mostrarMensajeDatos("Se descargó bar.json con todos los datos.", "ok");
}

/* ---------- Importar ---------- */
const esNumero = (valor) => typeof valor === "number" && Number.isFinite(valor);
const esTexto = (valor) => typeof valor === "string" && valor.trim() !== "";

// Devuelve "" si el contenido es válido, o un texto explicando qué falla
function validarDatos(datos) {
  if (datos === null || typeof datos !== "object" || Array.isArray(datos)) {
    return "El archivo no tiene el formato esperado (se esperaba un objeto con listas).";
  }

  for (const lista of ["productos", "mesas", "pedidos"]) {
    if (!Array.isArray(datos[lista])) {
      return `Falta la lista "${lista}" o no es una lista.`;
    }
  }

  for (const p of datos.productos) {
    if (!p || !esNumero(p.id) || !esTexto(p.nombre) || !esTexto(p.categoria) ||
        !esNumero(p.precio) || p.precio < 0 || typeof p.disponible !== "boolean") {
      return "Hay un producto con datos incompletos o inválidos.";
    }
  }

  for (const m of datos.mesas) {
    if (!m || !esNumero(m.id) || !esNumero(m.numero) || !esNumero(m.capacidad) ||
        !["libre", "ocupada"].includes(m.estado)) {
      return "Hay una mesa con datos incompletos o inválidos.";
    }
  }

  for (const p of datos.pedidos) {
    const itemsValidos = p && Array.isArray(p.items) && p.items.every((i) =>
      i && esNumero(i.productoId) && esTexto(i.nombre) && esNumero(i.precio) &&
      Number.isInteger(i.cantidad) && i.cantidad > 0
    );
    if (!p || !esNumero(p.id) || !esNumero(p.mesaId) || !itemsValidos ||
        !["abierto", "cerrado"].includes(p.estado) || !esTexto(p.apertura) ||
        !esNumero(p.total)) {
      return "Hay un pedido con datos incompletos o inválidos.";
    }
    if (p.estado === "cerrado" && (!esTexto(p.cierre) || !Object.hasOwn(FORMAS_PAGO, p.formaPago))) {
      return "Hay un pedido cerrado sin hora de cierre o con forma de pago inválida.";
    }
  }

  return "";
}

function redibujarTodo() {
  mesaSeleccionadaId = null;
  mostrarErrorItem("");
  salirDeEdicion();   // limpia el formulario de la Carta y recarga sus categorías
  renderProductos();  // también actualiza el panel del pedido
  renderSalon();
  renderCaja();
}

async function importarArchivo(archivo) {
  let datos;
  try {
    datos = JSON.parse(await archivo.text());
  } catch (error) {
    mostrarMensajeDatos("El archivo no es un JSON válido. No se cambió nada.", "error");
    return;
  }

  const problema = validarDatos(datos);
  if (problema) {
    mostrarMensajeDatos(`${problema} No se cambió nada.`, "error");
    return;
  }

  const confirmado = confirm(
    `Se van a REEMPLAZAR los datos actuales por los de "${archivo.name}":\n\n` +
    `• ${datos.productos.length} productos\n` +
    `• ${datos.mesas.length} mesas\n` +
    `• ${datos.pedidos.length} pedidos\n\n` +
    "Esta acción no se puede deshacer. ¿Continuar?"
  );
  if (!confirmado) return;

  productos.splice(0, productos.length, ...datos.productos);
  mesas.splice(0, mesas.length, ...datos.mesas);
  pedidos.splice(0, pedidos.length, ...datos.pedidos);

  const guardado = guardarDatos();
  redibujarTodo();

  if (guardado) {
    mostrarMensajeDatos("Datos importados correctamente.", "ok");
  } else {
    mostrarMensajeDatos("Se importaron los datos, pero no se pudieron guardar en el navegador.", "error");
  }
}

function iniciarDatos() {
  const entrada = document.getElementById("input-importar");

  document.getElementById("btn-exportar").addEventListener("click", exportarDatos);
  document.getElementById("btn-importar").addEventListener("click", () => entrada.click());

  entrada.addEventListener("change", async () => {
    const archivo = entrada.files[0];
    if (archivo) await importarArchivo(archivo);
    entrada.value = ""; // permite volver a elegir el mismo archivo
  });
}

/* ----------------------------------------------------------
   10. INICIO
   ---------------------------------------------------------- */
function almacenamientoDisponible() {
  try {
    localStorage.setItem("bar-prueba", "1");
    localStorage.removeItem("bar-prueba");
    return true;
  } catch (error) {
    return false;
  }
}

function iniciar() {
  if (!cargarDatos()) {
    crearDatosIniciales();
    guardarDatos();
  }

  // Cada parte arranca por separado: si una falla, las demás siguen funcionando
  [iniciarMenu, iniciarCarta, iniciarSalon, iniciarCierre, iniciarDatos, renderCaja].forEach((paso) => {
    try {
      paso();
    } catch (error) {
      console.error(`Falló ${paso.name}:`, error);
    }
  });

  if (!almacenamientoDisponible()) {
    mostrarMensajeDatos(
      "Este navegador no permite guardar datos: lo que cargues se perderá al cerrar la página. " +
      "Usá Exportar para conservarlo.",
      "error"
    );
  }

  window.barIniciado = true; // lo usa index.html para avisar si algo no arrancó
}

document.addEventListener("DOMContentLoaded", iniciar);
