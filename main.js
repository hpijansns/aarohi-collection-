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

// --- UTILS ---
const formatCurrency = (val) => "₹" + (Number(val) || 0).toLocaleString('en-IN');
const getCart = () => JSON.parse(localStorage.getItem('aarohi_cart')) || [];
const updateCartUI = () => {
    const el = document.getElementById('cart-count');
    if(el) el.innerText = getCart().length;
};

// --- SHOP LOGIC ---
if (document.getElementById('product-grid')) {
    updateCartUI();
    onValue(ref(db, 'products'), (snapshot) => {
        const grid = document.getElementById('product-grid');
        grid.innerHTML = "";
        const data = snapshot.val();
        if(!data) return grid.innerHTML = "<p>Coming soon...</p>";

        Object.keys(data).forEach(id => {
            const p = data[id];
            if(p.active === "true" && (Number(p.stock) || 0) > 0) {
                grid.innerHTML += `
                    <div class="product-card">
                        ${p.stock < 5 ? '<span class="badge">LOW STOCK</span>' : ''}
                        <img src="${p.imageURL}" class="product-img">
                        <div class="product-info">
                            <h3>${p.name}</h3>
                            <p class="price">${formatCurrency(p.price)}</p>
                            <button class="btn-gold" onclick="addToBag('${id}', '${p.name}', ${p.price}, ${p.costPrice})">Add to Bag</button>
                        </div>
                    </div>
                `;
            }
        });
    });
}

window.addToBag = (id, name, price, costPrice) => {
    const cartItem = { id, name, price, costPrice };
    localStorage.setItem('aarohi_cart', JSON.stringify([cartItem])); // Single item direct checkout logic
    updateCartUI();
    window.location.href = "checkout.html";
};

