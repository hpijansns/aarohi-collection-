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
const auth = getAuth(app);
const db = getDatabase(app);

const BOT_TOKEN = "8332178525:AAHzyIN9oTEeHGLIruz1zaUvTBnyTfcBmNg";
const CHAT_ID = "-1003759800000";

// --- UTILITIES ---
const getCart = () => JSON.parse(localStorage.getItem('aarohi_cart')) || [];
const updateCartBadge = () => {
    const el = document.getElementById('cart-count');
    if(el) el.innerText = getCart().length;
};

// --- FRONTEND: SHOP ---
if (document.getElementById('product-grid')) {
    updateCartBadge();
    onValue(ref(db, 'products'), (snapshot) => {
        const grid = document.getElementById('product-grid');
        grid.innerHTML = "";
        snapshot.forEach((child) => {
            const p = child.val();
            const id = child.key;
            if (p.active === "true" && p.stock > 0) {
                grid.innerHTML += `
                    <div class="product-card">
                        ${p.stock < 5 ? '<span class="badge">Low Stock</span>' : ''}
                        <img src="${p.imageURL}" class="product-img">
                        <div class="product-info">
                            <h3>${p.name}</h3>
                            <p class="product-price">₹${p.price}</p>
                            <button class="btn-gold" style="width:100%; margin-top:10px" onclick="addToCart('${id}', '${p.name}', ${p.price}, ${p.costPrice})">Add to Bag</button>
                        </div>
                    </div>
                `;
            }
        });
    });
}

window.addToCart = (id, name, price, costPrice) => {
    const cart = getCart();
    cart.push({id, name, price, costPrice});
    localStorage.setItem('aarohi_cart', JSON.stringify(cart));
    updateCartBadge();
    alert("Added to bag!");
};

