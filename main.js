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

// Global State
let cart = JSON.parse(localStorage.getItem('aarohi_cart')) || null;
const TELEGRAM_BOT = "8332178525:AAHzyIN9oTEeHGLIruz1zaUvTBnyTfcBmNg";
const CHAT_ID = "-1003759800000";

// Formatting
const formatINR = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(val) || 0);

// Cart UI
const updateCartCount = () => {
    const el = document.getElementById('cart-count');
    if (el) el.innerText = cart ? 1 : 0;
};

// Frontend: Products
if (document.getElementById('product-grid')) {
    updateCartCount();
    onValue(ref(db, 'products'), (snapshot) => {
        const grid = document.getElementById('product-grid');
        grid.innerHTML = "";
        const data = snapshot.val();
        if (!data) return;

        Object.keys(data).forEach(id => {
            const p = data[id];
            if (p.active === "true") {
                const card = document.createElement('div');
                card.className = "product-card";
                card.innerHTML = `
                    ${p.stock < 5 ? '<span class="badge-low-stock">LOW STOCK</span>' : ''}
                    <img src="${p.imageURL}" class="product-img" alt="${p.name}">
                    <div class="product-info">
                        <small style="color: #999; text-transform: uppercase;">${p.category}</small>
                        <h3>${p.name}</h3>
                        <p class="product-price">${formatINR(p.price)}</p>
                        <button class="btn-gold w-100" id="btn-${id}">Add to Bag</button>
                    </div>
                `;
                grid.appendChild(card);
                document.getElementById(`btn-${id}`).onclick = () => {
                    cart = { id, name: p.name, price: p.price, costPrice: p.costPrice };
                    localStorage.setItem('aarohi_cart', JSON.stringify(cart));
                    window.location.href = 'checkout.html';
                };
            }
        });
    });
}

