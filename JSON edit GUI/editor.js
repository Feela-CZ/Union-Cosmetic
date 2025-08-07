let products = [];
let editIndex = null;
let currentSortField = null;
let currentSortOrder = 'asc';
let logisticsData = {};
let currentLogisticsBrand = null;
let currentLogisticsKey = null;
let currentLogisticsProductIndex = null;
let currentLang = 'en';

const attributeLabels = {
    nr_of_items: "Number of Items",
    nr_of_cartons: "Number of Cartons",
    nr_of_layers: "Number of Layers",
    length: "Length",
    width: "Width",
    height: "Height",
    weight: "Weight"
};

const translations = {
    en: {
        title: "Product Editor",
        download_products: "Download products.json",
        download_logistics: "Download logistics.json",
        reset_filters: "Reset Filters",
        search_placeholder: "Search...",
        brand_filter: "Filter by Brand",
        type_filter: "Filter by Type",
        logistics_key_filter: "Filter by Logistics Key",
        add_product: "Add New Product",
        table_brand: "Brand",
        table_type: "Type",
        table_ean: "EAN",
        table_hs: "HS Code",
        table_name: "Name",
        table_volume: "Volume",
        table_price: "Price (€)",
        table_new: "New",
        table_new_date: "Date_New",
        table_discontinued: "Discontinued",
        table_discontinued_date: "Date_Discontinued",
        table_actions: "Actions",
        edit_product_title: "Edit Product",
        select_brand: "-- select brand --",
        select_type: "-- select type --",
        label_brand: "Brand:",
        label_type: "Type:",
        label_id: "ID (EAN):",
        label_hs: "HS Code:",
        label_name: "Name:",
        label_volume: "Volume:",
        label_price: "Price:",
        label_pack: "Pack:",
        label_boxes_per_layer: "Boxes per Layer:",
        label_boxes_per_pallet: "Boxes per Pallet:",
        label_logistics_key: "Logistics key:",
        select_key: "-- select key --",
        label_new: "New",
        label_discontinued: "Discontinued",
        save: "Save",
        confirm_delete_title: "Confirm Deletion",
        confirm_delete_message: "Are you sure you want to delete this product?",
        confirm_delete_yes: "Yes, delete",
        confirm_delete_no: "Cancel",
        logistics_title: "Logistics Information",
        logistics_edit: "Edit",
        logistics_edit_title: "Edit Logistics Data",
        choose_logistics_key: "Choose logistics key",
        choose_logistics_key_title: "Choose Logistics Key",
        choose_logistics_apply: "Apply",
        cancel: "Cancel",
        validation_title: "Incomplete Data",
        validation_force_save: "Save Anyway",
        validation_cancel_save: "Cancel",
        logistics_confirm_title: "Confirm Change",
        logistics_confirm_yes: "Yes",
        logistics_confirm_no: "No",
        label_key: "Key:",
        edit: "Edit",
        logistics: "Logistics",
        delete: "Delete",
        logistics_data_for: 'Logistics data for {brand} – "{key}" products',
        no_logistics_data: "No logistics data available.",
        logistics_change_confirm: 'This will change data for all "{brand}" ("{key}")! Do you really wish to proceed?',
        section_ITEM: "Item",
        section_CARTON: "Carton",
        section_LAYER: "Layer",
        section_PALLET: "Pallet",
        nr_of_items: "Number of Items",
        nr_of_cartons: "Number of Cartons",
        nr_of_layers: "Number of Layers",
        length: "Length",
        width: "Width",
        height: "Height",
        weight: "Weight",
        placeholder_search: "Search...",
        filter_brand: "Filter by Brand",
        filter_type: "Filter by Type",
        filter_logistics_key: "Filter by Logistics Key",
        edit: "Edit",
        logistics: "Logistics",
        delete: "Delete",
    },
    cs: {
        title: "Editor produktů",
        download_products: "Stáhnout products.json",
        download_logistics: "Stáhnout logistics.json",
        reset_filters: "Resetovat filtry",
        search_placeholder: "Hledat...",
        brand_filter: "Filtrovat podle značky",
        type_filter: "Filtrovat podle typu",
        logistics_key_filter: "Filtrovat podle logistického klíče",
        add_product: "Přidat nový produkt",
        table_brand: "Značka",
        table_type: "Typ",
        table_ean: "EAN",
        table_hs: "HS kód",
        table_name: "Název",
        table_volume: "Objem",
        table_price: "Cena (€)",
        table_new: "Novinka",
        table_new_date: "Novinka od",
        table_discontinued: "Ukončeno",
        table_discontinued_date: "Ukončeno od",
        table_actions: "Akce",
        edit_product_title: "Upravit produkt",
        select_brand: "-- vyber značku --",
        select_type: "-- vyber typ --",
        label_brand: "Značka:",
        label_type: "Typ:",
        label_id: "ID (EAN):",
        label_hs: "HS kód:",
        label_name: "Název:",
        label_volume: "Objem:",
        label_price: "Cena:",
        label_pack: "Balení:",
        label_boxes_per_layer: "Krabic na vrstvu:",
        label_boxes_per_pallet: "Krabic na paletě:",
        label_logistics_key: "Logistický klíč:",
        select_key: "-- vyber klíč --",
        label_new: "Novinka",
        label_discontinued: "Ukončeno",
        save: "Uložit",
        confirm_delete_title: "Potvrdit smazání",
        confirm_delete_message: "Opravdu chcete tento produkt smazat?",
        confirm_delete_yes: "Ano, smazat",
        confirm_delete_no: "Zrušit",
        logistics_title: "Logistické informace",
        logistics_edit: "Upravit",
        logistics_edit_title: "Upravit logistická data",
        choose_logistics_key: "Vybrat logistický klíč",
        choose_logistics_key_title: "Vybrat logistický klíč",
        choose_logistics_apply: "Použít",
        cancel: "Zrušit",
        validation_title: "Neúplná data",
        validation_force_save: "Uložit i tak",
        validation_cancel_save: "Zrušit",
        logistics_confirm_title: "Potvrdit změnu",
        logistics_confirm_yes: "Ano",
        logistics_confirm_no: "Ne",
        label_key: "Klíč:",
        edit: "Upravit",
        logistics: "Logistika",
        delete: "Smazat",
        logistics_data_for: 'Logistická data pro {brand} – "{key}" produkty',
        no_logistics_data: "Logistická data nejsou dostupná.",
        logistics_change_confirm: 'Tímto změníte data pro všechny "{brand}" ("{key}") produkty! Opravdu si přejete pokračovat?',
        section_ITEM: "Kus",
        section_CARTON: "Karton",
        section_LAYER: "Vrstva",
        section_PALLET: "Paleta",
        nr_of_items: "Počet kusů",
        nr_of_cartons: "Počet kartonů",
        nr_of_layers: "Počet vrstev",
        length: "Délka",
        width: "Šířka",
        height: "Výška",
        weight: "Hmotnost",
        placeholder_search: "Hledat...",
        filter_brand: "Filtrovat podle značky",
        filter_type: "Filtrovat podle typu",
        filter_logistics_key: "Filtrovat podle log. klíče",
        edit: "Upravit",
        logistics: "Logistika",
        delete: "Smazat",
    }
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

function setLang(lang) {
    currentLang = lang;
    updateUITexts();
    renderTable();
    updateFilterPlaceholders();
}

function updateUITexts() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLang] && translations[currentLang][key]) {
            el.textContent = translations[currentLang][key];
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[currentLang] && translations[currentLang][key]) {
            el.placeholder = translations[currentLang][key];
        }
    });
}

