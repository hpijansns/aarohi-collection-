import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
const auth = getAuth(app);
const db = getDatabase(app);

// --- AUTH PROTECTION ---
const adminRoot = document.getElementById('admin-root');
onAuthStateChanged(auth, (user) => {
    const path = window.location.pathname;
    if (path.includes('admin.html')) {
        if (!user || user.email !== "mohitrajpura9@gmail.com") window.location.href = 'login.html';
        else if (adminRoot) adminRoot.style.display = 'flex';
    }
});

if (document.getElementById('login-btn')) {
    document.getElementById('login-btn').onclick = () => {
        const e = document.getElementById('login-email').value;
        const p = document.getElementById('login-pass').value;
        signInWithEmailAndPassword(auth, e, p).then(() => window.location.href = 'admin.html').catch(err => document.getElementById('err').innerText = "Invalid Credentials");
    };
}
if (document.getElementById('logout-btn')) {
    document.getElementById('logout-btn').onclick = () => signOut(auth).then(() => window.location.href = 'login.html');
}

// --- GLOBAL STATE & NOTIFICATIONS ---
let lastOrderCount = 0;
const playOrderSound = () => { const s = document.getElementById('order-sound'); if(s) s.play(); };

// --- TELEGRAM & WHATSAPP ---
const sendTelegram = (o) => {
    const token = "8332178525:AAHzyIN9oTEeHGLIruz1zaUvTBnyTfcBmNg";
    const chat = "-1003759800000";
    const text = `🛍️ New Order - Aarohi Collection\n\n👤 Name: ${o.name}\n📞 Phone: ${o.phone}\n📍 Address: ${o.address}\n👗 Product: ${o.productName}\n💰 Amount: ₹${o.amount}\n💳 Payment: ${o.paymentMethod}\n📦 Status: ${o.status}\n🕒 Date: ${o.timestamp}`;
    fetch(`https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat}&text=${encodeURIComponent(text)}`);
};

