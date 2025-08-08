const brandContainer = document.getElementById('brand-container');
const typeContainer = document.getElementById('type-container');
const productContainer = document.getElementById('product-container');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');

let logisticsData = {};
fetch('logistics.json')
    .then(res => res.json())
    .then(data => {
        logisticsData = data;
    });

let allProducts = [];
let currentBrand = null;
let currentType = null;
let justEdited = false;
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
        updateCartCount();
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

    const types = [...new Set(
        allProducts
            .filter(p => p.brand === currentBrand && !p.discontinued)
            .map(p => p.type)
    )];

    types.sort((a, b) => {
        const countA = allProducts.filter(p => p.brand === currentBrand && p.type === a && !p.discontinued).length;
        const countB = allProducts.filter(p => p.brand === currentBrand && p.type === b && !p.discontinued).length;
        return countB - countA;
    });

    types.forEach(type => {
        const count = allProducts.filter(p => p.brand === currentBrand && p.type === type && !p.discontinued).length;

        const card = document.createElement('div');
        card.className = 'type-card';

        const typeSpan = document.createElement('span');
        typeSpan.textContent = type;
        card.appendChild(typeSpan);

        if (count > 0) {
            const badge = document.createElement('span');
            badge.className = 'badge';
            badge.textContent = count;
            card.appendChild(badge);
        }

        card.addEventListener('click', () => {
            currentType = type;
            renderProducts();
            updateTypeSelection();
        });

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
    filtered = filtered.filter(p => !p.discontinued);

    filtered.sort((a, b) => {
        if (a.new && !b.new) return -1;
        if (!a.new && b.new) return 1;
        const parseVolume = v => parseFloat(v.replace(/[^\d.]/g, '')) || 0;
        return parseVolume(a.volume) - parseVolume(b.volume);
    });

    filtered.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        const ean = product.id.toString();

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

        const formatMissing = (val) => {
            if (typeof val === 'string' && val.toUpperCase().includes('CHYBÍ')) {
                return `<span style="color:red; font-weight:bold;">${val}</span>`;
            }
            return val;
        };

        const details = [
            [`EAN:`, formatMissing(product.id)],
            [`Volume:`, formatMissing(product.volume)],
            [`Price:`, formatMissing(`${product.price} €`)],
            [`Pieces/Pack:`, formatMissing(product.pack)],
            [`Boxes/Layer:`, formatMissing(product.boxes_per_layer)],
            [`Boxes/Pallet:`, formatMissing(product.boxes_per_pallet)]
        ];

        details.forEach(([label, value]) => {
            const p = document.createElement('p');
            p.innerHTML = `<b>${label}</b> ${value}`;
            card.appendChild(p);
        });

        const quantityWrapper = document.createElement('div');
        quantityWrapper.className = 'quantity-wrapper';

        // --- Kusy ---
        const piecesRow = document.createElement('div');
        piecesRow.className = 'pieces-row';

        const minusBtn = document.createElement('button');
        minusBtn.type = 'button';
        minusBtn.textContent = '−';

        const plusBtn = document.createElement('button');
        plusBtn.type = 'button';
        plusBtn.textContent = '+';

        const pieceInput = document.createElement('input');
        pieceInput.type = 'number';
        pieceInput.min = '0';
        pieceInput.step = product.pack;
        pieceInput.placeholder = 'pieces';
        pieceInput.value = orderState[ean] ? orderState[ean].pieces : '';
        pieceInput.dataset.pack = product.pack;

        piecesRow.appendChild(minusBtn);
        piecesRow.appendChild(pieceInput);
        piecesRow.appendChild(plusBtn);

        // --- Boxy ---
        const boxRow = document.createElement('div');
        boxRow.className = 'unit-row';

        const boxMinus = document.createElement('button');
        boxMinus.type = 'button';
        boxMinus.textContent = '−';

        const boxPlus = document.createElement('button');
        boxPlus.type = 'button';
        boxPlus.textContent = '+';

        const boxInput = document.createElement('input');
        boxInput.placeholder = 'boxes';
        boxInput.type = 'number';
        boxInput.min = '0';
        boxInput.className = 'unit-input box-input';

        boxRow.appendChild(boxMinus);
        boxRow.appendChild(boxInput);
        boxRow.appendChild(boxPlus);

        const palletRow = document.createElement('div');
        palletRow.className = 'unit-row';

        const palletMinus = document.createElement('button');
        palletMinus.type = 'button';
        palletMinus.textContent = '−';

        const palletPlus = document.createElement('button');
        palletPlus.type = 'button';
        palletPlus.textContent = '+';

        const palletInput = document.createElement('input');
        palletInput.placeholder = 'pallets';
        palletInput.type = 'number';
        palletInput.min = '0';
        palletInput.className = 'unit-input pallet-input';

        palletRow.appendChild(palletMinus);
        palletRow.appendChild(palletInput);
        palletRow.appendChild(palletPlus);

        const boxPalletRow = document.createElement('div');
        boxPalletRow.className = 'box-pallet-row';
        boxPalletRow.appendChild(boxRow);
        boxPalletRow.appendChild(palletRow);

        quantityWrapper.appendChild(piecesRow);
        quantityWrapper.appendChild(boxPalletRow);
        card.appendChild(quantityWrapper);

        function updateAllFromPieces(pieces) {
            const pack = product.pack;
            const boxesPerPallet = product.boxes_per_pallet;

            const boxes = Math.floor(pieces / pack);
            const pallets = Math.floor(boxes / boxesPerPallet);

            pieceInput.value = pieces || '';
            boxInput.value = boxes || '';
            palletInput.value = pallets || '';
            updateOrderState(ean, product.name, product.volume, product.price, pieces);
        }

        function validateAndRound() {
            let pieces = parseInt(pieceInput.value) || 0;
            const remainder = pieces % product.pack;
            if (pieces === 0) {
                pieceInput.value = '';
            } else if (remainder !== 0) {
                const rounded = Math.ceil(pieces / product.pack) * product.pack;
                pieceInput.value = rounded;
                showInfoModal(`Ordered amount needs to be in full boxes. Rounded up to ${rounded} pcs.`);
            }
            updateAllFromPieces(parseInt(pieceInput.value) || 0);
        }

        minusBtn.addEventListener('click', () => {
            let pieces = parseInt(pieceInput.value) || 0;
            pieces = Math.max(0, pieces - product.pack);
            updateAllFromPieces(pieces);
        });

        plusBtn.addEventListener('click', () => {
            let pieces = parseInt(pieceInput.value) || 0;
            pieces += product.pack;
            updateAllFromPieces(pieces);
        });

        pieceInput.addEventListener('input', () => {
            const val = parseInt(pieceInput.value) || 0;
            updateAllFromPieces(val);
        });

        pieceInput.addEventListener('blur', validateAndRound);
        pieceInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') validateAndRound();
        });

        boxMinus.addEventListener('click', () => {
            let boxes = Math.floor((parseInt(pieceInput.value) || 0) / product.pack);
            boxes = Math.max(0, boxes - 1);
            const pieces = boxes * product.pack;
            updateAllFromPieces(pieces);
        });

        boxPlus.addEventListener('click', () => {
            let boxes = Math.floor((parseInt(pieceInput.value) || 0) / product.pack);
            boxes += 1;
            const pieces = boxes * product.pack;
            updateAllFromPieces(pieces);
        });

        boxInput.addEventListener('blur', () => {
            const boxes = parseInt(boxInput.value) || 0;
            const pieces = boxes * product.pack;
            updateAllFromPieces(pieces);
        });

        boxInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                const boxes = parseInt(boxInput.value) || 0;
                const pieces = boxes * product.pack;
                updateAllFromPieces(pieces);
            }
        });

        palletMinus.addEventListener('click', () => {
            const existing = parseInt(pieceInput.value) || 0;
            const step = product.boxes_per_pallet * product.pack;

            if (existing < step) {
                updateAllFromPieces(0);
                return;
            }

            const newTotal = existing - step;
            updateAllFromPieces(newTotal);
        });

        palletPlus.addEventListener('click', () => {
            const existing = parseInt(pieceInput.value) || 0;
            const step = product.boxes_per_pallet * product.pack;
            const newTotal = existing + step;
            updateAllFromPieces(newTotal);
        });

        palletInput.addEventListener('blur', () => {
            const pallets = parseInt(palletInput.value) || 0;
            const pieces = pallets * product.boxes_per_pallet * product.pack;
            updateAllFromPieces(pieces);
        });

        palletInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                const pallets = parseInt(palletInput.value) || 0;
                const pieces = pallets * product.boxes_per_pallet * product.pack;
                updateAllFromPieces(pieces);
            }
        });

        card.onclick = (e) => {
            if (!e.target.closest('.quantity-wrapper')) {
                if (justEdited) {
                    justEdited = false;
                } else {
                    openLightbox(imgPath);
                }
            }
        };

        productContainer.appendChild(card);
    });

    updateCartCount();
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

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;

    if (lightbox) {
        lightbox.classList.remove('show');
        setTimeout(() => { lightbox.style.display = 'none'; }, 300);
    }

    // Všechny modaly
    try { closeCartModal(); } catch {}
    try { closeConfirmModal(); } catch {}
    try { closeClearModal(); } catch {}
    try { closeInfoModal(); } catch {}
});

