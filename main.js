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

// --- AUTH PROTECTION ---
const adminBody = document.getElementById('admin-body');
if (window.location.pathname.includes('admin.html')) {
    onAuthStateChanged(auth, (user) => {
        if (!user || user.email !== "mohitrajpura9@gmail.com") {
            window.location.href = 'login.html';
        } else {
            if(adminBody) adminBody.style.display = 'flex';
        }
    });
}

// --- LOGIN LOGIC ---
const loginBtn = document.getElementById('btn-login');
if (loginBtn) {
    loginBtn.onclick = () => {
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-pass').value;
        signInWithEmailAndPassword(auth, email, pass)
            .then(() => window.location.href = 'admin.html')
            .catch(err => document.getElementById('login-err').innerText = err.message);
    };
}

const logoutBtn = document.getElementById('btn-logout');
if (logoutBtn) { logoutBtn.onclick = () => signOut(auth).then(() => window.location.href = 'login.html'); }

// --- PRODUCT MANAGEMENT ---
window.openProductModal = () => {
    document.getElementById('product-form-container').style.display = 'block';
    document.getElementById('p-id').value = "";
};

const saveProductBtn = document.getElementById('btn-save-product');
if (saveProductBtn) {
    saveProductBtn.onclick = () => {
        const id = document.getElementById('p-id').value;
        const data = {
            name: document.getElementById('p-name').value,
            price: parseFloat(document.getElementById('p-price').value),
            cost: parseFloat(document.getElementById('p-cost').value),
            stock: parseInt(document.getElementById('p-stock').value),
            img: document.getElementById('p-img').value,
            cat: document.getElementById('p-cat').value,
            active: true
        };
        if (id) {
            update(ref(db, `products/${id}`), data);
        } else {
            push(ref(db, 'products'), data);
        }
        document.getElementById('product-form-container').style.display = 'none';
    };
}

// Load Storefront Products
const productGrid = document.getElementById('product-grid');
if (productGrid) {
    onValue(ref(db, 'products'), (snap) => {
        productGrid.innerHTML = "";
        snap.forEach(child => {
            const p = child.val();
            if(!p.active) return;
            productGrid.innerHTML += `
                <div class="card">
                    ${p.stock < 5 ? '<div class="low-stock">LOW STOCK</div>' : ''}
                    <img src="${p.img}">
                    <div class="card-content">
                        <h3>${p.name}</h3>
                        <p class="price">₹${p.price}</p>
                        <button class="btn btn-gold" style="width:100%; margin-top:10px" onclick="buyNow('${child.key}', '${p.name}', ${p.price}, ${p.cost})">Buy Now</button>
                    </div>
                </div>`;
        });
    });
}

window.buyNow = (id, name, price, cost) => {
    localStorage.setItem('aarohi_cart', JSON.stringify({ id, name, price, cost }));
    window.location.href = 'checkout.html';
};

// --- CHECKOUT & TELEGRAM ---
const checkoutItem = document.getElementById('checkout-item');
if (checkoutItem) {
    const item = JSON.parse(localStorage.getItem('aarohi_cart'));
    if (item) {
        checkoutItem.innerHTML = `<strong>${item.name}</strong> <br> ₹${item.price}`;
        document.getElementById('checkout-total').innerText = `₹${item.price}`;
    }
}

