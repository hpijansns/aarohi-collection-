import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, push, update, remove, onValue, get, query, orderByChild } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- FIREBASE INITIALIZATION (EXACT CONFIG) ---
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

// --- GLOBAL UTILITIES ---
const BOT_TOKEN = "8332178525:AAHzyIN9oTEeHGLIruz1zaUvTBnyTfcBmNg";
const CHAT_ID = "-1003759800000";

const formatPrice = (num) => "₹" + (Number(num) || 0).toLocaleString('en-IN');
const getCart = () => JSON.parse(localStorage.getItem('aarohi_cart')) || [];
const saveCart = (cart) => {
    localStorage.setItem('aarohi_cart', JSON.stringify(cart));
    updateCartBadge();
};

const updateCartBadge = () => {
    const badge = document.getElementById('cart-count');
    if(badge) badge.innerText = getCart().length;
};

// --- CUSTOMER SIDE LOGIC ---
export const initShop = async () => {
    updateCartBadge();
    const grid = document.getElementById('product-grid');
    const dbRef = ref(db, 'products');
    
    onValue(dbRef, (snapshot) => {
        grid.innerHTML = '';
        const data = snapshot.val();
        if(!data) { grid.innerHTML = '<p>No products available.</p>'; return; }

        Object.keys(data).forEach(id => {
            const p = data[id];
            if(!p.active || p.stock <= 0) return;

            const card = document.createElement('div');
            card.className = 'p-card';
            card.innerHTML = `
                ${p.stock < 5 ? '<span class="badge">Low Stock</span>' : ''}
                <img src="${p.imageURL}" class="p-img" alt="${p.name}">
                <h3>${p.name}</h3>
                <p class="p-price">${formatPrice(p.price)}</p>
                <button class="btn-gold-full mt-10" onclick="addToCart('${id}', '${p.name}', ${p.price}, '${p.imageURL}', ${p.costPrice})">Add to Bag</button>
            `;
            grid.appendChild(card);
        });
    });
};

window.addToCart = (id, name, price, img, cost) => {
    const cart = getCart();
    cart.push({ id, name, price, img, cost, qty: 1 });
    saveCart(cart);
    alert('Added to collection!');
};

// --- CHECKOUT LOGIC ---
export const initCheckout = () => {
    const cart = getCart();
    const list = document.getElementById('cart-items-list');
    let subtotal = 0;

    if(cart.length === 0) {
        list.innerHTML = "Your bag is empty.";
        return;
    }

    list.innerHTML = cart.map(item => {
        subtotal += item.price;
        return `<div class="cart-item-row">
            <span>${item.name}</span>
            <span>${formatPrice(item.price)}</span>
        </div>`;
    }).join('');

    document.getElementById('subtotal').innerText = formatPrice(subtotal);
    document.getElementById('final-total').innerText = formatPrice(subtotal);

    document.getElementById('order-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('place-order-btn');
        btn.disabled = true;
        btn.innerText = "Processing Luxury Order...";

        const orderData = {
            orderId: "AR" + Math.floor(1000 + Math.random() * 9000),
            name: document.getElementById('cust-name').value,
            phone: document.getElementById('cust-phone').value,
            address: document.getElementById('cust-address').value,
            paymentMethod: document.querySelector('input[name="payment"]:checked').value,
            items: cart,
            amount: subtotal,
            status: "Pending",
            timestamp: new Date().toISOString()
        };

        try {
            // 1. Save Order
            const newOrderRef = push(ref(db, 'orders'));
            await set(newOrderRef, orderData);

            // 2. Reduce Stock
            for(const item of cart) {
                const pRef = ref(db, `products/${item.id}/stock`);
                const snap = await get(pRef);
                const curStock = snap.val() || 0;
                await set(pRef, Math.max(0, curStock - 1));
            }

            // 3. Telegram Notify
            const msg = `🛍️ *New Order - Aarohi Collection*%0A%0A👤 *Name:* ${orderData.name}%0A📞 *Phone:* ${orderData.phone}%0A📍 *Address:* ${orderData.address}%0A👗 *Product:* ${cart[0].name}...%0A💰 *Amount:* ₹${orderData.amount}%0A💳 *Payment:* ${orderData.paymentMethod}%0A📦 *Status:* Pending%0A🕒 *Date:* ${new Date().toLocaleDateString()}`;
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${msg}&parse_mode=Markdown`);

            alert('Order Placed Successfully!');
            localStorage.removeItem('aarohi_cart');
            window.location.href = "index.html";

        } catch (err) {
            console.error(err);
            alert('Order failed. Please try again.');
            btn.disabled = false;
        }
    });
};

// --- ADMIN AUTH & DASHBOARD ---
export const initLogin = () => {
    const form = document.getElementById('login-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('admin-email').value;
        const pass = document.getElementById('admin-pass').value;
        
        signInWithEmailAndPassword(auth, email, pass)
            .then(() => window.location.href = 'admin.html')
            .catch(err => document.getElementById('login-err').innerText = "Invalid Admin Credentials");
    });
};

export const initAdmin = () => {
    onAuthStateChanged(auth, (user) => {
        if (!user || user.email !== 'mohitrajpura9@gmail.com') {
            window.location.href = 'login.html';
        } else {
            loadDashboard();
            loadOrders();
            loadProducts();
        }
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        signOut(auth).then(() => window.location.href = 'login.html');
    });

    window.showAdminSection = (sectionId) => {
        document.querySelectorAll('.admin-section').forEach(s => s.classList.add('hidden'));
        document.getElementById(`${sectionId}-section`).classList.remove('hidden');
    };
};

// --- ADMIN MODULES ---
const loadDashboard = () => {
    onValue(ref(db, 'orders'), (snapshot) => {
        const orders = snapshot.val() || {};
        const oArray = Object.values(orders);
        
        const stats = {
            total: oArray.length,
            pending: oArray.filter(o => o.status === 'Pending').length,
            revenue: oArray.reduce((acc, o) => acc + (Number(o.amount) || 0), 0),
            cod: oArray.filter(o => o.paymentMethod === 'COD').length,
            profit: oArray.reduce((acc, o) => {
                const itemProfit = o.items ? o.items.reduce((a, i) => a + (i.price - (i.cost || 0)), 0) : 0;
                return acc + itemProfit;
            }, 0)
        };

        const kpiGrid = document.getElementById('kpi-cards');
        kpiGrid.innerHTML = `
            <div class="kpi-card"><h4>Total Orders</h4><p>${stats.total}</p></div>
            <div class="kpi-card"><h4>Pending</h4><p>${stats.pending}</p></div>
            <div class="kpi-card"><h4>Total Revenue</h4><p>${formatPrice(stats.revenue)}</p></div>
            <div class="kpi-card"><h4>Total Profit</h4><p>${formatPrice(stats.profit)}</p></div>
        `;

        renderCharts(oArray);
    });
};

const loadOrders = () => {
    onValue(ref(db, 'orders'), (snapshot) => {
        const tbody = document.getElementById('orders-tbody');
        tbody.innerHTML = '';
        const data = snapshot.val() || {};
        
        Object.keys(data).reverse().forEach(key => {
            const o = data[key];
            const hoursAgo = Math.floor((new Date() - new Date(o.timestamp)) / 36e5);
            const row = document.createElement('tr');
            if(o.status === 'Pending' && hoursAgo > 48) row.className = 'aging-danger';

            row.innerHTML = `
                <td>${o.orderId}</td>
                <td>${o.name}<br><small>${o.phone}</small></td>
                <td>${o.items[0].name}</td>
                <td>${formatPrice(o.amount)}</td>
                <td><span class="status-pill">${o.status}</span></td>
                <td>${hoursAgo}h</td>
                <td>
                    <button onclick="updateStatus('${key}', 'Shipped', '${o.phone}', '${o.name}', '${o.items[0].name}', ${o.amount}, '${o.paymentMethod}')">Ship</button>
                    <button onclick="updateStatus('${key}', 'Delivered', '${o.phone}', '${o.name}')">Deliv</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    });
};

