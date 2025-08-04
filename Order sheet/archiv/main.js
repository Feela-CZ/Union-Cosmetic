const brandContainer = document.getElementById('brand-container');
const typeContainer = document.getElementById('type-container');
const productContainer = document.getElementById('product-container');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');

let allProducts = [];
let currentBrand = null;
let currentType = null;
let justEdited = false;

// --- GLOBAL ORDER STATE (persistuje do localStorage) ---
let orderState = {};
loadOrderState();

const logoMap = {
    "Lilien": "logo_lilien.png",
    "Naturalis": "logo-naturalis.png",
    "Twister": "logo_twister.jpg",
    "Natava": "logo-natava.png"
};

fetch('products.json')
    .then(res => res.json())
    .then(data => {
        allProducts = data;
        renderBrands();
    });

function loadOrderState() {
    const saved = localStorage.getItem('orderState');
    if (saved) {
        orderState = JSON.parse(saved);
    } else {
        orderState = {};
    }
}

function saveOrderState() {
    localStorage.setItem('orderState', JSON.stringify(orderState));
}

function renderBrands() {
    brandContainer.innerHTML = '';
    Object.keys(logoMap).forEach(brand => {
        const card = document.createElement('div');
        card.className = 'brand-card' + (currentBrand === brand ? ' active' : '');
        card.innerHTML = `<img src="${logoMap[brand]}" alt="${brand}"><div>${brand}</div>`;
        card.onclick = () => selectBrand(brand);
        brandContainer.appendChild(card);
    });
}

function selectBrand(brand) {
    currentBrand = brand;
    currentType = null;
    renderBrands();
    renderTypes();
    renderProducts();
}

function renderTypes() {
    typeContainer.innerHTML = '';
    const filtered = allProducts.filter(p => p.brand === currentBrand);
    const typeCount = {};
    filtered.forEach(p => {
        typeCount[p.type] = (typeCount[p.type] || 0) + 1;
    });

    Object.keys(typeCount)
        .sort((a, b) => typeCount[b] - typeCount[a])
        .forEach(type => {
            const card = document.createElement('div');
            card.className = 'type-card' + (currentType === type ? ' active' : '');
            card.innerText = `${type} (${typeCount[type]})`;
            card.onclick = () => toggleType(type);
            typeContainer.appendChild(card);
        });
}

function toggleType(type) {
    if (currentType === type) {
        currentType = null;
    } else {
        currentType = type;
    }
    renderBrands();
    renderTypes();
    renderProducts();
}

function renderProducts() {
    productContainer.innerHTML = '';
    let filtered = allProducts.filter(p => p.brand === currentBrand);
    if (currentType) {
        filtered = filtered.filter(p => p.type === currentType);
    }

    filtered.sort((a, b) => {
        if (a.new && !b.new) return -1;
        if (!a.new && b.new) return 1;
        
        const parseVolume = v => parseFloat(v.replace(/[^\d.]/g, '')) || 0;
        return parseVolume(a.volume) - parseVolume(b.volume);
    });

    filtered.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';

        if (product.new) {
            const badge = document.createElement('div');
            badge.className = 'new-badge';
            badge.textContent = 'NEW';
            card.appendChild(badge);
        }

        const imgPath = `img/${product.id}.jpg`;

        const img = document.createElement('img');
        img.src = imgPath;
        img.onerror = function () { this.src = 'img/no-image.jpg'; };
        card.appendChild(img);

        const name = document.createElement('h3');
        name.textContent = product.name;
        card.appendChild(name);

        const details = [
            [`EAN:`, product.id],
            [`Volume:`, product.volume],
            [`Price:`, `€ ${product.price}`],
            [`Pack:`, product.pack],
            [`Layer:`, `${product.boxes_per_layer} / Pallet: ${product.boxes_per_pallet}`]
        ];

        details.forEach(([label, value]) => {
            const p = document.createElement('p');
            p.innerHTML = `<b>${label}</b> ${value}`;
            card.appendChild(p);
        });

        const orderInputs = document.createElement('div');
        orderInputs.className = 'order-inputs';

        const boxesDiv = document.createElement('div');
        boxesDiv.innerHTML = '<label>Boxes:</label><br>';
        const boxInput = document.createElement('input');
        boxInput.type = 'number';
        boxInput.min = '0';
        boxInput.className = 'box-input';
        boxInput.dataset.pack = product.pack;
        boxesDiv.appendChild(boxInput);

        const piecesDiv = document.createElement('div');
        piecesDiv.innerHTML = '<label>Pieces:</label><br>';
        const pieceInput = document.createElement('input');
        pieceInput.type = 'number';
        pieceInput.min = '0';
        pieceInput.step = product.pack;
        pieceInput.className = 'piece-input';
        pieceInput.dataset.pack = product.pack;
        piecesDiv.appendChild(pieceInput);

        orderInputs.appendChild(boxesDiv);
        orderInputs.appendChild(piecesDiv);
        card.appendChild(orderInputs);

        // --- restore saved pieces ---
        const ean = product.id.toString();
        if (orderState[ean]) {
            pieceInput.value = orderState[ean].pieces;
            boxInput.value = orderState[ean].pieces / product.pack;
        }

        card.onclick = (e) => {
            if (!e.target.closest('.order-inputs')) {
                if (justEdited) {
                    justEdited = false;
                } else {
                    openLightbox(imgPath);
                }
            }
        };

        productContainer.appendChild(card);
    });

    attachInputListeners();
    updateCartCount();
}