window.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'cart-modal') {
        closeCartModal();
    }

    if (e.target && e.target.classList && e.target.classList.contains('small-modal')) {
        e.target.style.display = 'none';
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
        let html = '<table><thead><tr><th>EAN</th><th>Name</th><th>Volume</th><th>Pieces</th><th>Price (€)</th><th>Remove</th></tr></thead><tbody>';

        order.forEach(item => {
            html += `<tr>
                <td>${item.ean}</td>
                <td>${item.name}</td>
                <td>${item.volume}</td>
                <td>${item.pieces}</td>
                <td>${item.price}</td>
                <td style="text-align: center;"><button onclick="removeFromCart('${item.ean}')" style="cursor:pointer;">🗑️</button></td>
            </tr>`;
        });

        html += '</tbody></table>';
        tableContainer.innerHTML = html;

        const totalPieces = order.reduce((sum, item) => sum + item.pieces, 0);
        const totalPrice = order.reduce((sum, item) => sum + (item.pieces * parseFloat(item.price)), 0).toFixed(2);

        summaryElem.innerHTML = `Total pieces: ${totalPieces} &nbsp; | &nbsp; Total price (€): ${totalPrice}`;
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
        showInfoModal('No items in order.');
        closeConfirmModal();
        return;
    }

    console.log('Order confirmed:', order);
    downloadExcel(order);

    orderState = {};
    saveOrderState();
    updateCartCount();
    closeCartModal();
    closeConfirmModal();
}

