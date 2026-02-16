import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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
const auth = getAuth(app);
const db = getDatabase(app);

/* ================= AUTH PROTECTION ================= */

const adminRoot = document.getElementById("admin-root");

onAuthStateChanged(auth, (user) => {
    if (window.location.pathname.includes("admin.html")) {
        if (!user || user.email !== "mohitrajpura9@gmail.com") {
            window.location.href = "login.html";
        } else {
            if (adminRoot) adminRoot.style.display = "flex";
        }
    }
});

/* ================= LOGIN ================= */

const loginBtn = document.getElementById("login-btn");
if (loginBtn) {
    loginBtn.onclick = () => {
        const email = document.getElementById("login-email").value;
        const pass = document.getElementById("login-pass").value;
        signInWithEmailAndPassword(auth, email, pass)
            .then(() => window.location.href = "admin.html")
            .catch(() => document.getElementById("err").innerText = "Invalid Credentials");
    };
}

const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
    logoutBtn.onclick = () => {
        signOut(auth).then(() => window.location.href = "login.html");
    };
}

/* ================= TELEGRAM ================= */

function sendTelegram(o) {
    const token = "8332178525:AAHzyIN9oTEeHGLIruz1zaUvTBnyTfcBmNg";
    const chat = "-1003759800000";

    const text = `
🛍️ New Order - Aarohi Collection

👤 Name: ${o.name}
📞 Phone: ${o.phone}
📍 Address: ${o.address}
👗 Product: ${o.productName}
💰 Amount: ₹${o.amount}
💳 Payment: ${o.paymentMethod}
📦 Status: ${o.status}
🕒 Date: ${o.timestamp}
`;

    fetch(`https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat}&text=${encodeURIComponent(text)}`);
}

/* ================= ORDER LISTENER ================= */

if (document.getElementById("orders-tbody")) {
    onValue(ref(db, "orders"), (snapshot) => {
        const orders = [];
        snapshot.forEach(child => {
            orders.push({ id: child.key, ...child.val() });
        });

        renderDashboard(orders);
        renderOrders(orders);
    });
}

/* ================= DASHBOARD ================= */

function renderDashboard(orders) {
    let totalRevenue = 0;
    let totalProfit = 0;
    let pendingCount = 0;
    const customers = new Set();

    orders.forEach(o => {
        const amount = Number(o.amount) || 0;
        const cost = Number(o.costPrice) || 0;

        totalRevenue += amount;
        totalProfit += (amount - cost);

        if (o.status === "Pending") pendingCount++;
        if (o.phone) customers.add(o.phone);
    });

    safeSet("m-total-orders", orders.length);
    safeSet("m-pending", pendingCount);
    safeSet("m-profit", "₹" + totalProfit);
    safeSet("m-aov", "₹" + Math.round(totalRevenue / (orders.length || 1)));
    safeSet("m-cust", customers.size);
}

function safeSet(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

/* ================= ORDER TABLE ================= */

function renderOrders(orders) {
    const tbody = document.getElementById("orders-tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    orders.reverse().forEach(o => {
        tbody.innerHTML += `
        <tr>
            <td>${o.orderId || "-"}</td>
            <td>${o.name}</td>
            <td>${o.productName}</td>
            <td>₹${o.amount}</td>
            <td>${o.paymentMethod}</td>
            <td>${o.status}</td>
            <td>
                <button onclick="updateOrderStatus('${o.id}', 'Shipped')">Ship</button>
                <button onclick="updateOrderStatus('${o.id}', 'Delivered')">Deliver</button>
            </td>
        </tr>
        `;
    });
}

window.updateOrderStatus = function(id, status) {
    update(ref(db, "orders/" + id), { status });
};

/* ================= CHECKOUT ================= */

const orderForm = document.getElementById("place-order-form");

if (orderForm) {
    orderForm.onsubmit = async (e) => {
        e.preventDefault();

        const order = {
            orderId: "AR" + Math.floor(Math.random() * 10000),
            name: document.getElementById("cust-name").value,
            phone: document.getElementById("cust-phone").value,
            address: document.getElementById("cust-address").value,
            productName: "Demo Product",
            amount: 1000,
            costPrice: 600,
            paymentMethod: document.getElementById("cust-pay").value,
            status: "Pending",
            timestamp: new Date().toLocaleString()
        };

        await set(push(ref(db, "orders")), order);
        sendTelegram(order);

        alert("Order Placed Successfully");
        window.location.href = "index.html";
    };
}