function attachInputListeners() {
    document.querySelectorAll('.box-input').forEach(boxInput => {
        const pack = parseInt(boxInput.dataset.pack);
        const pieceInput = boxInput.closest('.order-inputs').querySelector('.piece-input');
        const card = boxInput.closest('.product-card');
        const ean = card.querySelector('p').innerText.replace('EAN: ', '');
        const name = card.querySelector('h3').innerText;
        const volume = [...card.querySelectorAll('p')][1].innerText.replace('Volume: ', '');
        const price = [...card.querySelectorAll('p')][2].innerText.replace('Price: € ', '');

        function validateAndRound() {
            let pieces = parseInt(pieceInput.value);
            if (isNaN(pieces) || pieces <= 0) {
                pieceInput.value = '';
                boxInput.value = '';
                updateOrderState(ean, name, volume, price, 0);
                return;
            }
            const remainder = pieces % pack;
            if (remainder !== 0) {
                const roundedPieces = Math.ceil(pieces / pack) * pack;
                pieceInput.value = roundedPieces;
                boxInput.value = roundedPieces / pack;
                alert(`Ordered amount needs to be in full boxes. Your order has been rounded up from ${pieces} to ${roundedPieces}.`);
            } else {
                boxInput.value = pieces / pack;
            }
            updateOrderState(ean, name, volume, price, parseInt(pieceInput.value));
            justEdited = true;
        }

        boxInput.addEventListener('input', () => {
            const boxes = parseInt(boxInput.value) || 0;
            pieceInput.value = boxes * pack;
            updateOrderState(ean, name, volume, price, parseInt(pieceInput.value) || 0);
            justEdited = true;
        });

        pieceInput.addEventListener('input', () => {
            let pieces = parseInt(pieceInput.value);
            if (isNaN(pieces) || pieces <= 0) {
                boxInput.value = '';
            } else {
                boxInput.value = pieces / pack;
            }
            updateOrderState(ean, name, volume, price, pieces || 0);
            justEdited = true;
        });

        pieceInput.addEventListener('blur', validateAndRound);

        pieceInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                validateAndRound();
            }
        });
    });
}

function updateOrderState(ean, name, volume, price, pieces) {
    if (pieces > 0) {
        orderState[ean] = { ean, name, volume, price, pieces };
    } else {
        delete orderState[ean];
    }
    saveOrderState();
    updateCartCount();
}

function openLightbox(src) {
    lightboxImg.src = src;
    lightbox.style.display = 'flex';
    setTimeout(() => {
        lightbox.classList.add('show');
    }, 10);
}

lightbox.addEventListener('click', () => {
    lightbox.classList.remove('show');
    setTimeout(() => {
        lightbox.style.display = 'none';
    }, 300);
});

document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
        lightbox.classList.remove('show');
        setTimeout(() => {
            lightbox.style.display = 'none';
        }, 300);
    }
});

function getCurrentOrder() {
    return Object.values(orderState);
}

function updateCartCount() {
    const order = getCurrentOrder();
    const totalPieces = order.reduce((sum, item) => sum + item.pieces, 0);
    const countElem = document.getElementById('cart-count');
    if (countElem) {
        countElem.textContent = totalPieces;
    }
}

function openCartModal() {
    const order = getCurrentOrder();
    const modal = document.getElementById('cart-modal');
    const tableContainer = document.getElementById('cart-table-container');
    const summaryElem = document.getElementById('cart-summary');

    if (order.length === 0) {
        tableContainer.innerHTML = '<p>No items in order.</p>';
        summaryElem.innerHTML = '';
    } else {
        let html = '<table><thead><tr><th>EAN</th><th>Name</th><th>Volume</th><th>Price (€)</th><th>Pieces</th></tr></thead><tbody>';

        order.forEach(item => {
            html += `<tr>
                <td>${item.ean}</td>
                <td>${item.name}</td>
                <td>${item.volume}</td>
                <td>${item.price}</td>
                <td>${item.pieces}</td>
            </tr>`;
        });

        html += '</tbody></table>';
        tableContainer.innerHTML = html;

        const totalPieces = order.reduce((sum, item) => sum + item.pieces, 0);
        summaryElem.innerHTML = `Total pieces: ${totalPieces}`;
    }

    modal.style.display = 'block';
}

function closeCartModal() {
    const modal = document.getElementById('cart-modal');
    modal.style.display = 'none';
}

function confirmOrder() {
    const order = getCurrentOrder();

    if (order.length === 0) {
        alert('No items in order.');
        return;
    }

    if (confirm('Do you really want to confirm and send the order?')) {
        console.log('Order confirmed:', order);
        alert('Order confirmed (console log) — next step: send email with Excel!');
    }
}