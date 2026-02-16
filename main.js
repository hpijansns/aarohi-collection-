import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, get, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// --- GLOBAL UTILITIES ---
const formatCurrency = (val) => `₹${(Number(val) || 0).toLocaleString('en-IN')}`;
const getCart = () => JSON.parse(localStorage.getItem('aarohi_cart')) || null;
const saveCart = (item) => localStorage.setItem('aarohi_cart', JSON.stringify(item));

// --- SHOP LOGIC ---
if (document.getElementById('product-grid')) {
    const grid = document.getElementById('product-grid');
    onValue(ref(db, 'products'), (snapshot) => {
        grid.innerHTML = "";
        const data = snapshot.val();
        if (!data) return;

        Object.keys(data).forEach(id => {
            const p = data[id];
            if (p.active === "true" || p.active === true) {
                const isOutOfStock = (Number(p.stock) || 0) <= 0;
                grid.innerHTML += `
                    <div class="product-card" style="position:relative; border: 1px solid #eee; transition: 0.3s;">
                        ${isOutOfStock ? `<span class="stock-badge out-of-stock">Out of Stock</span>` : p.stock < 5 ? `<span class="stock-badge low-stock">Only ${p.stock} Left</span>` : ''}
                        <img src="${p.imageURL}" style="width:100%; height:350px; object-fit:cover; opacity: ${isOutOfStock ? '0.5' : '1'}">
                        <div style="padding:15px; text-align:center;">
                            <h3>${p.name}</h3>
                            <p style="color:var(--gold); font-weight:bold; margin: 10px 0;">${formatCurrency(p.price)}</p>
                            <button class="btn-premium" ${isOutOfStock ? 'disabled' : ''} onclick="buyNow('${id}', '${p.name}', ${p.price}, '${p.imageURL}', ${p.stock}, ${p.costPrice})">
                                ${isOutOfStock ? 'Sold Out' : 'Buy Now'}
                            </button>
                        </div>
                    </div>
                `;
            }
        });
    });
}

window.buyNow = (id, name, price, img, stock, costPrice) => {
    saveCart({ id, name, price, img, stock, costPrice, qty: 1 });
    window.location.href = "checkout.html";
};

// --- CHECKOUT LOGIC ---
if (document.getElementById('order-form')) {
    const cartContainer = document.getElementById('cart-items-container');
    
    const renderCheckout = () => {
        const item = getCart();
        if (!item) { window.location.href = "index.html"; return; }

        cartContainer.innerHTML = `
            <div class="product-summary-row">
                <img src="${item.img}" class="summary-img">
                <div style="flex:1">
                    <h4 class="luxury-text">${item.name}</h4>
                    <p style="color:var(--gold); font-weight:600; margin-top:5px;">${formatCurrency(item.price)}</p>
                    <div class="qty-box">
                        <button class="qty-btn" onclick="updateQty(-1)">-</button>
                        <span style="font-weight:bold;">${item.qty}</span>
                        <button class="qty-btn" onclick="updateQty(1)">+</button>
                    </div>
                </div>
                <button class="remove-btn" onclick="removeItem()"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;

        const total = item.qty * item.price;
        document.getElementById('subtotal').innerText = formatCurrency(total);
        document.getElementById('grand-total').innerText = formatCurrency(total);
    };

    window.updateQty = (change) => {
        const item = getCart();
        const newQty = item.qty + change;
        if (newQty < 1) return;
        if (newQty > item.stock) { alert("Maximum available stock reached"); return; }
        item.qty = newQty;
        saveCart(item);
        renderCheckout();
    };

    window.removeItem = () => {
        localStorage.removeItem('aarohi_cart');
        window.location.href = "index.html";
    };

    renderCheckout();

    // --- PLACE ORDER LOGIC ---
    document.getElementById('order-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const item = getCart();
        const btn = document.getElementById('place-order-btn');
        
        btn.disabled = true;
        btn.innerText = "Processing Luxury Order...";

        const orderId = "AR" + Date.now().toString().slice(-6).toUpperCase();
        const orderData = {
            orderId,
            name: document.getElementById('cust-name').value,
            phone: document.getElementById('cust-phone').value,
            address: document.getElementById('cust-address').value,
            paymentMethod: document.getElementById('payment-method').value,
            productName: item.name,
            productId: item.id,
            qty: item.qty,
            amount: item.qty * item.price,
            costPrice: item.costPrice || 0,
            status: "Pending",
            timestamp: new Date().toLocaleString('en-IN', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })
        };

        try {
            // 1. Save Order to Database
            await push(ref(db, 'orders'), orderData);

            // 2. Reduce Stock in Database
            const productRef = ref(db, `products/${item.id}`);
            const currentStock = (Number(item.stock) || 0) - item.qty;
            await update(productRef, { stock: Math.max(0, currentStock) });

            // 3. Telegram Notification
            const BOT_TOKEN = "8332178525:AAHzyIN9oTEeHGLIruz1zaUvTBnyTfcBmNg";
            const CHAT_ID = "-1003759800000";
            const message = `🛍️ *New Order - Aarohi Collection*%0A%0A🆔 *Order ID:* ${orderId}%0A👤 *Name:* ${orderData.name}%0A📞 *Phone:* ${orderData.phone}%0A📍 *Address:* ${orderData.address}%0A👗 *Product:* ${orderData.productName}%0A🔢 *Qty:* ${orderData.qty}%0A💰 *Amount:* ₹${orderData.amount}%0A💳 *Payment:* ${orderData.paymentMethod}%0A📦 *Status:* Pending%0A🕒 *Date:* ${orderData.timestamp}`;
            
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${message}&parse_mode=Markdown`);

            // 4. Success UX
            localStorage.removeItem('aarohi_cart');
            document.getElementById('display-order-id').innerText = orderId;
            document.getElementById('success-overlay').style.display = 'flex';
            window.scrollTo(0,0);

        } catch (error) {
            console.error(error);
            alert("Connection error. Please try again.");
            btn.disabled = false;
            btn.innerText = "Place Order";
        }
    });
}