window.updateStatus = async (id, status, phone, name, prod, amt, pay) => {
    await update(ref(db, `orders/${id}`), { status });
    let msg = "";
    if(status === 'Shipped') {
        msg = `Dear ${name}, your order for ${prod} (₹${amt}) from Aarohi Collection has been shipped. Team Aarohi.`;
    } else if(status === 'Delivered') {
        msg = `Dear ${name}, your order from Aarohi Collection has been delivered. We hope you love it!`;
    }
    if(msg) window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
};

const loadProducts = () => {
    onValue(ref(db, 'products'), (snapshot) => {
        const tbody = document.getElementById('products-tbody');
        tbody.innerHTML = '';
        const data = snapshot.val() || {};
        Object.keys(data).forEach(id => {
            const p = data[id];
            tbody.innerHTML += `
                <tr>
                    <td><img src="${p.imageURL}" width="40"></td>
                    <td>${p.name}</td>
                    <td>${p.category}</td>
                    <td style="color:${p.stock < 5 ? 'red' : 'inherit'}">${p.stock}</td>
                    <td>${formatPrice(p.price)}</td>
                    <td>${p.active ? '✅' : '❌'}</td>
                    <td><button onclick="deleteProduct('${id}')">Delete</button></td>
                </tr>
            `;
        });
    });
};

window.deleteProduct = (id) => { if(confirm('Delete?')) remove(ref(db, `products/${id}`)); };

let revChart, statusChart;
const renderCharts = (orders) => {
    const ctx1 = document.getElementById('revenueChart');
    const ctx2 = document.getElementById('statusChart');
    if(!ctx1) return;

    if(revChart) revChart.destroy();
    if(statusChart) statusChart.destroy();

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    revChart = new Chart(ctx1, {
        type: 'bar',
        data: { labels: months, datasets: [{ label: 'Revenue', data: [12000, 19000, 3000, 5000, 2000, 3000], backgroundColor: '#C6A75E' }] }
    });

    const statusData = [
        orders.filter(o => o.status === 'Pending').length,
        orders.filter(o => o.status === 'Shipped').length,
        orders.filter(o => o.status === 'Delivered').length
    ];

    statusChart = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: ['Pending', 'Shipped', 'Delivered'],
            datasets: [{ data: statusData, backgroundColor: ['#E74C3C', '#C6A75E', '#27AE60'] }]
        }
    });
};