window.sendWhatsApp = (id, status, phone, name, product, amount, pay) => {
    let msg = "";
    if(status === 'Shipped') msg = `Dear ${name},\n\nWe are pleased to inform you that your order from Aarohi Collection has been successfully shipped.\n\nProduct: ${product}\nAmount: ₹${amount}\nPayment: ${pay}\n\nThank you for choosing us!`;
    if(status === 'Delivered') msg = `Dear ${name},\n\nYour order from Aarohi Collection has been successfully delivered. We hope you love it!`;
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`);
};

// --- CORE DATA HANDLING ---
if (document.getElementById('orders-tbody')) {
    onValue(ref(db, 'orders'), (snap) => {
        const orders = [];
        snap.forEach(c => { orders.push({ id: c.key, ...c.val() }); });
        
        // Sound check
        if(orders.length > lastOrderCount && lastOrderCount !== 0) playOrderSound();
        lastOrderCount = orders.length;

        renderDashboard(orders);
        renderOrders(orders);
    });
}

function renderDashboard(orders) {
    let rev = 0, profit = 0, todayRev = 0, monthRev = 0, pending = 0, lowStock = 0;
    const now = new Date();
    const todayStr = now.toLocaleDateString();
    const monthStr = now.getMonth() + "-" + now.getFullYear();
    const customers = new Set();

    orders.forEach(o => {
        const amt = Number(o.amount) || 0;
        const cost = Number(o.costPrice) || 0;
        rev += amt;
        profit += (amt - cost);
        if(o.timestamp.includes(todayStr)) todayRev += amt;
        if(o.timestamp.includes(monthStr)) monthRev += amt;
        if(o.status === 'Pending') pending++;
        customers.add(o.phone);
    });

    document.getElementById('m-pending').innerText = pending;
    document.getElementById('m-total-orders').innerText = orders.length;
    document.getElementById('m-today-rev').innerText = "₹" + todayRev;
    document.getElementById('m-month-rev').innerText = "₹" + monthRev;
    document.getElementById('m-profit').innerText = "₹" + profit;
    document.getElementById('m-cust').innerText = customers.size;
    document.getElementById('m-aov').innerText = "₹" + Math.round(rev / (orders.length || 1));

    // Alerts Logic
    const alertDiv = document.getElementById('alert-items');
    alertDiv.innerHTML = "";
    if(pending > 5) alertDiv.innerHTML += `<span class="alert-item">⚠️ High Pending Orders (${pending})</span>`;
    
    // Simple Charts (Example implementation)
    // In a real pro max app, we'd use Chart.js here linked to revChart/payChart canvases
}

function renderOrders(orders) {
    const tbody = document.getElementById('orders-tbody');
    const search = document.getElementById('search-order').value.toLowerCase();
    const statusFilt = document.getElementById('filter-status').value;

    tbody.innerHTML = "";
    orders.reverse().forEach(o => {
        if(statusFilt && o.status !== statusFilt) return;
        if(search && !o.phone.includes(search) && !o.orderId.toLowerCase().includes(search)) return;

        const date = new Date(o.timestamp);
        const diffHours = Math.abs(new Date() - date) / 36e5;
        let ageClass = "";
        if(o.status === 'Pending' && diffHours > 48) ageClass = "age-red";

        tbody.innerHTML += `
            <tr>
                <td><b>${o.orderId}</b></td>
                <td class="${ageClass}">${Math.floor(diffHours)}h ago</td>
                <td>${o.name}<br><small>${o.phone}</small></td>
                <td>${o.productName}</td>
                <td>₹${o.amount}</td>
                <td>${o.paymentMethod}</td>
                <td><span class="badge bg-${o.status}">${o.status}</span></td>
                <td>
                    <button class="btn btn-action" onclick="updateOrderStatus('${o.id}', 'Confirmed')">Confirm</button>
                    <button class="btn btn-gold" onclick="updateOrderStatus('${o.id}', 'Shipped')">Ship</button>
                    <button class="btn btn-success" style="background:#27ae60; color:white;" onclick="updateOrderStatus('${o.id}', 'Delivered')">Deliver</button>
                    <button class="btn btn-whatsapp" onclick="sendWhatsApp('${o.id}', '${o.status}', '${o.phone}', '${o.name}', '${o.productName}', '${o.amount}', '${o.paymentMethod}')">WA</button>
                </td>
            </tr>
        `;
    });
}

window.updateOrderStatus = (id, newStatus) => {
    update(ref(db, `orders/${id}`), { status: newStatus });
};

// --- STOREFRONT & CHECKOUT ---
if (document.getElementById('store-grid')) {
    onValue(ref(db, 'products'), (snap) => {
        const grid = document.getElementById('store-grid');
        grid.innerHTML = "";
        snap.forEach(c => {
            const p = c.val();
            if(!p.active || p.stock <= 0) return;
            grid.innerHTML += `
                <div class="stat-card" style="text-align:center">
                    <img src="${p.img}" style="width:100%; height:250px; object-fit:cover; border-radius:8px;">
                    <h3 style="margin:10px 0">${p.name}</h3>
                    <p class="price" style="color:var(--gold); font-weight:bold">₹${p.price}</p>
                    <button class="btn btn-gold" style="width:100%; margin-top:10px" onclick="buyNow('${c.key}', '${p.name}', ${p.price}, ${p.cost})">Add to Cart</button>
                </div>
            `;
        });
    });
}

window.buyNow = (id, name, price, cost) => {
    localStorage.setItem('aarohi_cart', JSON.stringify({id, name, price, cost}));
    window.location.href = 'checkout.html';
};

const placeOrderForm = document.getElementById('place-order-form');
if (placeOrderForm) {
    const cart = JSON.parse(localStorage.getItem('aarohi_cart'));
    document.getElementById('checkout-summary').innerHTML = `<b>Item:</b> ${cart.name} <br> <b>Total:</b> ₹${cart.price}`;

    placeOrderForm.onsubmit = async (e) => {
        e.preventDefault();
        const o = {
            orderId: "AR" + Math.floor(1000 + Math.random() * 9000),
            name: document.getElementById('cust-name').value,
            phone: document.getElementById('cust-phone').value,
            address: document.getElementById('cust-address').value,
            productName: cart.name,
            productId: cart.id,
            amount: Number(cart.price),
            costPrice: Number(cart.cost),
            paymentMethod: document.getElementById('cust-pay').value,
            status: "Pending",
            timestamp: new Date().toLocaleString()
        };
        const newRef = push(ref(db, 'orders'));
        await set(newRef, o);
        sendTelegram(o);
        alert("Order Placed Successfully!");
        localStorage.clear();
        window.location.href = "index.html";
    };
}

// --- ADMIN TABS & UTILS ---
window.switchTab = (tab) => {
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    document.getElementById('tab-' + tab).style.display = 'block';
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    event.currentTarget.classList.add('active');
};

window.exportOrders = () => {
    onValue(ref(db, 'orders'), (snap) => {
        let csv = "Order ID,Name,Phone,Product,Amount,Payment,Status,Date\n";
        snap.forEach(c => {
            const o = c.val();
            csv += `${o.orderId},${o.name},${o.phone},${o.productName},${o.amount},${o.paymentMethod},${o.status},${o.timestamp}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'aarohi_orders.csv'; a.click();
    }, { onlyOnce: true });
};

// Search listeners
if(document.getElementById('search-order')) {
    document.getElementById('search-order').oninput = () => {
        onValue(ref(db, 'orders'), (snap) => {
            const orders = []; snap.forEach(c => orders.push
