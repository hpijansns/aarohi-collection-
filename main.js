import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, push, onValue, get, update, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- FIREBASE CONFIG ---
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

// --- UTILITIES ---
const BOT_TOKEN = "8332178525:AAHzyIN9oTEeHGLIruz1zaUvTBnyTfcBmNg";
const CHAT_ID = "-1003759800000";

const getCart = () => JSON.parse(localStorage.getItem('aarohi_cart')) || [];
const saveCart = (cart) => {
    localStorage.setItem('aarohi_cart', JSON.stringify(cart));
    const counter = document.getElementById('cart-count');
    if (counter) counter.innerText = cart.length;
};

// --- FRONTEND LOGIC ---
if (document.getElementById('product-grid')) {
    saveCart(getCart());
    onValue(ref(db, 'products'), (snapshot) => {
        const grid = document.getElementById('product-grid');
        grid.innerHTML = '';
        const data = snapshot.val();
        if (!data) return grid.innerHTML = 'No products found.';
        
        Object.keys(data).forEach(id => {
            const p = data[id];
            if (p.active && p.stock > 0) {
                const card = document.createElement('div');
                card.className = 'p-card';
                card.innerHTML = `
                    <div style="position:relative">
                        ${p.stock < 5 ? '<span class="badge">Low Stock</span>' : ''}
                        <img src="${p.imageURL}" class="p-img">
                    </div>
                    <div class="p-info">
                        <h3>${p.name}</h3>
                        <p class="p-price">₹${p.price}</p>
                        <button class="btn-gold w-100 buy-btn" data-id="${id}" data-name="${p.name}" data-price="${p.price}" data-cost="${p.costPrice}">Add to Bag</button>
                    </div>
                `;
                grid.appendChild(card);
            }
        });
    });

    document.addEventListener('click', e => {
        if (e.target.classList.contains('buy-btn')) {
            const cart = getCart();
            cart.push({...e.target.dataset});
            saveCart(cart);
            alert('Added to collection!');
        }
    });
}

