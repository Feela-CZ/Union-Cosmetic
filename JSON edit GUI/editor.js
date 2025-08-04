let products = [];
let editIndex = null;
let currentSortField = null;
let currentSortOrder = 'asc';
let logisticsData = {};
let currentLogisticsBrand = null;
let currentLogisticsKey = null;
let currentLogisticsProductIndex = null;

const attributeLabels = {
    nr_of_items: "Number of Items",
    nr_of_cartons: "Number of Cartons",
    nr_of_layers: "Number of Layers",
    length: "Length",
    width: "Width",
    height: "Height",
    weight: "Weight"
};

fetch('logistics.json')
    .then(res => res.json())
    .then(data => {
        logisticsData = data;
        initUI();
    });

function fillKeysSelect(brand, selectedKey = null) {
    const chooseKey = document.getElementById('choose-key');
    chooseKey.innerHTML = '';
    if (logisticsData[brand]) {
        Object.keys(logisticsData[brand]).forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = key;
            chooseKey.appendChild(option);
        });
        if (selectedKey) {
            chooseKey.value = selectedKey;
        }
    }
}

function initUI() {
    document.getElementById('download-logistics-button').disabled = false;

    document.getElementById('file-input').addEventListener('change', handleFileUpload);
    document.getElementById('download-button').addEventListener('click', downloadJSON);
    document.getElementById('add-product').addEventListener('click', openAddModal);
    document.getElementById('product-form').addEventListener('submit', saveProduct);
    document.getElementById('search-input').addEventListener('input', renderTable);
    document.getElementById('brand-filter').addEventListener('change', function () {
        updateLogisticsKeyFilter();
        renderTable();
    });
    document.getElementById('logistics-key-filter').addEventListener('change', renderTable);
    document.getElementById('type-filter').addEventListener('change', renderTable);

    document.getElementById('choose-logistics-key-btn').addEventListener('click', function () {
        const selectedBrand = currentLogisticsBrand;
        const selectedKey = currentLogisticsKey;
        const chooseBrand = document.getElementById('choose-brand');
        chooseBrand.innerHTML = '';
        Object.keys(logisticsData).forEach(brand => {
            const option = document.createElement('option');
            option.value = brand;
            option.textContent = brand;
            if (brand === selectedBrand) option.selected = true;
            chooseBrand.appendChild(option);
        });
        fillKeysSelect(selectedBrand, selectedKey);
        document.getElementById('choose-logistics-modal').style.display = 'block';
    });

    document.getElementById('choose-brand').addEventListener('change', function () {
        fillKeysSelect(this.value);
    });

    document.getElementById('choose-logistics-form').addEventListener('submit', function (e) {
        e.preventDefault();
        const selectedBrand = document.getElementById('choose-brand').value;
        const selectedKey = document.getElementById('choose-key').value;

        const sourceLogistics = logisticsData[selectedBrand]?.[selectedKey];

        if (sourceLogistics) {
            if (!logisticsData[selectedBrand]) logisticsData[selectedBrand] = {};
            logisticsData[selectedBrand][selectedKey] = JSON.parse(JSON.stringify(sourceLogistics));

            document.getElementById('logistics-key').value = selectedKey;
            if (sourceLogistics.ITEM) {
                Object.keys(sourceLogistics.ITEM).forEach(k => {
                    const input = document.getElementById('logistics-ITEM-' + k);
                    if (input) input.value = sourceLogistics.ITEM[k] || '';
                });
            }
            if (sourceLogistics.CARTON) {
                Object.keys(sourceLogistics.CARTON).forEach(k => {
                    const input = document.getElementById('logistics-CARTON-' + k);
                    if (input) input.value = sourceLogistics.CARTON[k] || '';
                });
            }
            if (sourceLogistics.LAYER) {
                Object.keys(sourceLogistics.LAYER).forEach(k => {
                    const input = document.getElementById('logistics-LAYER-' + k);
                    if (input) input.value = sourceLogistics.LAYER[k] || '';
                });
            }
            if (sourceLogistics.PALLET) {
                Object.keys(sourceLogistics.PALLET).forEach(k => {
                    const input = document.getElementById('logistics-PALLET-' + k);
                    if (input) input.value = sourceLogistics.PALLET[k] || '';
                });
            }
            if (currentLogisticsProductIndex !== null) {
                products[currentLogisticsProductIndex].key = selectedKey;
            }
            updateLogisticsModalContent(selectedBrand, selectedKey);
        }
        currentLogisticsKey = selectedKey;
        document.getElementById('choose-logistics-modal').style.display = 'none';
        renderTable();
    });

    fetch('../Order sheet/products.json')
        .then(res => res.json())
        .then(data => {
            products = data;
            renderTable();
            document.getElementById('product-table-section').style.display = 'block';
            document.getElementById('download-button').disabled = false;
        });

    updateLogisticsKeyFilter();
}

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
    const logisticsKeyFilter = document.getElementById('logistics-key-filter').value;

    populateDropdowns();

    const filteredProducts = products.filter(product => {
        const matchesSearch = (product.brand + ' ' + product.type + ' ' + product.id + ' ' + product.name)
            .toLowerCase()
            .includes(searchText);

        const matchesBrand = brandFilter ? product.brand === brandFilter : true;
        const matchesType = typeFilter ? product.type === typeFilter : true;

        let matchesLogisticsKey = true;
        if (brandFilter && logisticsKeyFilter) {
            matchesLogisticsKey = (product.key != null && String(product.key) === logisticsKeyFilter);
        }

        return matchesSearch && matchesBrand && matchesType && matchesLogisticsKey;
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
        <td>${product.hs}</td>
        <td>${product.name}</td>
        <td>${product.volume}</td>
        <td>${product.price}</td>
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
    populateLogisticsKeySelect();
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
    hs: document.getElementById('hs').value.trim();
    const name = document.getElementById('name').value.trim();
    const volumeNumber = document.getElementById('volume-number').value.trim();
    const volumeUnit = document.getElementById('volume-unit').value.trim();
    const price = document.getElementById('price').value.trim();
    const pack = document.getElementById('pack').value.trim();
    const boxesPerLayer = document.getElementById('boxes_per_layer').value.trim();
    const boxesPerPallet = document.getElementById('boxes_per_pallet').value.trim();
    const logisticsKey = document.getElementById('logistics-key').value.trim();

    if (!brand) missingFields.push('Brand');
    if (!type) missingFields.push('Type');
    if (!id) missingFields.push('ID (EAN)');
    if (!name) missingFields.push('Name');
    if (!volumeNumber || !volumeUnit) missingFields.push('Volume');
    if (!price) missingFields.push('Price');
    if (!pack) missingFields.push('Pack');
    if (!boxesPerLayer) missingFields.push('Boxes per Layer');
    if (!boxesPerPallet) missingFields.push('Boxes per Pallet');
    if (!logisticsKey) missingFields.push('Logistics key');

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
        key: logisticsKey,
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
    document.getElementById('logistics-key-filter').value = '';
    updateLogisticsKeyFilter();
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
    populateTypeSelect();
    document.getElementById('type').value = product.type;
    populateLogisticsKeySelect();
    document.getElementById('logistics-key').value = product.key || '';
    document.getElementById('id').value = product.id;
    document.getElementById('hs').value = product.hs;
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
    const data = logisticsData?.[product.brand]?.[product.key];

    const modal = document.getElementById('logistics-modal');
    const content = document.getElementById('logistics-content');
    content.innerHTML = '';

    const hiddenKeys = ['boxes_per_layer', 'boxes_per_pallet', 'pack'];

    document.getElementById('logistics-title').textContent =
        `Logistics data for ${product.brand} – "${product.key}" products`;

    if (!data) {
        content.innerHTML = '<p>No logistics data available.</p>';
    } else {
        for (const [section, values] of Object.entries(data)) {
            const visibleEntries = Object.entries(values).filter(([key]) => !hiddenKeys.includes(key));
            if (visibleEntries.length === 0) continue;

            content.innerHTML += `<h4>${section}:</h4><ul>`;
            for (const [key, value] of visibleEntries) {
                content.innerHTML += `<li><strong>${attributeLabels[key] || key.replace(/_/g, ' ')}</strong>: ${value}</li>`;
            }
            content.innerHTML += '</ul>';
        }
    }
    modal.style.display = 'block';

    document.getElementById('edit-logistics-btn').onclick = function () {
        openLogisticsEditModal(product.brand, product.key, index);
    };
}

function populateTypeSelect() {
    const typeSelect = document.getElementById('type');
    if (!typeSelect) return;

    const types = [...new Set(products.map(p => p.type))].sort();
    typeSelect.innerHTML = '<option value="">-- select type --</option>' +
        types.map(t => `<option value="${t}">${t}</option>`).join('');
}

function getLogisticsClass(product) {
    const logistics = logisticsData?.[product.brand]?.[product.key];
    if (!logistics) return 'logistics-empty';

    const allValues = [];
    ['ITEM', 'CARTON', 'LAYER', 'PALLET'].forEach(section => {
        const group = logistics[section];
        if (group) {
            Object.values(group).forEach(val => allValues.push(val));
        }
    });

    const total = allValues.length;
    const filled = allValues.filter(v => v !== null && v !== undefined && v !== '').length;

    if (total === 0 || filled === 0) return 'logistics-empty';
    if (filled === total) return 'btn-primary';
    return 'logistics-partial';
}

function populateLogisticsKeySelect() {
    const brand = document.getElementById('brand').value;
    const keySelect = document.getElementById('logistics-key');
    keySelect.innerHTML = '<option value="">-- select key --</option>';

    if (logisticsData && logisticsData[brand]) {
        Object.keys(logisticsData[brand]).forEach((key) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = key;
            keySelect.appendChild(option);
        });
    }
}

