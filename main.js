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

// --- AUTH LOGIC ---
const path = window.location.pathname;
if (path.includes('admin.html')) {
    onAuthStateChanged(auth, (user) => {
        if (!user || user.email !== "mohitrajpura9@gmail.com") {
            window.location.href = 'login.html';
        } else {
            document.getElementById('admin-body').style.display = 'flex';
            initAdmin();
        }
    });
}

// --- STOREFRONT LOGIC ---
if (document.getElementById('store-grid')) {
    onValue(ref(db, 'products'), (snap) => {
        const grid = document.getElementById('store-grid');
        grid.innerHTML = '';
        snap.forEach(child => {
            const p = child.val();
            if(!p.active) return;
            grid.innerHTML += `
                <div class="product-card">
                    ${p.stock < 5 ? '<span class="low-stock-tag">Low Stock</span>' : ''}
                    <img src="${p.img}" alt="${p.name}">
                    <div class="p-info">
                        <h3>${p.name}</h3>
                        <p class="p-price">₹${p.price}</p>
                        <button class="btn btn-gold" onclick="addToCart('${child.key}', '${p.name}', ${p.price}, ${p.costPrice})">Buy Now</button>
                    </div>
                </div>
            `;
        });
    });
}

window.addToCart = (id, name, price, cost) => {
    localStorage.setItem('aarohi_cart', JSON.stringify({id, name, price, cost}));
    window.location.href = 'checkout.html';
};

// --- CHECKOUT LOGIC ---
const orderForm = document.getElementById('order-form');
if (orderForm) {
    const cart = JSON.parse(localStorage.getItem('aarohi_cart'));
    if(!cart) window.location.href = 'index.html';
    document.getElementById('cart-summary').innerHTML = `<h3>${cart.name}</h3><p>Total: ₹${cart.price}</p>`;

    orderForm.onsubmit = async (e) => {
        e.preventDefault();
        const orderData = {
            orderId: "AR" + Date.now().toString().slice(-6),
            name: document.getElementById('cust-name').value,
            phone: document.getElementById('cust-phone').value,
            address: document.getElementById('cust-address').value,
            productName: cart.name,
            amount: Number(cart.price),
            costPrice: Number(cart.cost),
            paymentMethod: document.getElementById('pay-method').value,
            status: "Pending",
            timestamp: new Date().toLocaleString()
        };

        const newOrderRef = push(ref(db, 'orders'));
        await set(newOrderRef, orderData);
        sendTelegram(orderData);
        localStorage.clear();
        alert("Order Placed!");
        window.location.href = 'index.html';
    };
}

// --- TELEGRAM ---
async function sendTelegram(o) {
    const token = "8332178525:AAHzyIN9oTEeHGLIruz1zaUvTBnyTfcBmNg";
    const chat = "-1003759800000";
    const text = `🛍️ New Order - Aarohi Collection\n\n👤 Name: ${o.name}\n📞 Phone: ${o.phone}\n📍 Address: ${o.address}\n👗 Product: ${o.productName}\n💰 Amount: ₹${o.amount}\n💳 Payment: ${o.paymentMethod}\n📦 Status: Pending\n🕒 Date: ${o.timestamp}`;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat}&text=${encodeURIComponent(text)}`);
}

// --- ADMIN LOGIC ---
function initAdmin() {
    // Stats and Orders
    onValue(ref(db, 'orders'), (snap) => {
        let rev = 0, profit = 0, pending = 0, customers = new Set();
        const tbody = document.getElementById('admin-orders-table');
        tbody.innerHTML = '';

        snap.forEach(child => {
            const o = child.val();
            rev += Number(o.amount);
            profit += (Number(o.amount) - Number(o.costPrice));
            if(o.status === 'Pending') pending++;
            customers.add(o.phone);

            tbody.innerHTML += `
                <tr>
                    <td>${o.orderId}</td>
                    <td>${o.name}</td>
                    <td>${o.phone}</td>
                    <td>${o.productName}</td>
                    <td>₹${o.amount}</td>
                    <td><span class="status-badge ${o.status}">${o.status}</span></td>
                    <td>
                        <button onclick="updateStatus('${child.key}', 'Shipped')" class="btn" style="padding:5px; background:#eee;">Ship</button>
                        <button onclick="updateStatus('${child.key}', 'Delivered')" class="btn" style="padding:5px; background:#ddd;">Deliver</button>
                        <button onclick="sendWA('${o.phone}', '${o.name}', '${o.status}')" class="btn" style="padding:5px; background:#25D366; color:white;">WA</button>
                    </td>
                </tr>
            `;
        });

        document.getElementById('stat-pending').innerText = pending;
        document.getElementById('stat-rev').innerText = "₹" + rev;
        document.getElementById('stat-profit').innerText = "₹" + profit;
        document.getElementById('stat-cust').innerText = customers.size;
    });

    // Inventory
    onValue(ref(db, 'products'), (snap) => {
        const tbody = document.getElementById('admin-product-table');
        tbody.innerHTML = '';
        snap.forEach(child => {
            const p = child.val();
            tbody.innerHTML += `
                <tr>
                    <td><img src="${p.img}" width="40"></td>
                    <td>${p.name}</td>
                    <td>₹${p.price}</td>
                    <td style="color:${p.stock < 5 ? 'red' : 'inherit'}">${p.stock}</td>
                    <td>
                        <button onclick="editProduct('${child.key}')">Edit</button>
                        <button onclick="deleteProduct('${child.key}')">Del</button>
                    </td>
                </tr>
            `;
        });
    });
}

// Admin Helpers
window.switchTab = (tab) => {
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    document.getElementById('sec-' + tab).style.display = 'block';
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    event.target.classList.add('active');
};

window.updateStatus = (id, status) => {
    update(ref(db, `orders/${id}`), { status });
};

window.sendWA = (phone, name, status) => {
    let msg = `Hello ${name}, your order from Aarohi Collection is now ${status}.`;
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`);
};

window.saveProduct = () => {
    const id = document.getElementById('p-id').value;
    const data = {
        name: document.getElementById('p-name').value,
        price: Number(document.getElementById('p-price').value),
        costPrice: Number(document.getElementById('p-cost').value),
        stock: Number(document.getElementById('p-stock').value),
        img: document.getElementById('p-img').value,
        active: true
    };
    if(id) update(ref(db, `products/${id}`), data);
    else push(ref(db, 'products'), data);
    document.getElementById('product-form').style.display = 'none';
};

document.getElementById('save-product-btn').onclick = window.saveProduct;

window.editProduct = (id) => {
    onValue(ref(db, `products/${id}`), (snap) => {
        const p = snap.val();
        document.getElementById('p-id').value = id;
        document.getElementById('p-name').value = p.name;
        document.getElementById('p-price').value = p.price;
        document.getElementById('p-cost').value = p.costPrice;
        document.getElementById('p-stock').value = p.stock;
        document.getElementById('p-img').value = p.img;
        document.getElementById('product-form').style.display = 'block';
    }, { onlyOnce: true });
};

window.deleteProduct = (id) => {
    if(confirm('Delete product?')) remove(ref(db, `products/${id}`));
};

// Login Handler
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.onsubmit = (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const pass = document.getElementById('pass').value;
        signInWithEmailAndPassword(auth, email, pass)
            .then(() => window.location.href = 'admin.html')
            .catch(err => document.getElementById('error').innerText = "Invalid Login");
    };
}

// Logout
if(document.getElementById('logout-btn')){
    document.getElementById('logout-btn').onclick = () => signOut(auth).then(() => window.location.href = 'login.html');
}
