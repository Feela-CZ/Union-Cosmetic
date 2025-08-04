let products = [];
let editIndex = null;
let currentSortField = null;
let currentSortOrder = 'asc';

document.getElementById('file-input').addEventListener('change', handleFileUpload);
document.getElementById('download-button').addEventListener('click', downloadJSON);
document.getElementById('add-product').addEventListener('click', openAddModal);
document.getElementById('close-modal').addEventListener('click', closeModal);
document.getElementById('product-form').addEventListener('submit', saveProduct);
document.getElementById('search-input').addEventListener('input', renderTable);
document.getElementById('brand-filter').addEventListener('change', renderTable);
document.getElementById('type-filter').addEventListener('change', renderTable);

fetch('../Order sheet/products.json')
    .then(res => res.json())
    .then(data => {
        products = data;
        renderTable();
        document.getElementById('product-table-section').style.display = 'block';
        document.getElementById('download-button').disabled = false;
    });

function handleFileUpload(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
        products = JSON.parse(e.target.result);
        renderTable();
        document.getElementById('product-table-section').style.display = 'block';
        document.getElementById('download-button').disabled = false;
    };
    reader.readAsText(file);
}

function renderTable() {
    const tbody = document.querySelector('#product-table tbody');
    tbody.innerHTML = '';

    const searchText = document.getElementById('search-input').value.toLowerCase();
    const brandFilter = document.getElementById('brand-filter').value;
    const typeFilter = document.getElementById('type-filter').value;

    populateDropdowns();

    const filteredProducts = products.filter(product => {
        const matchesSearch = (product.brand + ' ' + product.type + ' ' + product.id + ' ' + product.name)
            .toLowerCase()
            .includes(searchText);

        const matchesBrand = brandFilter ? product.brand === brandFilter : true;
        const matchesType = typeFilter ? product.type === typeFilter : true;

        return matchesSearch && matchesBrand && matchesType;
    });

    if (currentSortField) {
        filteredProducts.sort((a, b) => {
            let valA = a[currentSortField] || '';
            let valB = b[currentSortField] || '';

            if (!isNaN(parseFloat(valA)) && !isNaN(parseFloat(valB))) {
                valA = parseFloat(valA);
                valB = parseFloat(valB);
            } else {
                valA = valA.toString().toLowerCase();
                valB = valB.toString().toLowerCase();
            }

            if (valA < valB) return currentSortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return currentSortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }

    filteredProducts.forEach((product) => {
        const row = document.createElement('tr');
        const originalIndex = products.indexOf(product);

        row.innerHTML = `
        <td>${product.brand}</td>
        <td>${product.type}</td>
        <td>${product.id}</td>
        <td>${product.name}</td>
        <td>${product.volume}</td>
        <td>${product.price}</td>
        <td>${product.pack}</td>
        <td>${product.boxes_per_layer}</td>
        <td>${product.boxes_per_pallet}</td>
        <td>${product.new ? '✅' : ''}</td>
        <td>${product.new_date || ''}</td>
        <td>${product.discontinued ? '🚫' : ''}</td>
        <td>${product.discontinued_date || ''}</td>
        <td>
            <button onclick="editProduct(${originalIndex})">Edit</button>
            <button class="${getLogisticsClass(product)}" onclick="showLogistics(${originalIndex})">Logistics</button>
            <button id="delete-button" onclick="deleteProduct(${originalIndex})">Delete</button>
        </td>
    `;
        tbody.appendChild(row);
    });
}

function populateDropdowns() {
    const brandFilter = document.getElementById('brand-filter');
    const typeFilter = document.getElementById('type-filter');

    const selectedBrand = brandFilter.value;
    const selectedType = typeFilter.value;

    const brands = [...new Set(products.map(p => p.brand))].sort();
    const types = [...new Set(products.map(p => p.type))].sort();

    brandFilter.innerHTML = '<option value="">Filter by Brand</option>' + brands.map(b => `<option value="${b}" ${b === selectedBrand ? 'selected' : ''}>${b}</option>`).join('');
    typeFilter.innerHTML = '<option value="">Filter by Type</option>' + types.map(t => `<option value="${t}" ${t === selectedType ? 'selected' : ''}>${t}</option>`).join('');
}

function openAddModal() {
    editIndex = null;
    document.getElementById('product-form').reset();
    populateTypeSelect();
    if (document.getElementById('new').checked) {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('new_date').value = today;
    } else {
        document.getElementById('new_date').value = '';
    }
    document.getElementById('modal').style.display = 'block';
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

let pendingProduct = null;

function saveProduct(event) {
    event.preventDefault();

    const missingFields = [];

    const brand = document.getElementById('brand').value.trim();
    const type = document.getElementById('type').value.trim();
    const id = document.getElementById('id').value.trim();
    const name = document.getElementById('name').value.trim();
    const volumeNumber = document.getElementById('volume-number').value.trim();
    const volumeUnit = document.getElementById('volume-unit').value.trim();
    const price = document.getElementById('price').value.trim();
    const pack = document.getElementById('pack').value.trim();
    const boxesPerLayer = document.getElementById('boxes_per_layer').value.trim();
    const boxesPerPallet = document.getElementById('boxes_per_pallet').value.trim();

    if (!brand) missingFields.push('Brand');
    if (!type) missingFields.push('Type');
    if (!id) missingFields.push('ID (EAN)');
    if (!name) missingFields.push('Name');
    if (!volumeNumber || !volumeUnit) missingFields.push('Volume');
    if (!price) missingFields.push('Price');
    if (!pack) missingFields.push('Pack');
    if (!boxesPerLayer) missingFields.push('Boxes per Layer');
    if (!boxesPerPallet) missingFields.push('Boxes per Pallet');

    const product = {
        brand,
        type,
        id,
        name,
        volume: volumeNumber + ' ' + volumeUnit,
        price: parseFloat(price),
        pack: parseInt(pack),
        boxes_per_layer: parseInt(boxesPerLayer),
        boxes_per_pallet: parseInt(boxesPerPallet),
        new: document.getElementById('new').checked,
        new_date: document.getElementById('new_date').value,
        discontinued: document.getElementById('discontinued').checked,
        discontinued_date: document.getElementById('discontinued_date').value
    };

    if (missingFields.length > 0) {
        pendingProduct = product;
        document.getElementById('validation-message').innerHTML =
            `Následující pole chybí nebo nejsou vyplněná:<br><br>` +
            `<ul>${missingFields.map(f => `<li>${f}</li>`).join('')}</ul>` +
            `<br>Chcete produkt i přesto uložit?`;
        document.getElementById('validation-modal').style.display = 'block';
        return;
    }

    saveProductFinal(product);
}

function saveProductFinal(product) {
    if (editIndex !== null) {
        products[editIndex] = product;
    } else {
        products.push(product);
    }

    renderTable();
    closeModal();
}

document.getElementById('reset-filters').addEventListener('click', () => {
    document.getElementById('search-input').value = '';
    document.getElementById('brand-filter').value = '';
    document.getElementById('type-filter').value = '';
    currentSortField = null;
    currentSortOrder = 'asc';
    renderTable();
});

document.getElementById('new').addEventListener('change', function () {
    if (this.checked) {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('new_date').value = today;
    } else {
        document.getElementById('new_date').value = '';
    }
});

document.getElementById('discontinued').addEventListener('change', function () {
    if (this.checked) {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('discontinued_date').value = today;
    } else {
        document.getElementById('discontinued_date').value = '';
    }
});

function editProduct(index) {
    const product = products[index];
    editIndex = index;

    document.getElementById('brand').value = product.brand;
    document.getElementById('type').value = product.type;
    document.getElementById('id').value = product.id;
    document.getElementById('name').value = product.name;
    const [volValue, volUnit] = (product.volume || '').split(' ');
    document.getElementById('volume-number').value = volValue || '';
    document.getElementById('volume-unit').value = volUnit || 'ml';
    document.getElementById('price').value = product.price;
    document.getElementById('pack').value = product.pack;
    document.getElementById('boxes_per_layer').value = product.boxes_per_layer;
    document.getElementById('boxes_per_pallet').value = product.boxes_per_pallet;
    document.getElementById('new').checked = product.new;
    document.getElementById('new_date').value = product.new_date;
    document.getElementById('discontinued').checked = product.discontinued === true;
    document.getElementById('discontinued_date').value = product.discontinued_date;
    document.getElementById('modal').style.display = 'block';
}

let deleteIndex = null;

function deleteProduct(index) {
    deleteIndex = index;
    document.getElementById('confirm-delete-modal').style.display = 'block';
}

document.getElementById('confirm-delete-yes').addEventListener('click', () => {
    if (deleteIndex !== null) {
        products.splice(deleteIndex, 1);
        renderTable();
    }
    closeDeleteModal();
});

document.getElementById('confirm-delete-no').addEventListener('click', closeDeleteModal);

function closeDeleteModal() {
    document.getElementById('confirm-delete-modal').style.display = 'none';
    deleteIndex = null;
}

function downloadJSON() {
    const dataStr = JSON.stringify(products, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products.json';
    a.click();
    URL.revokeObjectURL(url);
}

function sortTable(field) {
    if (currentSortField === field) {
        currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortField = field;
        currentSortOrder = 'asc';
    }
    renderTable();
}

function showLogistics(index) {
    const product = products[index];
    const dims = product.dimensions;

    if (!dims) {
        document.getElementById('logistics-content').innerHTML = '<p>No logistics data available.</p>';
        document.getElementById('logistics-modal').style.display = 'block';
        return;
    }

    const sections = ['ITEM', 'CARTON', 'LAYER', 'PALLET'];

    const formatGroup = (label, group) => {
        if (!group) return '';
        let html = `<div style="margin-bottom: 10px;"><strong>${label}</strong><br>`;
        for (const key in group) {
            html += `${key.replace(/_/g, ' ')}: ${group[key]}<br>`;
        }
        html += `</div>`;
        return html;
    };

    const logisticsHtml = sections.map(sec => formatGroup(sec, dims[sec])).join('');

    document.getElementById('logistics-content').innerHTML = logisticsHtml || '<p>No logistics data available.</p>';
    document.getElementById('logistics-modal').style.display = 'block';
}

document.getElementById('close-logistics-modal').addEventListener('click', () => {
    document.getElementById('logistics-modal').style.display = 'none';
});

function populateTypeSelect() {
    const typeSelect = document.getElementById('type');
    if (!typeSelect) return;

    const types = [...new Set(products.map(p => p.type))].sort();
    typeSelect.innerHTML = '<option value="">-- select type --</option>' +
        types.map(t => `<option value="${t}">${t}</option>`).join('');
}

function getLogisticsClass(product) {
    const dims = product.dimensions;
    if (!dims) return 'logistics-empty';

    const sectionsToCheck = ['ITEM', 'CARTON', 'LAYER', 'PALLET'];

    const relevantValues = sectionsToCheck.flatMap(section => {
        const group = dims[section];
        if (!group || typeof group !== 'object') return [];
        return Object.values(group);
    });

    if (relevantValues.length === 0) return 'logistics-empty';

    const hasNull = relevantValues.some(v => v === null || v === '');
    return hasNull ? 'logistics-partial' : '';
}

document.getElementById('force-save-button').addEventListener('click', () => {
    if (pendingProduct) {
        saveProductFinal(pendingProduct);
        pendingProduct = null;
    }
    document.getElementById('validation-modal').style.display = 'none';
});

document.getElementById('cancel-save-button').addEventListener('click', () => {
    pendingProduct = null;
    document.getElementById('validation-modal').style.display = 'none';
});