// --- CHECKOUT LOGIC ---
if (document.getElementById('checkout-form')) {
    const cart = getCart();
    const itemsList = document.getElementById('checkout-items');
    let total = 0;
    
    cart.forEach(item => {
        total += Number(item.price);
        itemsList.innerHTML += `<div class="flex-between"><p>${item.name}</p><p>₹${item.price}</p></div>`;
    });
    document.getElementById('checkout-total').innerText = '₹' + total;

    document.getElementById('checkout-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('place-order-btn');
        btn.disabled = true;
        btn.innerText = "Processing...";

        const orderId = 'AR' + Math.floor(1000 + Math.random() * 9000);
        const name = document.getElementById('cust-name').value;
        const phone = document.getElementById('cust-phone').value;
        const address = document.getElementById('cust-address').value;
        const pay = document.querySelector('input[name="payment"]:checked').value;

        const orderData = {
            orderId, name, phone, address, 
            productName: cart.map(i => i.name).join(', '),
            productId: cart.map(i => i.id).join(', '),
            amount: total,
            costPrice: cart.reduce((acc, i) => acc + Number(i.cost), 0),
            paymentMethod: pay,
            status: "Pending",
            timestamp: new Date().toISOString()
        };

        try {
            // Push order
            await push(ref(db, 'orders'), orderData);
            
            // Reduce Stock
            for(let item of cart) {
                const pRef = ref(db, `products/${item.id}/stock`);
                const snap = await get(pRef);
                const curStock = snap.val() || 0;
                await set(pRef, curStock - 1);
            }

            // Telegram
            const text = `🛍️ *New Order - Aarohi Collection*%0A%0A*Name:* ${name}%0A*Phone:* ${phone}%0A*Address:* ${address}%0A*Product:* ${orderData.productName}%0A*Amount:* ₹${total}%0A*Payment:* ${pay}%0A*Status:* Pending%0A*Date:* ${new Date().toLocaleDateString()}`;
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${text}&parse_mode=Markdown`);

            alert('Order Placed Successfully!');
            localStorage.removeItem('aarohi_cart');
            window.location.href = 'index.html';
        } catch (err) {
            alert('Error: ' + err.message);
            btn.disabled = false;
        }
    });
}

// --- ADMIN AUTH LOGIC ---
if (document.getElementById('login-form')) {
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value)
            .then(() => window.location.href = 'admin.html')
            .catch(err => document.getElementById('login-error').innerText = err.message);
    });
}

// --- ADMIN PANEL LOGIC ---
if (window.location.pathname.includes('admin.html')) {
    onAuthStateChanged(auth, (user) => {
        if (!user || user.email !== 'mohitrajpura9@gmail.com') window.location.href = 'login.html';
    });

    document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

    // KPI and Orders Table
    onValue(ref(db, 'orders'), (snapshot) => {
        const orders = snapshot.val() || {};
        const tbody = document.getElementById('orders-tbody');
        tbody.innerHTML = '';
        
        let stats = { total: 0, pending: 0, revenue: 0, profit: 0, lowStock: 0 };

        Object.keys(orders).reverse().forEach(id => {
            const o = orders[id];
            stats.total++;
            if (o.status === 'Pending') stats.pending++;
            stats.revenue += Number(o.amount);
            stats.profit += (Number(o.amount) - Number(o.costPrice));

            const hours = Math.floor((new Date() - new Date(o.timestamp)) / 3600000);
            const agingClass = (o.status === 'Pending' && hours > 24) ? 'aging-red' : '';

            tbody.innerHTML += `
                <tr class="${agingClass}">
                    <td>${o.orderId}</td>
                    <td>${o.name}<br><small>${o.phone}</small></td>
                    <td>${o.productName}</td>
                    <td>₹${o.amount}</td>
                    <td><b>${o.status}</b></td>
                    <td>${hours}h</td>
                    <td>
                        <button onclick="updateOrder('${id}', 'Shipped', '${o.phone}', '${o.name}')">Ship</button>
                        <button onclick="updateOrder('${id}', 'Delivered', '${o.phone}', '${o.name}')">Deliv</button>
                    </td>
                </tr>
            `;
        });

        document.getElementById('kpi-container').innerHTML = `
            <div class="kpi-card"><p>Total Orders</p><h3>${stats.total}</h3></div>
            <div class="kpi-card"><p>Pending</p><h3>${stats.pending}</h3></div>
            <div class="kpi-card"><p>Revenue</p><h3>₹${stats.revenue}</h3></div>
            <div class="kpi-card"><p>Profit</p><h3>₹${stats.profit}</h3></div>
        `;
    });

    // Product Management
    const prodFormCont = document.getElementById('product-form-container');
    document.getElementById('open-add-prod').onclick = () => prodFormCont.classList.toggle('hidden');

    document.getElementById('product-form').onsubmit = async (e) => {
        e.preventDefault();
        const pData = {
            name: document.getElementById('prod-name').value,
            category: document.getElementById('prod-category').value,
            price: Number(document.getElementById('prod-price').value),
            costPrice: Number(document.getElementById('prod-cost').value),
            stock: Number(document.getElementById('prod-stock').value),
            imageURL: document.getElementById('prod-img').value,
            active: document.getElementById('prod-active').checked,
            createdAt: new Date().toISOString()
        };
        await push(ref(db, 'products'), pData);
        alert('Product Added');
        prodFormCont.classList.add('hidden');
    };

    onValue(ref(db, 'products'), (snapshot) => {
        const products = snapshot.val() || {};
        const tbody = document.getElementById('products-tbody');
        tbody.innerHTML = '';
        Object.keys(products).forEach(id => {
            const p = products[id];
            tbody.innerHTML += `
                <tr>
                    <td><img src="${p.imageURL}" width="40"></td>
                    <td>${p.name}</td>
                    <td style="${p.stock < 5 ? 'color:red; font-weight:bold;' : ''}">${p.stock}</td>
                    <td>₹${p.price}</td>
                    <td>${p.active ? 'Active' : 'Hidden'}</td>
                    <td><button onclick="deleteProd('${id}')">Delete</button></td>
                </tr>
            `;
        });
    });
}

// Global window functions for admin actions
window.updateOrder = (id, status, phone, name) => {
    update(ref(db, `orders/${id}`), { status }).then(() => {
        const msg = status === 'Shipped' ? 
            `Dear ${name}, your order from Aarohi Collection has been Shipped!` : 
            `Dear ${name}, your order has been Delivered. We hope you love it!`;
        window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`);
    });
};

window.deleteProd = (id) => {
    if(confirm('Delete product?')) remove(ref(db, `products/${id}`));
};