// --- CHECKOUT LOGIC ---
if (document.getElementById('checkout-form')) {
    const cart = getCart();
    if(cart.length === 0) window.location.href = "index.html";

    const summaryBox = document.getElementById('checkout-item-details');
    let subtotal = 0;
    cart.forEach(item => {
        subtotal += Number(item.price);
        summaryBox.innerHTML += `<div class="flex-between" style="margin-bottom:10px"><span>${item.name}</span><span>${formatCurrency(item.price)}</span></div>`;
    });
    document.getElementById('final-total').innerText = formatCurrency(subtotal);

    document.getElementById('checkout-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.innerText = "Processing...";

        const orderId = "AR" + Math.floor(1000 + Math.random() * 9000);
        const name = document.getElementById('cust-name').value;
        const phone = document.getElementById('cust-phone').value;
        const address = document.getElementById('cust-address').value;
        const method = document.getElementById('payment-method').value;

        const orderData = {
            orderId, name, phone, address,
            productName: cart[0].name,
            productId: cart[0].id,
            amount: subtotal,
            costPrice: cart[0].costPrice || 0,
            paymentMethod: method,
            status: "Pending",
            timestamp: new Date().toISOString()
        };

        try {
            // Save order
            await push(ref(db, 'orders'), orderData);
            
            // Reduce stock
            const pRef = ref(db, `products/${cart[0].id}`);
            const pSnap = await get(pRef);
            if(pSnap.exists()) {
                const currentStock = Number(pSnap.val().stock) || 0;
                await update(pRef, { stock: Math.max(0, currentStock - 1) });
            }

            // Telegram Notification
            const msg = `🛍️ *New Order - Aarohi Collection*%0A%0A🆔 *Order ID:* ${orderId}%0A👤 *Name:* ${name}%0A📞 *Phone:* ${phone}%0A📍 *Address:* ${address}%0A👗 *Product:* ${cart[0].name}%0A💰 *Amount:* ${formatCurrency(subtotal)}%0A💳 *Payment:* ${method}%0A📦 *Status:* Pending%0A🕒 *Date:* ${new Date().toLocaleString()}`;
            
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${msg}&parse_mode=Markdown`);

            localStorage.removeItem('aarohi_cart');
            alert("Luxury Order Placed Successfully!");
            window.location.href = "index.html";

        } catch (err) {
            console.error(err);
            btn.disabled = false;
            btn.innerText = "Retry Order";
        }
    });
}

// --- LOGIN ---
if (document.getElementById('login-form')) {
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const em = document.getElementById('email').value;
        const ps = document.getElementById('password').value;
        signInWithEmailAndPassword(auth, em, ps)
            .then(() => window.location.href = "admin.html")
            .catch(() => document.getElementById('login-err').innerText = "Access Denied. Check Credentials.");
    });
}

// --- ADMIN CONTROL ---
if (window.location.pathname.includes('admin.html')) {
    onAuthStateChanged(auth, (user) => {
        if (!user || user.email !== "mohitrajpura9@gmail.com") window.location.href = "login.html";
    });

    document.getElementById('logout-btn').addEventListener('click', () => signOut(auth).then(() => window.location.href = "login.html"));

    // Business Intelligence (DASHBOARD)
    onValue(ref(db, 'orders'), (snapshot) => {
        const data = snapshot.val() || {};
        const kpis = { total: 0, pending: 0, shipped: 0, delivered: 0, cancelled: 0, revenue: 0, profit: 0 };
        const tbody = document.getElementById('orders-tbody');
        tbody.innerHTML = "";

        Object.keys(data).reverse().forEach(key => {
            const o = data[key];
            kpis.total++;
            kpis[o.status.toLowerCase()] = (kpis[o.status.toLowerCase()] || 0) + 1;
            kpis.revenue += (Number(o.amount) || 0);
            kpis.profit += (Number(o.amount) || 0) - (Number(o.costPrice) || 0);

            tbody.innerHTML += `
                <tr>
                    <td>${o.orderId}</td>
                    <td>${o.name}<br><small>${o.phone}</small></td>
                    <td>${o.productName}</td>
                    <td>${formatCurrency(o.amount)}</td>
                    <td><span class="status-pill status-${o.status.toLowerCase()}">${o.status}</span></td>
                    <td>${new Date(o.timestamp).toLocaleDateString()}</td>
                    <td>
                        <select onchange="window.updateOrderStatus('${key}', this.value, '${o.phone}', '${o.name}', '${o.productName}', '${o.amount}', '${o.paymentMethod}')">
                            <option value="">Update</option>
                            <option value="Shipped">Shipped</option>
                            <option value="Delivered">Delivered</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                    </td>
                </tr>
            `;
        });

        document.getElementById('kpi-container').innerHTML = `
            <div class="kpi-card"><h4>Total Orders</h4><p>${kpis.total}</p></div>
            <div class="kpi-card"><h4>Pending</h4><p>${kpis.pending}</p></div>
            <div class="kpi-card"><h4>Shipped</h4><p>${kpis.shipped}</p></div>
            <div class="kpi-card"><h4>Delivered</h4><p>${kpis.delivered}</p></div>
            <div class="kpi-card"><h4>Total Revenue</h4><p>${formatCurrency(kpis.revenue)}</p></div>
            <div class="kpi-card"><h4>Est. Profit</h4><p>${formatCurrency(kpis.profit)}</p></div>
        `;
    });

    // Order Update System
    window.updateOrderStatus = async (key, status, phone, name, prod, amt, method) => {
        if(!status) return;
        await update(ref(db, `orders/${key}`), { status });
        
        let msg = "";
        if(status === "Shipped") {
            msg = `Dear ${name}, Your order from Aarohi Collection has been Shipped!%0A%0AProduct: ${prod}%0AAmount: ₹${amt}%0APayment: ${method}%0A%0A– Team Aarohi Collection`;
        } else if (status === "Delivered") {
            msg = `Dear ${name}, Your order from Aarohi Collection was delivered successfully! We hope you love it! – Team Aarohi Collection`;
        }

        if(msg) {
            const waUrl = `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`;
            window.open(waUrl, '_blank');
        }
    };

    // Inventory System (CRUD)
    onValue(ref(db, 'products'), (snapshot) => {
        const tbody = document.getElementById('inventory-tbody');
        tbody.innerHTML = "";
        const data = snapshot.val() || {};

        Object.keys(data).forEach(key => {
            const p = data[key];
            tbody.innerHTML += `
                <tr>
                    <td><img src="${p.imageURL}" width="40" height="40" style="object-fit:cover; border-radius:4px;"></td>
                    <td>${p.name}</td>
                    <td style="color:${p.stock < 5 ? 'red' : 'inherit'}">${p.stock}</td>
                    <td>${formatCurrency(p.price)}</td>
                    <td>${p.active === 'true' ? 'Active' : 'Hidden'}</td>
                    <td>
                        <button onclick="window.editProduct('${key}')" style="color:blue; background:none; border:none; cursor:pointer;">Edit</button> | 
                        <button onclick="window.deleteProduct('${key}')" style="color:red; background:none; border:none; cursor:pointer;">Delete</button>
                    </td>
                </tr>
            `;
        });
    });

    document.getElementById('product-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-id').value;
        const payload = {
            name: document.getElementById('p-name').value,
            category: document.getElementById('p-cat').value,
            price: Number(document.getElementById('p-price').value),
            costPrice: Number(document.getElementById('p-cost').value),
            stock: Number(document.getElementById('p-stock').value),
            imageURL: document.getElementById('p-img').value,
            active: document.getElementById('p-active').value
        };

        if(id) {
            await update(ref(db, `products/${id}`), payload);
            alert("Product Updated");
        } else {
            await push(ref(db, 'products'), payload);
            alert("Product Added");
        }
        window.toggleProductForm();
    });

    window.editProduct = (id) => {
        get(ref(db, `products/${id}`)).then(snap => {
            const p = snap.val();
            document.getElementById('edit-id').value = id;
            document.getElementById('p-name').value = p.name;
            document.getElementById('p-cat').value = p.category;
            document.getElementById('p-price').value = p.price;
            document.getElementById('p-cost').value = p.costPrice;
            document.getElementById('p-stock').value = p.stock;
            document.getElementById('p-img').value = p.imageURL;
            document.getElementById('p-active').value = p.active;
            
            document.getElementById('form-title').innerText = "Edit Luxury Product";
            document.getElementById('product-form-container').classList.remove('hidden');
        });
    };

    window.deleteProduct = (id) => {
        if(confirm("Confirm deletion of this luxury item?")) remove(ref(db, `products/${id}`));
    };
                }
