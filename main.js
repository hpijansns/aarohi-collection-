import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, set, onValue, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// --- CART LOGIC ---
window.addToCart = (name, price) => {
    const cart = { name, price };
    localStorage.setItem('aarohi_cart', JSON.stringify(cart));
    alert(`${name} added to cart!`);
    updateCartUI();
};

function updateCartUI() {
    const cart = JSON.parse(localStorage.getItem('aarohi_cart'));
    const badge = document.getElementById('cart-count');
    if (badge) badge.innerText = cart ? "1" : "0";

    const summary = document.getElementById('cart-summary');
    if (summary && cart) {
        summary.innerHTML = `<strong>Item:</strong> ${cart.name} <br> <strong>Total:</strong> ₹${cart.price}`;
    } else if (summary) {
        summary.innerHTML = "Cart is empty.";
    }
}

// --- ORDER SUBMISSION ---
const orderForm = document.getElementById('orderForm');
if (orderForm) {
    orderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cart = JSON.parse(localStorage.getItem('aarohi_cart'));
        if (!cart) return alert("Cart is empty!");

        const orderData = {
            name: document.getElementById('name').value,
            phone: document.getElementById('phone').value,
            address: document.getElementById('address').value,
            product: cart.name,
            amount: cart.price,
            paymentMethod: document.getElementById('paymentMethod').value,
            status: "Pending",
            timestamp: new Date().toISOString()
        };

        try {
            const ordersRef = ref(db, 'orders');
            const newOrderRef = push(ordersRef);
            await set(newOrderRef, orderData);

            await sendTelegram(orderData);
            
            localStorage.removeItem('aarohi_cart');
            alert("Order placed successfully!");
            window.location.href = "index.html";
        } catch (err) {
            console.error(err);
            alert("Error placing order.");
        }
    });
}

// --- TELEGRAM NOTIFICATION ---
async function sendTelegram(order) {
    const BOT_TOKEN = "8332178525:AAHzyIN9oTEeHGLIruz1zaUvTBnyTfcBmNg";
    const CHAT_ID = "-1003759800000";
    const text = `🛍️ New Order - Aarohi Collection\n👤 Name: ${order.name}\n📞 Phone: ${order.phone}\n📍 Address: ${order.address}\n👗 Product: ${order.product}\n💰 Amount: ₹${order.amount}\n💳 Payment: ${order.paymentMethod}\n📦 Status: Pending`;
    
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text: text })
    });
}

// --- ADMIN DASHBOARD ---
const orderList = document.getElementById('order-list');
if (orderList) {
    onValue(ref(db, 'orders'), (snapshot) => {
        const data = snapshot.val();
        orderList.innerHTML = "";
        let totalRev = 0, codRev = 0, upiRev = 0, preRev = 0, count = 0;

        for (let id in data) {
            const o = data[id];
            count++;
            totalRev += o.amount;
            if (o.paymentMethod === 'COD') codRev += o.amount;
            if (o.paymentMethod === 'UPI') upiRev += o.amount;
            if (o.paymentMethod === 'Prepaid') preRev += o.amount;

            orderList.innerHTML += `
                <tr>
                    <td>${o.name}<br><small>${o.phone}</small></td>
                    <td>${o.product}</td>
                    <td>₹${o.amount}</td>
                    <td>${o.paymentMethod}</td>
                    <td><span class="status-badge ${o.status}">${o.status}</span></td>
                    <td>
                        <button onclick="updateStatus('${id}', 'Shipped')">Ship</button>
                        <button onclick="updateStatus('${id}', 'Delivered')">Deliver</button>
                    </td>
                </tr>
            `;
        }
        document.getElementById('stat-orders').innerText = count;
        document.getElementById('stat-revenue').innerText = "₹" + totalRev;
        document.getElementById('stat-cod').innerText = "₹" + codRev;
        document.getElementById('stat-upi').innerText = "₹" + upiRev;
        document.getElementById('stat-prepaid').innerText = "₹" + preRev;
    });
}

// --- WHATSAPP & STATUS UPDATE ---
window.updateStatus = async (id, newStatus) => {
    const orderRef = ref(db, `orders/${id}`);
    
    // Fetch order first to get details for WhatsApp
    onValue(orderRef, async (snapshot) => {
        const o = snapshot.val();
        if (!o || o.status === newStatus) return;

        await update(orderRef, { status: newStatus });

        let msg = "";
        if (newStatus === 'Shipped') {
            msg = `Dear ${o.name},\n\nWe are pleased to inform you that your order from Aarohi Collection has been successfully shipped.\n\nOrder Details:\nProduct: ${o.product}\nAmount: ₹${o.amount}\nPayment Mode: ${o.paymentMethod}\n\nYour parcel is on its way.\n\nThank you for choosing Aarohi Collection.`;
        } else {
            msg = `Dear ${o.name},\n\nYour order from Aarohi Collection has been successfully delivered.\n\nWe hope you love your purchase.\n\nThank you for shopping with us.\n\n– Team Aarohi Collection`;
        }

        const waLink = `https://wa.me/91${o.phone}?text=${encodeURIComponent(msg)}`;
        window.open(waLink, '_blank');
    }, { onlyOnce: true });
};

// Init UI
updateCartUI();