function removeFromCart(ean) {
    if (orderState[ean]) {
        delete orderState[ean];
        saveOrderState();
        updateCartCount();
        openCartModal();
    }
}

function showConfirmModal() {
    document.getElementById('confirm-modal').style.display = 'block';
}

function closeConfirmModal() {
    document.getElementById('confirm-modal').style.display = 'none';
}

function showClearModal() {
    document.getElementById('clear-modal').style.display = 'block';
}

function closeClearModal() {
    document.getElementById('clear-modal').style.display = 'none';
}

function clearCart() {
    orderState = {};
    saveOrderState();
    updateCartCount();
    closeCartModal();
    closeClearModal();
    renderProducts();
}

function showInfoModal(message) {
    document.getElementById('info-modal-text').textContent = message;
    document.getElementById('info-modal').style.display = 'block';
}

function closeInfoModal() {
    document.getElementById('info-modal').style.display = 'none';
}

function downloadExcel(order) {
    if (!order || order.length === 0) return;

    const ws_data = [
        ['EAN', 'Name', 'Volume', 'Price (€)', 'Pieces']
    ];

    let totalPrice = 0;
    let totalPieces = 0;

    order.forEach(item => {
        ws_data.push([
            item.ean,
            item.name,
            item.volume,
            parseFloat(item.price),
            item.pieces
        ]);
        totalPrice += parseFloat(item.price) * item.pieces;
        totalPieces += item.pieces;
    });

    ws_data.push([
        '', '', '', 'TOTAL:', '',
    ]);

    ws_data.push([
        '', '', '', totalPrice.toFixed(2), totalPieces
    ]);

    const ws = XLSX.utils.aoa_to_sheet(ws_data);

    // Set column widths (auto size)
    ws['!cols'] = [
        { wch: 18 },  // EAN
        { wch: 40 },  // Name
        { wch: 15 },  // Volume
        { wch: 12 },  // Price
        { wch: 10 }   // Pieces
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Order');

    const today = new Date();
    const yyyymmdd = today.toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `order-${yyyymmdd}.xlsx`;

    XLSX.writeFile(wb, fileName);
}