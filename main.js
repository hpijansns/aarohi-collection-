import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, set, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// --- GLOBAL UTILS ---
const TG_BOT = "8332178525:AAHzyIN9oTEeHGLIruz1zaUvTBnyTfcBmNg";
const TG_CHAT = "-1003759800000";

window.showSec = (id) => {
    document.querySelectorAll('.admin-sec').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'block';
};

// --- PRODUCT LOGIC ---
if (document.getElementById('product-grid')) {
    onValue(ref(db, 'products'), (snap) => {
        const data = snap.val();
        let html = '';
        for (let key in data) {
            const p = data[key];
            if (!p.active) continue;
            html += `
                <div class="card">
                    ${p.stock < 5 ? '<span class="badge-low">Low Stock</span>' : ''}
                    <img src="${p.img}" alt="${p.name}">
                    <div class="card-body">
                        <h3>${p.name}</h3>
                        <p class="price">₹${p.price}</p>
                        <button class="btn btn-outline" style="width:100%" onclick="addToCart('${key}', '${p.name}', ${p.price})">Add to Cart</button>
                    </div>
                </div>`;
        }
        document.getElementById('product-grid').innerHTML = html;
    });
}

// --- CART LOGIC ---
window.addToCart = (id, name, price) => {
    let cart = JSON.parse(localStorage.getItem('aarohi_cart')) || [];
    cart.push({ id, name, price });
    localStorage.setItem('aarohi_cart', JSON.stringify(cart));
    updateCartUI();
};

function updateCartUI() {
    const cart = JSON.parse(localStorage.getItem('aarohi_cart')) || [];
    const count = document.getElementById('cart-count');
    if (count) count.innerText = cart.length;

    const summary = document.getElementById('summary-items');
    if (summary) {
        let html = '';
        let total = 0;
        cart.forEach((item, idx) => {
            html += `<div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <span>${item.name}</span>
                <span>₹${item.price} <button onclick="removeFromCart(${idx})" style="color:red; border:none; background:none; cursor:pointer;">&times;</button></span>
            </div>`;
            total += item.price;
        });
        summary.innerHTML = html;
        document.getElementById('total-amt').innerText = `₹${total}`;
        window.cartTotal = total;
    }
}

window.removeFromCart = (idx) => {
    let cart = JSON.parse(localStorage.getItem('aarohi_cart')) || [];
    cart.splice(idx, 1);
    localStorage.setItem('aarohi_cart', JSON.stringify(cart));
    updateCartUI();
};

// --- CHECKOUT LOGIC ---
const checkoutForm = document.getElementById('checkout-form');
if (checkoutForm) {
    checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cart = JSON.parse(localStorage.getItem('aarohi_cart')) || [];
        if (cart.length === 0) return alert("Cart is empty");

        const orderData = {
            orderId: "AR" + Date.now().toString().slice(-6),
            name: document.getElementById('cust-name').value,
            phone: document.getElementById('cust-phone').value,
            address: document.getElementById('cust-address').value,
            items: cart,
            amount: window.finalTotal || window.cartTotal,
            paymentMethod: document.getElementById('pay-method').value,
            status: "Pending",
            timestamp: new Date().toLocaleString()
        };

        const newOrderRef = push(ref(db, 'orders'));
        await set(newOrderRef, orderData);

        // Telegram Notify
        const msg = `🛍️ *New Order: ${orderData.orderId}*\n👤 ${orderData.name}\n📞 ${orderData.phone}\n💰 ₹${orderData.amount}\n💳 ${orderData.paymentMethod}`;
        fetch(`https://api.telegram.org/bot${TG_BOT}/sendMessage?chat_id=${TG_CHAT}&text=${encodeURIComponent(msg)}&parse_mode=Markdown`);

        localStorage.removeItem('aarohi_cart');
        alert("Order Placed Successfully!");
        location.href = 'index.html';
    });
}

// --- ADMIN LOGIC ---
if (document.getElementById('orders-list')) {
    onValue(ref(db, 'orders'), (snap) => {
        const orders = snap.val();
        const ordersList = document.getElementById('orders-list');
        ordersList.innerHTML = '';
        
        let rev = 0, profit = 0, count = 0, custs = new Set();

        for (let key in orders) {
            const o = orders[key];
            count++;
            rev += o.amount;
            custs.add(o.phone);

            ordersList.innerHTML += `
                <tr>
                    <td>${o.orderId}</td>
                    <td>${o.name}<br><small>${o.phone}</small></td>
                    <td>${o.items[0].name}...</td>
                    <td>₹${o.amount}</td>
                    <td><span class="status status-${o.status}">${o.status}</span></td>
                    <td>
                        <button onclick="updateOrderStatus('${key}', 'Shipped')" class="btn-outline">Ship</button>
                        <button onclick="updateOrderStatus('${key}', 'Delivered')" class="btn-gold">Deliver</button>
                    </td>
                </tr>`;
        }

        document.getElementById('st-orders').innerText = count;
        document.getElementById('st-rev').innerText = "₹" + rev;
        document.getElementById('st-cust').innerText = custs.size;
    });

    onValue(ref(db, 'products'), (snap) => {
        const products = snap.val();
        const adminPList = document.getElementById('products-list-admin');
        adminPList.innerHTML = '';
        for (let key in products) {
            const p = products[key];
            adminPList.innerHTML += `
                <tr>
                    <td><img src="${p.img}" width="40"></td>
                    <td>${p.name}</td>
                    <td>₹${p.price}</td>
                    <td style="color: ${p.stock < 5 ? 'red' : 'inherit'}">${p.stock}</td>
                    <td><button onclick="deleteProduct('${key}')">Del</button></td>
                </tr>`;
        }
    });
}

window.saveProduct = () => {
    const pData = {
        name: document.getElementById('p-name').value,
        price: parseInt(document.getElementById('p-price').value),
        cost: parseInt(document.getElementById('p-cost').value),
        stock: parseInt(document.getElementById('p-stock').value),
        img: document.getElementById('p-img').value,
        cat: document.getElementById('p-cat').value,
        active: true
    };
    push(ref(db, 'products'), pData);
    toggleProductForm();
};

window.deleteProduct = (key) => { if(confirm("Delete product?")) remove(ref(db, `products/${key}`)); };

window.toggleProductForm = () => {
    const box = document.getElementById('product-form-box');
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
};

window.updateOrderStatus = (key, newStatus) => {
    update(ref(db, `orders/${key}`), { status: newStatus }).then(() => {
        // WhatsApp Trigger
        onValue(ref(db, `orders/${key}`), (snap) => {
            const o = snap.val();
            let msg = "";
            if(newStatus === 'Shipped') {
                msg = `Dear ${o.name}, your order ${o.orderId} from Aarohi Collection has been shipped! Amount: ₹${o.amount}.`;
            } else if(newStatus === 'Delivered') {
                msg = `Dear ${o.name}, your order ${o.orderId} has been delivered. Hope you love it!`;
            }
            window.open(`https://wa.me/91${o.phone}?text=${encodeURIComponent(msg)}`);
        }, { onlyOnce: true });
    });
};

window.exportToCSV = () => {
    onValue(ref(db, 'orders'), (snap) => {
        const data = snap.val();
        let csv = "OrderID,Customer,Phone,Amount,Status\n";
        for(let k in data) {
            const o = data[k];
            csv += `${o.orderId},${o.name},${o.phone},${o.amount},${o.status}\n`;
        }
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'aarohi_orders.csv'; a.click();
    }, { onlyOnce: true });
};

updateCartUI();