function updateFilterPlaceholders() {
    document.getElementById('search-input').placeholder = translations[currentLang].placeholder_search;
    document.getElementById('brand-filter').options[0].textContent = translations[currentLang].filter_brand;
    document.getElementById('type-filter').options[0].textContent = translations[currentLang].filter_type;
    document.getElementById('logistics-key-filter').options[0].textContent = translations[currentLang].filter_logistics_key;
}

document.addEventListener('DOMContentLoaded', () => {
    updateUITexts();
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
            <button onclick="editProduct(${originalIndex})">${translations[currentLang].edit}</button>
            <button onclick="showLogistics(${originalIndex})">${translations[currentLang].logistics}</button>
            <button class="delete-button" onclick="deleteProduct(${originalIndex})">${translations[currentLang].delete}</button>
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

    brandFilter.innerHTML = `<option value="">${translations[currentLang].filter_brand}</option>` +
        brands.map(b => `<option value="${b}" ${b === selectedBrand ? 'selected' : ''}>${b}</option>`).join('');
    typeFilter.innerHTML = `<option value="">${translations[currentLang].filter_type}</option>` +
        types.map(t => `<option value="${t}" ${t === selectedType ? 'selected' : ''}>${t}</option>`).join('');
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
        translations[currentLang].logistics_data_for
            .replace('{brand}', product.brand)
            .replace('{key}', product.key);

    if (!data) {
        content.innerHTML = `<p>${translations[currentLang].no_logistics_data}</p>`;
    } else {
        for (const [section, values] of Object.entries(data)) {
            const visibleEntries = Object.entries(values).filter(([key]) => !hiddenKeys.includes(key));
            if (visibleEntries.length === 0) continue;

            const sectionName = translations[currentLang]['section_' + section] || section;
            content.innerHTML += `<h4>${sectionName}:</h4><ul>`;
            for (const [key, value] of visibleEntries) {
                const label = translations[currentLang][key] || attributeLabels[key] || key.replace(/_/g, ' ');
                content.innerHTML += `<li><strong>${label}</strong>: ${value}</li>`;
            }
            content.innerHTML += '</ul>';
        }
    }
    modal.style.display = 'block';

    document.querySelectorAll('.close-modal, .close-logistics-modal').forEach(el => {
        el.onclick = function () {
            const m = el.closest('.modal');
            if (m) m.style.display = 'none';
        };
    });

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

        logisticsKeyFilter.innerHTML = `<option value="">${translations[currentLang].filter_logistics_key}</option>` +
            keys.map(key => `<option value="${key}">${key}</option>`).join('');
        logisticsKeyFilter.style.display = 'inline-block';
        logisticsKeyFilter.disabled = false;
    } else {
        logisticsKeyFilter.innerHTML = `<option value="">${translations[currentLang].filter_logistics_key}</option>`;
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
        translations[currentLang].logistics_data_for
            .replace('{brand}', brand)
            .replace('{key}', key);

    fieldsContainer.innerHTML = '';

    function makeCol(sections) {
        const colDiv = document.createElement('div');
        colDiv.className = 'logistics-fields-col';
        sections.forEach(section => {
            if (!data[section]) return;
            const group = data[section];
            const sectionName = translations[currentLang]['section_' + section] || section;
            let html = `<div class="section-group"><h4>${sectionName}</h4>`;
            for (const [keyName, value] of Object.entries(group)) {
                const label = translations[currentLang][keyName] || attributeLabels[keyName] || keyName.replace(/_/g, ' ');
                const inputId = `logistics-${section}-${keyName}`;
                html += `
                    <label>${label}:
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
            translations[currentLang].logistics_change_confirm
                .replace('{brand}', brand)
                .replace('{key}', actualKey);

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

    document.querySelectorAll('.close-modal, .close-logistics-modal').forEach(el => {
        el.onclick = function () {
            const m = el.closest('.modal');
            if (m) m.style.display = 'none';
        };
    });

    const cancelBtn = document.getElementById('cancel-logistics-edit');
    if (cancelBtn) {
        cancelBtn.onclick = function () {
            document.getElementById('logistics-edit-modal').style.display = 'none';
        };
    }
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
