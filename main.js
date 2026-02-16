import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, push, onValue, get, update, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBD-mzED_h1NEu4kyON4UTYn9RJ0pE7TWc",
  authDomain: "aarohi-collection-51e0d.firebaseapp.com",
  databaseURL: "https://aarohi-collection-51e0d-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "aarohi-collection-51e0d",
  storageBucket: "aarohi-collection-51e0d.firebasestorage.app",
  messagingSenderId: "1053777428600",
  appId: "1:1053777428600:web:7398e9052082c6ba5c2d8d"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// --- State Management ---
const TELEGRAM_CONFIG = {
    token: "8332178525:AAHzyIN9oTEeHGLIruz1zaUvTBnyTfcBmNg",
    chatId: "-1003759800000"
};

// --- Currency Formatter ---
const formatINR = (val) => "₹" + (Number(val) || 0).toLocaleString('en-IN');

// --- Cart System ---
const getCart = () => JSON.parse(localStorage.getItem('aarohi_cart')) || [];
const saveCart = (cart) => {
    localStorage.setItem('aarohi_cart', JSON.stringify(cart));
    updateCartCount();
};
const updateCartCount = () => {
    const el = document.getElementById('cart-count');
    if (el) el.innerText = getCart().reduce((sum, item) => sum + item.qty, 0);
};

// --- Notification Engine ---
async function sendTelegram(msg) {
    const url = `https://api.telegram.org/bot${TELEGRAM_CONFIG.token}/sendMessage?chat_id=${TELEGRAM_CONFIG.chatId}&text=${encodeURIComponent(msg)}&parse_mode=Markdown`;
    try { await fetch(url); } catch (e) { console.error("Telegram fail", e); }
}

// --- Storefront ---
if (document.getElementById('product-grid')) {
    updateCartCount();
    onValue(ref(db, 'products'), (snap) => {
        const grid = document.getElementById('product-grid');
        grid.innerHTML = "";
        const data = snap.val();
        if (!data) return;

        Object.keys(data).forEach(id => {
            const p = data[id];
            if (p.active === "true") {
                const stock = Number(p.stock) || 0;
                const card = document.createElement('div');
                card.className = "product-card";
                card.innerHTML = `
                    <div class="p-img-box">
                        ${stock === 0 ? '<span class="stock-badge">OUT OF STOCK</span>' : stock < 5 ? `<span class="stock-badge">ONLY ${stock} LEFT</span>` : ''}
                        <img src="${p.imageURL}" alt="${p.name}">
                    </div>
                    <div class="p-details">
                        <h3>${p.name}</h3>
                        <p class="p-price">${formatINR(p.price)}</p>
                        <button class="btn-gold-full" ${stock === 0 ? 'disabled' : ''} id="add-${id}">
                            ${stock === 0 ? 'SOLD OUT' : 'ADD TO BAG'}
                        </button>
                    </div>
                `;
                grid.appendChild(card);
                document.getElementById(`add-${id}`).onclick = () => {
                    const cart = getCart();
                    const existing = cart.find(i => i.id === id);
                    if (existing) {
                        if (existing.qty < stock) existing.qty += 1;
                        else alert("Maximum available stock reached");
                    } else {
                        cart.push({ id, name: p.name, price: p.price, costPrice: p.costPrice, qty: 1, stock: stock, img: p.imageURL });
                    }
                    saveCart(cart);
                };
            }
        });
    });
}