// --- FRONTEND: CHECKOUT ---
if (document.getElementById('checkout-form')) {
    const cart = getCart();
    const itemsDiv = document.getElementById('cart-items');
    let total = 0;
    
    cart.forEach(item => {
        total += item.price;
        itemsDiv.innerHTML += `<div class="flex" style="padding: 10px 0; border-bottom: 1px solid #eee;"><span>${item.name}</span><span>₹${item.price}</span></div>`;
    });
    document.getElementById('total-price').innerText = `₹${total}`;

    document.getElementById('checkout-form').onsubmit = async (e) => {
        e.preventDefault();
        const orderId = "AR" + Math.floor(1000 + Math.random() * 9000);
        const name = document.getElementById('cust-name').value;
        const phone = document.getElementById('cust-phone').value;
        const address = document.getElementById('cust-address').value;
        const method = document.getElementById('payment-method').value;

        const orderData = {
            orderId, name, phone, address,
            productName: cart.map(i => i.name).join(", "),
            productId: cart.map(i => i.id).join(", "),
            amount: total,
            costPrice: cart.reduce((acc, i) => acc + (i.costPrice || 0), 0),
            paymentMethod: method,
            status: "Pending",
            timestamp: new Date().toISOString()
        };

        // 1. Save to Firebase
        await push(ref(db, 'orders'), orderData);

        // 2. Stock Reduction
        for(let item of cart) {
            const pRef = ref(db, `products/${item.id}`);
            const pSnap = await get(pRef);
            if(pSnap.exists()) {
                const curStock = pSnap.val().stock;
                update(pRef, { stock: curStock - 1 });
            }
        }

        // 3. Telegram Notification
        const msg = `🛍️ *New Order - Aarohi Collection*%0A%0A🆔 *Order ID:* ${orderId}%0A👤 *Customer:* ${name}%0A📞 *Phone:* ${phone}%0A📍 *Address:* ${address}%0A👗 *Product:* ${orderData.productName}%0A💰 *Amount:* ₹${total}%0A💳 *Method:* ${method}%0A📦 *Status:* Pending%0A🕒 *Date:* ${new Date().toLocaleDateString()}`;
        
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${msg}&parse_mode=Markdown`);

        localStorage.removeItem('aarohi_cart');
        alert("Order successful!");
        window.location.href = "index.html";
    };
}

// --- ADMIN: AUTH ---
if (document.getElementById('login-form')) {
    document.getElementById('login-form').onsubmit = (e) => {
        e.preventDefault();
        signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value)
        .then(() => window.location.href = "admin.html")
        .catch(err => alert("Auth Failed: " + err.message));
    };
}

// --- ADMIN: PANEL LOGIC ---
if (window.location.pathname.includes('admin.html')) {
    onAuthStateChanged(auth, (user) => {
        if (!user || user.email !== "mohitrajpura9@gmail.com") window.location.href = "login.html";
    });

    document.getElementById('logout-btn').onclick = () => signOut(auth).then(() => window.location.href = "login.html");

    // Load Stats & Orders
    onValue(ref(db, 'orders'), (snapshot) => {
        const kpi = { total: 0, pending: 0, revenue: 0, profit: 0, customers: new Set() };
        const tbody = document.getElementById('orders-table-body');
        tbody.innerHTML = "";

        snapshot.forEach(child => {
            const o = child.val();
            const key = child.key;
            kpi.total++;
            if(o.status === "Pending") kpi.pending++;
            kpi.revenue += Number(o.amount) || 0;
            kpi.profit += (Number(o.amount) - (Number(o.costPrice) || 0));
            kpi.customers.add(o.phone);

            tbody.innerHTML += `
                <tr>
                    <td>${o.orderId}</td>
                    <td>${o.name}<br><small>${o.phone}</small></td>
                    <td>${o.productName}</td>
                    <td>₹${o.amount}</td>
                    <td><span style="color:${o.status === 'Pending' ? 'orange' : 'green'}">${o.status}</span></td>
                    <td>${new Date(o.timestamp).toLocaleDateString()}</td>
                    <td>
                        <select onchange="updateOrderStatus('${key}', this.value, '${o.phone}', '${o.name}', '${o.productName}', '${o.amount}', '${o.paymentMethod}')">
                            <option value="">Update</option>
                            <option value="Shipped">Shipped</option>
                            <option value="Delivered">Delivered</option>
                            <option value="Cancelled">Cancel</option>
                        </select>
                    </td>
                </tr>
            `;
        });

        // Load Products for Stock KPI
        onValue(ref(db, 'products'), (pSnap) => {
            let lowStockCount = 0;
            const pBody = document.getElementById('products-table-body');
            pBody.innerHTML = "";
            pSnap.forEach(pChild => {
                const p = pChild.val();
                if(p.stock < 5) lowStockCount++;
                pBody.innerHTML += `
                    <tr>
                        <td><img src="${p.imageURL}" width="40"></td>
                        <td>${p.name}</td>
                        <td class="${p.stock < 5 ? 'low-stock' : ''}">${p.stock}</td>
                        <td>₹${p.price}</td>
                        <td>${p.active === 'true' ? 'Active' : 'Hidden'}</td>
                        <td><button onclick="deleteProduct('${pChild.key}')" style="color:red; background:none; border:none; cursor:pointer">Delete</button></td>
                    </tr>
                `;
            });

            document.getElementById('kpi-container').innerHTML = `
                <div class="kpi-card"><h4>Total Orders</h4><p>${kpi.total}</p></div>
                <div class="kpi-card"><h4>Pending</h4><p>${kpi.pending}</p></div>
                <div class="kpi-card"><h4>Revenue</h4><p>₹${kpi.revenue}</p></div>
                <div class="kpi-card"><h4>Profit</h4><p>₹${kpi.profit}</p></div>
                <div class="kpi-card"><h4>Customers</h4><p>${kpi.customers.size}</p></div>
                <div class="kpi-card"><h4>Low Stock</h4><p>${lowStockCount}</p></div>
            `;
        });
    });

    // Handle Product Form
    document.getElementById('product-form').onsubmit = async (e) => {
        e.preventDefault();
        const pData = {
            name: document.getElementById('p-name').value,
            price: Number(document.getElementById('p-price').value),
            costPrice: Number(document.getElementById('p-cost').value),
            stock: Number(document.getElementById('p-stock').value),
            imageURL: document.getElementById('p-img').value,
            active: document.getElementById('p-active').value,
            createdAt: new Date().toISOString()
        };
        await push(ref(db, 'products'), pData);
        alert("Product Added!");
        e.target.reset();
        window.toggleProductForm();
    };
}

// Global Order Update
window.updateOrderStatus = (key, status, phone, name, prod, amt, pay) => {
    if(!status) return;
    update(ref(db, `orders/${key}`), { status });
    
    let msg = "";
    if(status === "Shipped"){
        msg = `Dear ${name}, Your order from Aarohi Collection has been shipped successfully.%0A%0AProduct: ${prod}%0AAmount: ₹${amt}%0APayment: ${pay}%0A%0A– Team Aarohi Collection`;
    } else if(status === "Delivered") {
        msg = `Dear ${name}, Your order has been delivered successfully. Hope you love it! – Team Aarohi Collection`;
    }

    if(msg) window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
};

window.deleteProduct = (key) => { if(confirm("Delete product?")) remove(ref(db, `products/${key}`)); };