const orderForm = document.getElementById('order-form');
if (orderForm) {
    orderForm.onsubmit = async (e) => {
        e.preventDefault();
        const item = JSON.parse(localStorage.getItem('aarohi_cart'));
        const orderData = {
            orderId: "AR-" + Math.floor(1000 + Math.random() * 9000),
            name: document.getElementById('order-name').value,
            phone: document.getElementById('order-phone').value,
            address: document.getElementById('order-address').value,
            productName: item.name,
            productId: item.id,
            amount: window.finalPrice || item.price,
            costPrice: item.cost,
            paymentMethod: document.getElementById('order-payment').value,
            status: "Pending",
            timestamp: new Date().toLocaleString()
        };

        const newRef = push(ref(db, 'orders'));
        await set(newRef, orderData);
        
        // Telegram Notify
        const botToken = "8332178525:AAHzyIN9oTEeHGLIruz1zaUvTBnyTfcBmNg";
        const chatId = "-1003759800000";
        const text = `🛍️ New Order - Aarohi Collection\n\n👤 Name: ${orderData.name}\n📞 Phone: ${orderData.phone}\n📍 Address: ${orderData.address}\n👗 Product: ${orderData.productName}\n💰 Amount: ₹${orderData.amount}\n💳 Payment: ${orderData.paymentMethod}\n📦 Status: Pending\n🕒 Date: ${orderData.timestamp}`;
        
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(text)}`);

        alert("Order Placed Successfully!");
        localStorage.clear();
        window.location.href = 'index.html';
    };
}

// --- ADMIN DASHBOARD & ORDERS ---
const adminOrders = document.getElementById('admin-orders-list');
if (adminOrders) {
    onValue(ref(db, 'orders'), (snap) => {
        adminOrders.innerHTML = "";
        let rev = 0, profit = 0, count = 0, todayRev = 0;
        const today = new Date().toLocaleDateString();

        snap.forEach(child => {
            const o = child.val();
            count++;
            rev += o.amount;
            profit += (o.amount - o.costPrice);
            if(o.timestamp.includes(today)) todayRev += o.amount;

            adminOrders.innerHTML += `
                <tr>
                    <td>${o.orderId}</td>
                    <td>${o.name}<br><small>${o.phone}</small></td>
                    <td>${o.productName}</td>
                    <td>₹${o.amount}</td>
                    <td>${o.paymentMethod}</td>
                    <td><span class="status-badge ${o.status}">${o.status}</span></td>
                    <td>
                        <select onchange="updateStatus('${child.key}', this.value)">
                            <option value="">Update</option>
                            <option value="Shipped">Shipped</option>
                            <option value="Delivered">Delivered</option>
                        </select>
                    </td>
                </tr>`;
        });
        document.getElementById('stat-orders').innerText = count;
        document.getElementById('stat-rev').innerText = "₹" + rev;
        document.getElementById('stat-profit').innerText = "₹" + profit;
        document.getElementById('stat-today').innerText = "₹" + todayRev;
    });
}

window.updateStatus = (id, status) => {
    update(ref(db, `orders/${id}`), { status: status }).then(() => {
        onValue(ref(db, `orders/${id}`), (snap) => {
            const o = snap.val();
            let msg = "";
            if(status === 'Shipped') msg = `Dear ${o.name},\n\nWe are pleased to inform you that your order from Aarohi Collection has been successfully shipped.\n\nProduct: ${o.productName}\nAmount: ₹${o.amount}\nPayment Method: ${o.paymentMethod}\n\nThank you for shopping with Aarohi Collection.`;
            if(status === 'Delivered') msg = `Dear ${o.name},\n\nYour order from Aarohi Collection has been successfully delivered.\n\nWe hope you love your purchase.`;
            
            window.open(`https://wa.me/91${o.phone}?text=${encodeURIComponent(msg)}`);
        }, { onlyOnce: true });
    });
};

// --- UTILS ---
window.showSec = (id) => {
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    document.getElementById('sec-' + id).style.display = 'block';
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
    event.target.classList.add('active');
};

const csvBtn = document.getElementById('btn-csv');
if(csvBtn) {
    csvBtn.onclick = () => {
        onValue(ref(db, 'orders'), (snap) => {
            let csv = "Order ID,Customer,Phone,Product,Amount,Status\n";
            snap.forEach(c => {
                const o = c.val();
                csv += `${o.orderId},${o.name},${o.phone},${o.productName},${o.amount},${o.status}\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.setAttribute('href', url);
            a.setAttribute('download', 'orders.csv');
            a.click();
        }, { onlyOnce: true });
    }
}

// Load Admin Product Table
const adminProdList = document.getElementById('admin-product-list');
if(adminProdList) {
    onValue(ref(db, 'products'), (snap) => {
        adminProdList.innerHTML = "";
        snap.forEach(child => {
            const p = child.val();
            adminProdList.innerHTML += `
                <tr>
                    <td><img src="${p.img}" width="40"></td>
                    <td>${p.name}</td>
                    <td>₹${p.price}</td>
                    <td>${p.stock}</td>
                    <td>
                        <button onclick="editProd('${child.key}')">Edit</button>
                        <button onclick="deleteProd('${child.key}')">Del</button>
                    </td>
                </tr>`;
        });
    });
}

window.editProd = (id) => {
    onValue(ref(db, `products/${id}`), (snap) => {
        const p = snap.val();
        document.getElementById('p-id').value = id;
        document.getElementById('p-name').value = p.name;
        document.getElementById('p-price').value = p.price;
        document.getElementById('p-cost').value = p.cost;
        document.getElementById('p-stock').value = p.stock;
        document.getElementById('p-img').value = p.img;
        document.getElementById('product-form-container').style.display = 'block';
    }, { onlyOnce: true });
};

window.deleteProd = (id) => { if(confirm("Delete Product?")) remove(ref(db, `products/${id}`)); };