function updateLogisticsKeyFilter() {
    const brand = document.getElementById('brand-filter').value;
    const logisticsKeyFilter = document.getElementById('logistics-key-filter');

    if (brand && logisticsData[brand]) {
        const keys = Object.keys(logisticsData[brand]);
        keys.sort((a, b) => {
            const aNum = parseFloat(a);
            const bNum = parseFloat(b);

            const aIsNum = !isNaN(aNum) && a.match(/^\d/);
            const bIsNum = !isNaN(bNum) && b.match(/^\d/);

            if (aIsNum && bIsNum) return aNum - bNum;
            if (aIsNum) return -1;
            if (bIsNum) return 1;
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });

        logisticsKeyFilter.innerHTML = '<option value="">Filter by Logistics Key</option>' +
            keys.map(key => `<option value="${key}">${key}</option>`).join('');
        logisticsKeyFilter.style.display = 'inline-block';
        logisticsKeyFilter.disabled = false;
    } else {
        logisticsKeyFilter.innerHTML = '<option value="">Filter by Logistics Key</option>';
        logisticsKeyFilter.style.display = 'none';
        logisticsKeyFilter.value = '';
        logisticsKeyFilter.disabled = true;
    }
}

function openLogisticsEditModal(brand, key, index = null) {
    currentLogisticsBrand = brand;
    currentLogisticsKey = key;
    currentLogisticsProductIndex = index;

    const modal = document.getElementById('logistics-edit-modal');
    const fieldsContainer = document.getElementById('logistics-fields');

    const emptyLogistics = {
        ITEM: { length: '', width: '', height: '', weight: '' },
        CARTON: { length: '', width: '', height: '', weight: '', nr_of_items: '' },
        LAYER: { nr_of_items: '', nr_of_cartons: '' },
        PALLET: { length: '', width: '', height: '', weight: '', nr_of_cartons: '', nr_of_items: '', nr_of_layers: '' }
    };

    if (!logisticsData[brand]) logisticsData[brand] = {};
    if (!logisticsData[brand][key]) logisticsData[brand][key] = JSON.parse(JSON.stringify(emptyLogistics));
    const data = logisticsData[brand][key];

    document.getElementById('logistics-edit-title').textContent =
        `Logistics data for all ${brand} – "${key}" products`;

    fieldsContainer.innerHTML = '';

    function makeCol(sections) {
        const colDiv = document.createElement('div');
        colDiv.className = 'logistics-fields-col';
        sections.forEach(section => {
            if (!data[section]) return;
            const group = data[section];
            let html = `<div class="section-group"><h4>${section}</h4>`;
            for (const [keyName, value] of Object.entries(group)) {
                const inputId = `logistics-${section}-${keyName}`;
                html += `
                    <label>${attributeLabels[keyName] || keyName.replace(/_/g, ' ')}:
                        <input type="text" id="${inputId}" value="${value !== null && value !== undefined ? value : ''}">
                    </label>
                `;
            }
            html += `</div>`;
            colDiv.innerHTML += html;
        });
        return colDiv;
    }

    fieldsContainer.appendChild(makeCol(['ITEM', 'CARTON']));
    fieldsContainer.appendChild(makeCol(['LAYER', 'PALLET']));

    modal.style.display = 'block';

    const oldForm = document.getElementById('logistics-edit-form');
    oldForm.onsubmit = null;

    oldForm.onsubmit = function (e) {
        e.preventDefault();

        const newData = JSON.parse(JSON.stringify(data));
        for (const [section, values] of Object.entries(newData)) {
            for (const keyName of Object.keys(values)) {
                const inputId = `logistics-${section}-${keyName}`;
                const input = document.getElementById(inputId);
                if (input) {
                    let val = input.value;
                    if (!isNaN(val) && val.trim() !== "") {
                        val = Number(val);
                    }
                    values[keyName] = val === "" ? null : val;
                }
            }
        }

        let actualKey = document.getElementById('logistics-key').value
            || (currentLogisticsProductIndex !== null ? products[currentLogisticsProductIndex].key : key);

        document.getElementById('logistics-confirm-message').textContent =
            `This will change data for all "${brand}" ("${actualKey}")! Do you really wish to proceed?`;
        document.getElementById('logistics-confirm-modal').style.display = 'block';

        document.getElementById('logistics-confirm-yes').onclick = function () {
            for (const [section, values] of Object.entries(newData)) {
                for (const keyName of Object.keys(values)) {
                    data[section][keyName] = values[keyName];
                }
            }
            document.getElementById('logistics-confirm-modal').style.display = 'none';
            modal.style.display = 'none';

            if (currentLogisticsProductIndex !== null) {
                showLogistics(currentLogisticsProductIndex);
            }
        };

        document.getElementById('logistics-confirm-no').onclick = function () {
            document.getElementById('logistics-confirm-modal').style.display = 'none';
        };
    };
}

