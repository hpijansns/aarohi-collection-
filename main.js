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

// --- GLOBAL UTILS ---
const formatINR = (num) => "₹" + (Number(num) || 0).toLocaleString('en-IN');
const getBag = () => JSON.parse(localStorage.getItem('aarohi_bag')) || null;
const saveBag = (item) => localStorage.setItem('aarohi_bag', JSON.stringify(item));
const clearBag = () => localStorage.removeItem('aarohi_bag');

const updateBadge = () => {
    const badge = document.getElementById('cart-count');
    if (badge) badge.innerText = getBag() ? "1" : "0";
};

// --- FRONTEND: SHOP LOGIC ---
if (document.getElementById('product-grid')) {
    updateBadge();
    onValue(ref(db, 'products'), (snapshot) => {
        const grid = document.getElementById('product-grid');
        grid.innerHTML = '';
        const data = snapshot.val();
        if (!data) return grid.innerHTML = "<p>No products available.</p>";

        Object.keys(data).forEach(id => {
            const p = data[id];
            if (p.active === "true" || p.active === true) {
                const isOut = Number(p.stock) <= 0;
                grid.innerHTML += `
                    <div class="p-card">
                        ${isOut ? '<span class="badge">Out of Stock</span>' : ''}
                        <img src="${p.imageURL}" class="p-img" alt="${p.name}">
                        <div class="p-info">
                            <h3>${p.name}</h3>
                            <p class="p-price">${formatINR(p.price)}</p>
                            <button class="btn-gold" ${isOut ? 'disabled' : ''} onclick="addToBag('${id}', '${p.name}', ${p.price}, '${p.imageURL}', ${p.stock}, ${p.costPrice})">
                                ${isOut ? 'Sold Out' : 'Buy Now'}
                            </button>
                        </div>
                    </div>
                `;
            }
        });
    });
}

window.addToBag = (id, name, price, img, stock, costPrice) => {
    const bagItem = { id, name, price, img, stock, costPrice, qty: 1 };
    saveBag(bagItem);
    window.location.href = "checkout.html";
};

// --- FRONTEND: CHECKOUT LOGIC ---
if (document.getElementById('cart-item-list')) {
    const renderCheckout = () => {
        const item = getBag();
        const container = document.getElementById('cart-item-list');
        if (!item) {
            window.location.href = "index.html";
            return;
        }

        container.innerHTML = `
            <div class="checkout-item">
                <img src="${item.img}" class="checkout-item-img">
                <div class="checkout-item-details">
                    <h3>${item.name}</h3>
                    <p style="color:var(--gold); font-weight:600;">${formatINR(item.price)}</p>
                    <div class="qty-controls">
                        <button class="qty-btn" onclick="updateQty(-1)">-</button>
                        <span style="font-weight:600;">${item.qty}</span>
                        <button class="qty-btn" onclick="updateQty(1)">+</button>
                    </div>
                </div>
                <button class="remove-prod" onclick="removeItem()"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        document.getElementById('grand-total').innerText = formatINR(item.qty * item.price);
    };

    window.updateQty = (change) => {
        const item = getBag();
        const newQty = item.qty + change;
        if (newQty < 1) return;
        if (newQty > item.stock) {
            alert("Sorry, only " + item.stock + " pieces available.");
            return;
        }
        item.qty = newQty;
        saveBag(item);
        renderCheckout();
    };

    window.removeItem = () => {
        clearBag();
        window.location.href = "index.html";
    };

    renderCheckout();

    document.getElementById('order-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const item = getBag();
        const btn = document.getElementById('place-order-btn');
        btn.disabled = true;
        btn.innerText = "Processing Order...";

        const orderId = "AR" + Math.floor(1000 + Math.random() * 9000);
        const name = document.getElementById('cust-name').value;
        const phone = document.getElementById('cust-phone').value;
        const address = document.getElementById('cust-address').value;
        const method = document.getElementById('payment-method').value;

        const orderData = {
            orderId, name, phone, address,
            productName: item.name,
            productId: item.id,
            qty: item.qty,
            amount: item.qty * item.price,
            costPrice: item.costPrice || 0,
            paymentMethod: method,
            status: "Pending",
            timestamp: new Date().toISOString()
        };

        try {
            await push(ref(db, 'orders'), orderData);
            
            // Reduce stock
            const pRef = ref(db, `products/${item.id}`);
            const pSnap = await get(pRef);
            if(pSnap.exists()){
                const currentStock = Number(pSnap.val().stock) || 0;
                await update(pRef, { stock: Math.max(0, currentStock - item.qty) });
            }

            // Telegram
            const BOT_TOKEN = "8332178525:AAHzyIN9oTEeHGLIruz1zaUvTBnyTfcBmNg";
            const CHAT_ID = "-1003759800000";
            const message = encodeURIComponent(`🛍️ *New Order - Aarohi Collection*\n\n🆔 *Order ID:* ${orderId}\n👤 *Name:* ${name}\n📞 *Phone:* ${phone}\n📍 *Address:* ${address}\n👗 *Product:* ${item.name} (x${item.qty})\n💰 *Amount:* ₹${orderData.amount}\n💳 *Payment:* ${method}\n📦 *Status:* Pending`);
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${message}&parse_mode=Markdown`);

            clearBag();
            document.getElementById('display-order-id').innerText = orderId;
            document.getElementById('success-overlay').classList.remove('hidden');
        } catch (error) {
            alert("Error: " + error.message);
            btn.disabled = false;
        }
    });
}

// --- ADMIN: LOGIN ---
if (document.getElementById('login-form')) {
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const em = document.getElementById('admin-email').value;
        const ps = document.getElementById('admin-pass').value;
        signInWithEmailAndPassword(auth, em, ps)
            .then(() => window.location.href = "admin.html")
            .catch(() => document.getElementById('login-error').innerText = "Access Denied.");
    });
}

// --- ADMIN: LOGIC ---
if (window.location.pathname.includes('admin.html')) {
    onAuthStateChanged(auth, (user) => {
        if (!user || user.email !== 'mohitrajpura9@gmail.com') window.location.href = 'login.html';
    });

    document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

    // KPI and Orders Table
    onValue(ref(db, 'orders'), (snapshot) => {
        const data = snapshot.val() || {};
        const kpis = { total: 0, pending: 0, revenue