// --- Checkout System ---
if (document.getElementById('checkout-form')) {
    const renderCart = () => {
        const cart = getCart();
        const list = document.getElementById('checkout-cart-list');
        let subtotal = 0;
        list.innerHTML = "";

        if (cart.length === 0) {
            list.innerHTML = "<p style='text-align:center; padding:20px;'>Your bag is empty.</p>";
            document.getElementById('subtotal').innerText = "₹0";
            document.getElementById('grand-total').innerText = "₹0";
            return;
        }

        cart.forEach((item, idx) => {
            const total = item.price * item.qty;
            subtotal += total;
            const div = document.createElement('div');
            div.className = "cart-item";
            div.innerHTML = `
                <img src="${item.img}" class="cart-img">
                <div class="cart-info">
                    <h3>${item.name}</h3>
                    <p style="color:var(--gold); font-weight:600;">${formatINR(item.price)}</p>
                    <div class="qty-controls">
                        <button onclick="changeQty(${idx}, -1)" class="qty-btn">-</button>
                        <span>${item.qty}</span>
                        <button onclick="changeQty(${idx}, 1)" class="qty-btn">+</button>
                    </div>
                </div>
                <button onclick="removeCartItem(${idx})" style="background:none; border:none; color:red; cursor:pointer;"><i class="fa fa-trash"></i></button>
            `;
            list.appendChild(div);
        });
        document.getElementById('subtotal').innerText = formatINR(subtotal);
        document.getElementById('grand-total').innerText = formatINR(subtotal);
    };

    window.changeQty = (idx, delta) => {
        const cart = getCart();
        const item = cart[idx];
        const newQty = item.qty + delta;
        if (newQty > 0 && newQty <= item.stock) {
            item.qty = newQty;
            saveCart(cart);
            renderCart();
        }
    };

    window.removeCartItem = (idx) => {
        const cart = getCart();
        cart.splice(idx, 1);
        saveCart(cart);
        renderCart();
    };

    renderCart();

    document.getElementById('checkout-form').onsubmit = async (e) => {
        e.preventDefault();
        const cart = getCart();
        if (cart.length === 0) return alert("Bag is empty");

        const btn = document.getElementById('submit-order-btn');
        const btnText = document.getElementById('btn-text');
        const loader = document.getElementById('loader');

        btn.disabled = true;
        btnText.classList.add('hidden');
        loader.classList.remove('hidden');

        const orderId = "AR" + Math.floor(1000 + Math.random() * 9000);
        const name = document.getElementById('cust-name').value;
        const phone = document.getElementById('cust-phone').value;
        const address = document.getElementById('cust-address').value;
        const payMethod = document.getElementById('payment-method').value;

        const totalAmt = cart.reduce((s, i) => s + (i.price * i.qty), 0);
        const totalCost = cart.reduce((s, i) => s + ((i.costPrice || 0) * i.qty), 0);

        const orderData = {
            orderId, name, phone, address, 
            paymentMethod: payMethod,
            items: cart,
            amount: totalAmt,
            costPrice: totalCost,
            status: "Pending",
            timestamp: new Date().toISOString()
        };

        try {
            await push(ref(db, 'orders'), orderData);
            
            for (const item of cart) {
                const pRef = ref(db, `products/${item.id}/stock`);
                const snap = await get(pRef);
                const curStock = Number(snap.val()) || 0;
                await set(pRef, Math.max(0, curStock - item.qty));
            }

            const teleMsg = `🛍️ *New Order - Aarohi Collection*\n\n` +
                `🆔 *Order ID:* ${orderId}\n` +
                `👤 *Name:* ${name}\n` +
                `📞 *Phone:* ${phone}\n` +
                `📍 *Address:* ${address}\n` +
                `👗 *Product:* ${cart[0].name} ${cart.length > 1 ? `(+${cart.length-1} more)` : ''}\n` +
                `🔢 *Quantity:* ${cart.reduce((s,i)=>s+i.qty,0)}\n` +
                `💰 *Total:* ${formatINR(totalAmt)}\n` +
                `💳 *Payment:* ${payMethod}\n` +
                `📦 *Status:* Pending\n` +
                `🕒 *Date:* ${new Date().toLocaleString()}`;
            
            await sendTelegram(teleMsg);
            localStorage.removeItem('aarohi_cart');
            window.location.href = `success.html?oid=${orderId}`;
        } catch (err) {
            alert("Error: " + err.message);
            btn.disabled = false;
            btnText.classList.remove('hidden');
            loader.classList.add('hidden');
        }
    };
}

// --- Success Page Logic ---
if (document.getElementById('display-order-id')) {
    const params = new URLSearchParams(window.location.search);
    const oid = params.get('oid') || "#AR0000";
    document.getElementById('display-order-id').innerText = oid;
    document.getElementById('support-wa').href = `https://wa.me/918332178525?text=${encodeURIComponent('Hello, I have a query regarding my order ' + oid)}`;
}