// Frontend: Checkout
if (document.getElementById('checkout-form')) {
    if (!cart) window.location.href = 'index.html';

    document.getElementById('checkout-item').innerHTML = `
        <div class="summary-item"><span>${cart.name}</span><strong>${formatINR(cart.price)}</strong></div>
        <div class="summary-item" style="border-top: 1px solid #ddd; padding-top: 10px; margin-top: 10px;">
            <span>Delivery</span><strong>FREE</strong>
        </div>
        <div class="summary-item" style="font-size: 1.2rem; margin-top: 5px;">
            <span>Total</span><strong>${formatINR(cart.price)}</strong>
        </div>
    `;

    document.getElementById('checkout-form').onsubmit = async (e) => {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button');
        submitBtn.disabled = true;
        submitBtn.innerText = "Processing...";

        const orderId = "AR" + Date.now().toString().slice(-6);
        const name = document.getElementById('cust-name').value;
        const phone = document.getElementById('cust-phone').value;
        const address = document.getElementById('cust-address').value;
        const payment = document.getElementById('cust-payment').value;

        const orderData = {
            orderId, name, phone, address, payment,
            product: cart.name,
            productId: cart.id,
            amount: cart.price,
            costPrice: cart.costPrice || 0,
            status: "Pending",
            date: new Date().toISOString()
        };

        try {
            await push(ref(db, 'orders'), orderData);
            
            // Stock Update
            const pRef = ref(db, `products/${cart.id}`);
            const pSnap = await get(pRef);
            if(pSnap.exists()){
                const currentStock = Number(pSnap.val().stock) || 0;
                await update(pRef, { stock: Math.max(0, currentStock - 1) });
            }

            // Telegram
            const msg = `🛍️ *New Order: Aarohi Collection*%0A%0A` +
                        `*Order ID:* ${orderId}%0A` +
                        `*Customer:* ${name}%0A` +
                        `*Phone:* ${phone}%0A` +
                        `*Address:* ${address}%0A` +
                        `*Product:* ${cart.name}%0A` +
                        `*Amount:* ${formatINR(cart.price)}%0A` +
                        `*Payment:* ${payment}%0A` +
                        `*Status:* Pending%0A` +
                        `*Date:* ${new Date().toLocaleDateString()}`;

            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT}/sendMessage?chat_id=${CHAT_ID}&text=${msg}&parse_mode=Markdown`);

            localStorage.removeItem('aarohi_cart');
            alert("Order Placed Successfully!");
            window.location.href = 'index.html';
        } catch (err) {
            alert("Error placing order. Please try again.");
            submitBtn.disabled = false;
        }
    };
}

// Admin: Login
if (document.getElementById('login-form')) {
    document.getElementById('login-form').onsubmit = (e) => {
        e.preventDefault();
        const em = document.getElementById('email').value;
        const pw = document.getElementById('password').value;
        signInWithEmailAndPassword(auth, em, pw)
            .then(() => window.location.href = 'admin.html')
            .catch(() => document.getElementById('login-error').innerText = "Invalid credentials.");
    };
}

// Admin: Logic
if (window.location.pathname.includes('admin.html')) {
    onAuthStateChanged(auth, (user) => {
        if (!user || user.email !== 'mohitrajpura9@gmail.com') window.location.href = 'login.html';
    });

    document.getElementById('logout-btn').onclick = () => signOut(auth);

    // Dashboard Data
    onValue(ref(db, 'orders'), (snapshot) => {
        const orders = snapshot.val() || {};
        const productsRef = ref(db, 'products');
        
        get(productsRef).then(pSnap => {
            const products = pSnap.val() || {};
            const orderList = Object.keys(orders).map(key => ({...orders[key], key})).reverse();
            
            // KPIs
            const stats = {
                total: orderList.length,
                pending: orderList.filter(o => o.status === 'Pending').length,
                shipped: orderList.filter(o => o.status === 'Shipped').length,
                delivered: orderList.filter(o => o.status === 'Delivered').length,
                revenue: orderList.reduce((acc, o) => acc + (Number(o.amount) || 0), 0),
                profit: orderList.reduce((acc, o) => acc + ((Number(o.amount) || 0) - (Number(o.costPrice) || 0)), 0),
                customers: new Set(orderList.map(o => o.phone)).size
            };

            document.getElementById('kpi-container').innerHTML = `
                <div class="kpi-card"><div class="kpi-label">Total Orders</div><div class="kpi-value">${stats.total}</div></div>
                <div class="kpi-card"><div class="kpi-label">Revenue</div><div class="kpi-value">${formatINR(stats.revenue)}</div></div>
                <div class="kpi-card"><div class="kpi-label">Total Profit</div><div class="kpi-value">${formatINR(stats.profit)}</div></div>
                <div class="kpi-card"><div class="kpi-label">Active Customers</div><div class="kpi-value">${stats.customers}</div></div>
                <div class="kpi-card"><div class="kpi-label">Pending Orders</div><div class="kpi-value" style="color:var(--status-pending)">${stats.pending}</div></div>
                <div class="kpi-card"><div class="kpi-label">Shipped</div><div class="kpi-value" style="color:var(--status-shipped)">${stats.shipped}</div></div>
                <div class="kpi-card"><div class="kpi-label">Delivered</div><div class="kpi-value" style="color:var(--status-delivered)">${stats.delivered}</div></div>
            `;

            // Orders Table
            const tbody = document.getElementById('orders-table-body');
            tbody.innerHTML = orderList.map(o => `
                <tr>
                    <td>${new Date(o.date).toLocaleDateString()}</td>
                    <td style="font-weight:600; font-size:12px;">${o.orderId}</td>
                    <td>${o.name}<br><small style="color:#888">${o.phone}</small></td>
                    <td>${formatINR(o.amount)}</td>
                    <td><small>${o.payment}</small></td>
                    <td><span class="status-badge bg-${o.status.toLowerCase()}">${o.status}</span></td>
                    <td>
                        <select onchange="window.updateStatus('${o.key}', this.value)" class="form-control" style="padding: 5px; font-size: 12px; width: auto; margin-bottom: 0;">
                            <option value="">Update</option>
                            <option value="Confirmed">Confirm</option>
                            <option value="Shipped">Ship</option>
                            <option value="Delivered">Deliver</option>
                            <option value="Cancelled">Cancel</option>
                        </select>
                    </td>
                </tr>
            `).join('');
        });
    });

    // Update Status Logic
    window.updateStatus = async (key, status) => {
        if (!status) return;
        const snap = await get(ref(db, `orders/${key}`));
        const o = snap.val();
        await update(ref(db, `orders/${key}`), { status });
        
        let msg = "";
        const customerName = o.name;

        if (status === "Confirmed") {
            msg = `Dear ${customerName},\n\nYour order with Aarohi Collection has been successfully confirmed and is currently being processed.\n\nWe will notify you once it is shipped.\n\nWarm regards,\nTeam Aarohi Collection`;
        } else if (status === "Shipped") {
            msg = `Dear ${customerName},\n\nWe are pleased to inform you that your order from Aarohi Collection has been successfully shipped.\n\nOrder Details:\n• Product: ${o.product}\n• Amount Paid: ${formatINR(o.amount)}\n• Payment Method: ${o.payment}\n\nYour order is now on its way.\n\nWarm regards,\nTeam Aarohi Collection`;
        } else if (status === "Delivered") {
            msg = `Dear ${customerName},\n\nWe are happy to inform you that your order from Aarohi Collection has been successfully delivered.\n\nWe truly hope you love your purchase.\n\nIf you need any assistance, feel free to contact us.\n\nWarm regards,\nTeam Aarohi Collection`;
        }

        if (msg) {
            const encoded = encodeURIComponent(msg);
            window.open(`https://wa.me/91${o.phone}?text=${encoded}`, '_blank');
        }
    };

    // Inventory CRUD
    onValue(ref(db, 'products'), (snapshot) => {
        const products = snapshot.val() || {};
        const tbody = document.getElementById('products-table-body');
        tbody.innerHTML = Object.keys(products).map(id => {
            const p = products[id];
            return `
                <tr>
                    <td><img src="${p.imageURL}" width="40" height="40" style="object-fit:cover; border-radius:4px;"></td>
                    <td>${p.name}</td>
                    <td style="color:${p.stock < 5 ? 'red' : 'inherit'}; font-weight:${p.stock < 5 ? 'bold' : 'normal'}">${p.stock}</td>
                    <td>${formatINR(p.price)}</td>
                    <td>${p.active === 'true' ? '✅' : '❌'}</td>
                    <td>
                        <button onclick="window.editProduct('${id}')" style="border:none; background:none; color:blue; cursor:pointer;"><i class="fa fa-edit"></i></button>
                        <button onclick="window.deleteProduct('${id}')" style="border:none; background:none; color:red; cursor:pointer; margin-left:10px;"><i class="fa fa-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    });

    document.getElementById('product-form').onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-id').value;
        const pData = {
            name: document.getElementById('p-name').value,
            category: document.getElementById('p-category').value,
            price: Number(document.getElementById('p-price').value),
            costPrice: Number(document.getElementById('p-cost').value),
            stock: Number(document.getElementById('p-stock').value),
            imageURL: document.getElementById('p-image').value,
            active: document.getElementById('p-active').value
        };

        if (id) await update(ref(db, `products/${id}`), pData);
        else await push(ref(db, 'products'), pData);
        
        document.getElementById('product-modal').classList.add('hidden');
        e.target.reset();
    };

    window.editProduct = (id) => {
        get(ref(db, `products/${id}`)).then(snap => {
            const p = snap.val();
            document.getElementById('modal-title').innerText = "Edit Product";
            document.getElementById('edit-id').value = id;
            document.getElementById('p-name').value = p.name;
            document.getElementById('p-category').value = p.category;
            document.getElementById('p-price').value = p.price;
            document.getElementById('p-cost').value = p.costPrice;
            document.getElementById('p-stock').value = p.stock;
            document.getElementById('p-image').value = p.imageURL;
            document.getElementById('p-active').value = p.active;
            document.getElementById('product-modal').classList.remove('hidden');
        });
    };

    window.deleteProduct = (id) => {
        if (confirm("Are you sure you want to delete this product?")) {
            remove(ref(db, `products/${id}`));
        }
    };
                                           }