document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.close-modal, .close-logistics-modal').forEach(el => {
        el.addEventListener('click', function () {
            const modal = el.closest('.modal');
            if (modal) modal.style.display = 'none';
        });
    });

    const cancelBtn = document.getElementById('cancel-logistics-edit');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function () {
            document.getElementById('logistics-edit-modal').style.display = 'none';
        });
    }
});

document.getElementById('download-logistics-button').addEventListener('click', downloadLogistics);

function downloadLogistics() {
    const dataStr = JSON.stringify(logisticsData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'logistics.json';
    a.click();
    URL.revokeObjectURL(url);
}

function updateLogisticsModalContent(brand, key) {
    const data = logisticsData[brand][key];
    const fieldsContainer = document.getElementById('logistics-fields');
    fieldsContainer.innerHTML = '';

    function makeCol(sections) {
        const colDiv = document.createElement('div');
        colDiv.className = 'logistics-fields-col';
        sections.forEach(section => {
            if (!data[section]) return;
            const group = data[section];
            let html = `<div class="section-group"><h4>${section}</h4>`;
            for (const [keyName, value] of Object.entries(group)) {
                const inputId = `logistics-${section}-${keyName}`;
                html += `
                    <label>${attributeLabels[keyName] || keyName.replace(/_/g, ' ')}:
                        <input type="text" id="${inputId}" value="${value !== null && value !== undefined ? value : ''}">
                    </label>
                `;
            }
            html += `</div>`;
            colDiv.innerHTML += html;
        });
        return colDiv;
    }

    fieldsContainer.appendChild(makeCol(['ITEM', 'CARTON']));
    fieldsContainer.appendChild(makeCol(['LAYER', 'PALLET']));
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

document.getElementById('brand').addEventListener('change', function () {
    populateTypeSelect();
    populateLogisticsKeySelect();
});