// --- Admin Panel Logic ---
if (window.location.pathname.includes('admin.html')) {
    onAuthStateChanged(auth, (user) => {
        if (!user || user.email !== 'mohitrajpura9@gmail.com') window.location.href = 'login.html';
    });

    document.getElementById('admin-logout').onclick = () => signOut(auth).then(() => window.location.href = "login.html");

    // Dashboard Engine
    onValue(ref(db, 'orders'), (snap) => {
        const orders = snap.val() || {};
        const oList = Object.keys(orders).map(k => ({...orders[k], key: k}));
        
        const stats = {
            total: oList.length,
            pending: oList.filter(o => o.status === 'Pending').length,
            shipped: oList.filter(o => o.status === 'Shipped').length,
            delivered: oList.filter(o => o.status === 'Delivered').length,
            revenue: oList.reduce((s, o) => s + (Number(o.amount) || 0), 0),
            profit: oList.reduce((s, o) => s + ((Number(o.amount) || 0) - (Number(o.costPrice) || 0)), 0),
            customers: new Set(oList.map(o => o.phone)).size
        };

        const container = document.getElementById('kpi-container');
        container.innerHTML = `
            <div class="kpi-card"><small>Total Orders</small><p>${stats.total}</p></div>
            <div class="kpi-card"><small>Revenue</small><p>${formatINR(stats.revenue)}</p></div>
            <div class="kpi-card"><small>Net Profit</small><p>${formatINR(stats.profit)}</p></div>
            <div class="kpi-card"><small>Customers</small><p>${stats.customers}</p></div>
            <div class="kpi-card"><small>Pending</small><p style="color:var(--gold)">${stats.pending}</p></div>
            <div class="kpi-card"><small>Shipped</small><p style="color:#3498db">${stats.shipped}</p></div>
            <div class="kpi-card"><small>Delivered</small><p style="color:var(--success)">${stats.delivered}</p></div>
        `;

        const list = document.getElementById('orders-list');
        list.innerHTML = "";
        oList.reverse().forEach(o => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><b>${o.orderId}</b></td>
                <td>${o.name}<br><small>${o.phone}</small></td>
                <td>${o.items[0].name}...</td>
                <td>${o.items.reduce((s,i)=>s+i.qty,0)}</td>
                <td>${formatINR(o.amount)}</td>
                <td><span style="font-weight:bold; color:${o.status === 'Pending' ? 'orange' : 'green'}">${o.status}</span></td>
                <td>
                    <select onchange="window.updateStatus('${o.key}', this.value)" class="table-select">
                        <option value="">Update</option>
                        <option value="Confirmed">Confirm</option>
                        <option value="Shipped">Ship</option>
                        <option value="Delivered">Deliver</option>
                    </select>
                    <button onclick="window.sendWA('${o.phone}', '${o.name}', '${o.status}', '${o.items[0].name}', '${o.amount}', '${o.paymentMethod}')" class="wa-btn">
                        <i class="fa-brands fa-whatsapp"></i>
                    </button>
                </td>
            `;
            list.appendChild(row);
        });
    });

    window.updateStatus = async (key, val) => {
        if (!val) return;
        await update(ref(db, `orders/${key}`), { status: val });
    };

    window.sendWA = (phone, name, status, prod, amt, method) => {
        let msg = "";
        const corp = "\n\nWarm regards,\nTeam Aarohi Collection";
        
        if (status === "Confirmed") {
            msg = `Dear ${name},\n\nYour order with Aarohi Collection has been successfully confirmed and is currently being processed.${corp}`;
        } else if (status === "Shipped") {
            msg = `Dear ${name},\n\nWe are pleased to inform you that your order from Aarohi Collection has been shipped.\n\nOrder Details:\n• Product: ${prod}\n• Amount: ${formatINR(amt)}\n• Payment: ${method}${corp}`;
        } else if (status === "Delivered") {
            msg = `Dear ${name},\n\nYour order from Aarohi Collection has been successfully delivered. We truly hope you love your purchase.${corp}`;
        } else {
            msg = `Hello ${name}, regarding your order with Aarohi Collection...`;
        }
        window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    // Product Engine
    onValue(ref(db, 'products'), (snap) => {
        const list = document.getElementById('admin-product-list');
        list.innerHTML = "";
        const data = snap.val() || {};
        Object.keys(data).forEach(id => {
            const p = data[id];
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><img src="${p.imageURL}" class="cart-img"></td>
                <td>${p.name}</td>
                <td><span class="${p.stock < 5 ? 'low-stock' : ''}">${p.stock}</span></td>
                <td>${formatINR(p.price)}</td>
                <td>${p.active === "true" ? "✅" : "❌"}</td>
                <td>
                    <button onclick="window.editProd('${id}')"><i class="fa fa-edit"></i></button>
                    <button onclick="window.delProd('${id}')" style="color:red"><i class="fa fa-trash"></i></button>
                </td>
            `;
            list.appendChild(row);
        });
    });

    document.getElementById('product-form').onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('p-id').value;
        const pData = {
            name: document.getElementById('p-name').value,
            desc: document.getElementById('p-desc').value,
            price: Number(document.getElementById('p-price').value),
            costPrice: Number(document.getElementById('p-cost').value),
            stock: Number(document.getElementById('p-stock').value),
            active: document.getElementById('p-active').value,
            imageURL: document.getElementById('p-image').value
        };

        if (id) await update(ref(db, `products/${id}`), pData);
        else await push(ref(db, 'products'), pData);
        
        document.getElementById('product-modal').classList.add('hidden');
        document.getElementById('product-form').reset();
    };

    window.editProd = async (id) => {
        const snap = await get(ref(db, `products/${id}`));
        const p = snap.val();
        document.getElementById('p-id').value = id;
        document.getElementById('p-name').value = p.name;
        document.getElementById('p-desc').value = p.desc || "";
        document.getElementById('p-price').value = p.price;
        document.getElementById('p-cost').value = p.costPrice;
        document.getElementById('p-stock').value = p.stock;
        document.getElementById('p-active').value = p.active;
        document.getElementById('p-image').value = p.imageURL;
        document.getElementById('product-modal').classList.remove('hidden');
    };

    window.delProd = (id) => {
        if (confirm("Delete product permanently?")) remove(ref(db, `products/${id}`));
    };
}

// --- Login Page Logic ---
if (document.getElementById('login-form')) {
    document.getElementById('login-form').onsubmit = async (e) => {
        e.preventDefault();
        const em = document.getElementById('email').value;
        const ps = document.getElementById('password').value;
        try {
            await signInWithEmailAndPassword(auth, em, ps);
            window.location.href = "admin.html";
        } catch (err) {
            document.getElementById('login-error').classList.remove('hidden');
        }
    };
}
