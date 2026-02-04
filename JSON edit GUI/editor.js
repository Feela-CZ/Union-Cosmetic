let products = [];
let editIndex = null;
let currentSortField = null;
let currentSortOrder = 'asc';
let logisticsData = {};
let currentLogisticsBrand = null;
let currentLogisticsKey = null;
let currentLogisticsProductIndex = null;
let currentLang = 'cs';
let showingAllKeys = false;
let showDiscontinued = false;

const attributeLabels = {
    nr_of_items: "Number of Items",
    nr_of_cartons: "Number of Cartons",
    nr_of_layers: "Number of Layers",
    length: "Length",
    width: "Width",
    height: "Height",
    weight: "Weight",
    carton_ean: "Carton EAN",
};

const translations = {
    en: {
        title: "Product Editor",
        download_products: "Save products.json",
        download_logistics: "Save logistics.json",
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
        confirm_delete_message: "Are you sure you want to delete this product? This action will completely remove the product. If it is only discontinued, go to \"Edit/Discontinued\".",
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
        export_logistics: "Export logistics data",
        export_logistics_modal_title: "Export logistics data",
        export_logistics_select_brand: "Brand:",
        export_logistics_keys: "Select keys:",
        export_logistics_export_btn: "Export",
        export_logistics_modal_close: "Close",
        export_logistics_success: "XML export successful.",
        export_logistics_no_keys: "No valid keys for this brand.",
        export_logistics_all_brands: "All brands",
        export_logistics_show_empty: "Show empty",
        export_logistics_hide_empty: "Hide empty",
        add_logistics_key: "Add Logistics Key",
        add_logistics_key_title: "Create New Logistics Key",
        label_new_logistics_key: "New key:",
        create: "Create",
        key_already_exists: "This key already exists for the selected brand.",
        key_required: "Please enter a key name.",
        show_discontinued: "Show discontinued",
        hide_discontinued: "Hide discontinued",
        carton_ean: "Carton EAN",
        download_photo: "Download photo",
        add_product_title: "Add product",
        upload_photo: "Upload photo",
        dragdrop_photo: "Drag & Drop - same name as EAN!!!",
        product_types: {
            "Accessories": "Accessories",
            "Bath Ball": "Bath Ball",
            "Bath Essence": "Bath Essence",
            "Bath Foam": "Bath Foam",
            "Bath Salt": "Bath Salt",
            "Beard Care": "Beard Care",
            "Body Butter": "Body Butter",
            "Body Lotion": "Body Lotion",
            "Body Oil": "Body Oil",
            "Body Scrub": "Body Scrub",
            "Conditioner": "Conditioner",
            "Dishwashing Liquid": "Dishwashing Liquid",
            "Fabric Softener": "Fabric Softener",
            "Face Serum": "Face Serum",
            "Facial Cosmetics": "Facial Cosmetics",
            "Foot Cream": "Foot Cream",
            "Hair Balsam": "Hair Balsam",
            "Hair Oil": "Hair Oil",
            "Hand Cream": "Hand Cream",
            "Hand Gel": "Hand Gel",
            "Interior Candle": "Interior Candle",
            "Laundry Perfume": "Laundry Perfume",
            "Lip Balm": "Lip Balm",
            "Liquid Soap": "Liquid Soap",
            "Massage Candle": "Massage Candle",
            "Massage Emulsion": "Massage Emulsion",
            "Micellar Water": "Micellar Water",
            "Nail Polish Remover": "Nail Polish Remover",
            "Parfum": "Parfum",
            "Shampoo": "Shampoo",
            "Shower Gel": "Shower Gel",
            "Skin Oil": "Skin Oil",
            "Solid Hair Balsam": "Solid Hair Balsam",
            "Solid Body Butter": "Solid Body Butter",
            "Solid Deodorant": "Solid Deodorant",
            "Solid Shampoo": "Solid Shampoo",
            "Solid Soap": "Solid Soap",
            "Sun Care": "Sun Care",
            "Toothpaste": "Toothpaste",
            "Travel Kit": "Travel Kit",
            "Vaselinum": "Vaselinum",
            "WC Gel": "WC Gel",
            "Washing Gel": "Washing Gel"
        }

    },
    cs: {
        title: "Editor produktů",
        download_products: "Uložit products.json",
        download_logistics: "Uložit logistics.json",
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
        confirm_delete_message: "Opravdu chceš tento produkt smazat? Tímto dojde k úplnému smazání. Pokud se produkt přestal vyrábět, zvol \"Upravit/Ukončeno\".",
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
        logistics_change_confirm: 'Tímto změníš data pro všechny "{brand}" ("{key}") produkty! Opravdu si přeješ pokračovat?',
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
        export_logistics: "Exportovat logistická data",
        export_logistics_modal_title: "Export logistických dat",
        export_logistics_select_brand: "Značka:",
        export_logistics_keys: "Vyberte klíče:",
        export_logistics_export_btn: "Exportovat",
        export_logistics_modal_close: "Zavřít",
        export_logistics_success: "Export XML byl úspěšný.",
        export_logistics_no_keys: "Pro tuto značku nejsou platné klíče.",
        export_logistics_all_brands: "Všechny značky",
        export_logistics_show_empty: "Zobrazit prázdné",
        export_logistics_hide_empty: "Skrýt prázdné",
        add_logistics_key: "Přidat logistický klíč",
        add_logistics_key_title: "Vytvořit nový logistický klíč",
        label_new_logistics_key: "Nový klíč:",
        create: "Vytvořit",
        key_already_exists: "Tenhle klíč už pro danou značku existuje.",
        key_required: "Zadejte název klíče, prosím.",
        show_discontinued: "Zobrazit ukončené",
        hide_discontinued: "Skrýt ukončené",
        carton_ean: "EAN kartonu",
        download_photo: "Stáhnout fotku",
        upload_photo: "Nahrát fotku",
        dragdrop_photo: "Přetáhni sem pro nahrání (název totožný s EAN!!!)",
        add_product_title: "Přidat produkt",
        product_types: {
            "Accessories": "Doplňky",
            "Bath Ball": "Koupelová koule",
            "Bath Essence": "Esence do koupele",
            "Bath Foam": "Pěna do koupele",
            "Bath Salt": "Sůl do koupele",
            "Beard Care": "Péče o vousy",
            "Body Butter": "Tělové máslo",
            "Body Lotion": "Tělové mléko",
            "Body Oil": "Tělový olej",
            "Body Scrub": "Tělový peeling",
            "Conditioner": "Kondicionér",
            "Dishwashing Liquid": "Prostředek na mytí nádobí",
            "Fabric Softener": "Aviváž",
            "Face Serum": "Pleťové sérum",
            "Facial Cosmetics": "Pleťová kosmetika",
            "Foot Cream": "Krém na nohy",
            "Hair Balsam": "Vlasový balzám",
            "Hair Oil": "Vlasový olej",
            "Hand Cream": "Krém na ruce",
            "Hand Gel": "Gel na ruce",
            "Interior Candle": "Interiérová svíčka",
            "Laundry Perfume": "Parfém na praní",
            "Lip Balm": "Balzám na rty",
            "Liquid Soap": "Tekuté mýdlo",
            "Massage Candle": "Masážní svíčka",
            "Massage Emulsion": "Masážní emulze",
            "Micellar Water": "Micelární voda",
            "Nail Polish Remover": "Odlakovač na nehty",
            "Parfum": "Parfém",
            "Shampoo": "Šampon",
            "Shower Gel": "Sprchový gel",
            "Skin Oil": "Pleťový olej",
            "Solid Hair Balsam": "Tuhý vlasový balzám",
            "Solid Body Butter": "Tuhé tělové máslo",
            "Solid Deodorant": "Tuhý deodorant",
            "Solid Shampoo": "Tuhý šampon",
            "Solid Soap": "Tuhé mýdlo",
            "Sun Care": "Opalování",
            "Toothpaste": "Zubní pasta",
            "Travel Kit": "Cestovní sada",
            "Vaselinum": "Vazelína",
            "WC Gel": "WC gel",
            "Washing Gel": "Prací gel"
        }
    }
};

async function apiPut(name, data) {
    const res = await fetch(`${window.API_BASE}/api/${name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (!res.ok) throw new Error(await res.text() || res.statusText);
    try {
        return await res.json();
    } catch {
        return { ok: true };
    }
}

async function saveProductsToRepo() {
    try {
        await apiPut('products', products);
        products = await fetch(`${window.API_BASE}/api/products?ts=${Date.now()}`).then(r => r.json());
    } catch (e) {
        alert('Uložení products.json selhalo: ' + e.message);
    }
}

function uint8ToBase64(uint8) {
    let binary = "";
    const len = uint8.length;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8[i]);
    }
    return btoa(binary);
}

async function saveFileToRepo(path, bytes) {
    const base64 = uint8ToBase64(bytes);

    const res = await fetch(`${window.API_BASE}/api/upload-image`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            path,
            content: base64
        })
    });

    if (!res.ok) {
        throw new Error("Upload failed: " + (await res.text()));
    }
}

async function saveLogisticsToRepo() {
    try {
        await apiPut('logistics', logisticsData);
        logisticsData = await fetch(`${window.API_BASE}/api/logistics?ts=${Date.now()}`).then(r => r.json());
        Object.keys(logisticsData || {}).forEach(br => {
            Object.keys(logisticsData[br] || {}).forEach(k => {
                const pal = logisticsData[br][k]?.PALLET;
                if (pal && 'carton_ean' in pal) delete pal.carton_ean;
            });
        });
    } catch (e) {
        alert('Uložení logistics.json selhalo: ' + e.message);
    }
}

function translateType(type) {
    if (!type) return '';
    try {
        return translations[currentLang]?.product_types?.[type] || type;
    } catch {
        return String(type);
    }
}

function trimInputOnChange(input) {
    input.addEventListener("input", () => {
        input.value = input.value.trimStart(); // průběžně odmazává mezery na začátku
    });
    input.addEventListener("blur", () => {
        input.value = input.value.trim(); // při opuštění inputu zůstane ořezané
    });
}

const LOCAL_MODE = location.hostname === "127.0.0.1" || location.hostname === "localhost";

const productsUrl = LOCAL_MODE
    ? "../OrderSheet/products.json?ts=" + Date.now()
    : `${window.API_BASE}/api/products?ts=${Date.now()}`;

const logisticsUrl = LOCAL_MODE
    ? "logistics.json?ts=" + Date.now()
    : `${window.API_BASE}/api/logistics?ts=${Date.now()}`;

Promise.all([
    fetch(productsUrl).then(r => r.json()),
    fetch(logisticsUrl).then(r => r.json())
]).then(([productsData, logisticsDataRaw]) => {
    products = productsData;
    logisticsData = logisticsDataRaw;

    // očista logisticsData
    Object.keys(logisticsData || {}).forEach(br => {
        Object.keys(logisticsData[br] || {}).forEach(k => {
            const pal = logisticsData[br][k]?.PALLET;
            if (pal && 'carton_ean' in pal) delete pal.carton_ean;
        });
    });

    initUI();
    renderTable();
    document.getElementById('product-table-section').style.display = 'block';
}).catch(err => console.error("Chyba při načítání dat:", err));

function fillKeysSelect(brand, selectedKey = null) {
    const chooseKey = document.getElementById('choose-key');
    chooseKey.innerHTML = '';
    if (logisticsData[brand]) {
        const sortedKeys = Object.keys(logisticsData[brand]).sort(logisticsKeyCompare);
        sortedKeys.forEach(key => {
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

    document.getElementById('add-product').addEventListener('click', openAddModal);
    document.getElementById('product-form').addEventListener('submit', saveProduct);
    document.getElementById('add-product-form').addEventListener('submit', async function (event) {
        event.preventDefault();

        const today = new Date().toISOString().split('T')[0];

        const eanVal = document.getElementById('add-id').value.trim();
        const hsVal = document.getElementById('add-hs').value.trim();

        const isNew = document.getElementById('add-new').checked;
        const newDateRaw = document.getElementById('add-new_date').value;

        const isDisc = document.getElementById('add-discontinued').checked;
        const discDateRaw = document.getElementById('add-discontinued_date').value;

        const newProduct = {
            brand: document.getElementById('add-brand').value.trim(),
            type: document.getElementById('add-type').value.trim(),
            id: eanVal,
            hs: hsVal,

            // ✅ SPRÁVNÉ KLÍČE (STEJNÉ JAKO EDIT + TABULKA)
            name: document.getElementById('add-name_en').value.trim(),
            csName: document.getElementById('add-name_cs').value.trim(),

            volume: {
                number: document.getElementById('add-volume-number').value.trim(),
                unit: document.getElementById('add-volume-unit').value.trim()
            },

            // typy sjednocené s editem
            price: document.getElementById('add-price').value.trim() === ''
                ? ''
                : parseFloat(document.getElementById('add-price').value),

            pack: document.getElementById('add-pack').value.trim() === ''
                ? ''
                : parseInt(document.getElementById('add-pack').value, 10),

            boxes_per_layer: document.getElementById('add-boxes_per_layer').value.trim() === ''
                ? ''
                : parseInt(document.getElementById('add-boxes_per_layer').value, 10),

            boxes_per_pallet: document.getElementById('add-boxes_per_pallet').value.trim() === ''
                ? ''
                : parseInt(document.getElementById('add-boxes_per_pallet').value, 10),

            // ✅ SPRÁVNÝ KLÍČ
            key: document.getElementById('add-logistics-key').value.trim(),

            new: isNew,
            new_date: isNew ? (newDateRaw || today) : '',
            discontinued: isDisc,
            discontinued_date: isDisc ? (discDateRaw || today) : ''
        };

        products.push(newProduct);

        renderTable();
        document.getElementById('add-modal').style.display = 'none';

        try { await saveProductsToRepo(); }
        catch (e) { alert('Uložení products.json selhalo: ' + (e.message || e)); }
    });

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

    document.getElementById('brand').addEventListener('change', function () {
        populateTypeSelect();
    });

    populateTypeSelect();
    populateTypeSelect('add-type');

    document.querySelectorAll('.close-modal').forEach(el => {
        el.addEventListener('click', () => {
            const m = el.closest('.modal');
            if (m) m.style.display = 'none';
        });
    });

    let mouseDownInside = false;

    document.addEventListener('mousedown', (e) => {
        // pokud začal klik uvnitř modalu, zapamatujeme si
        if (e.target.closest('.modal-content')) {
            mouseDownInside = true;
        } else {
            mouseDownInside = false;
        }
    });

    window.addEventListener('mouseup', (e) => {
        // zavři modal jen když klik skončil přímo na overlay a nezačal uvnitř
        if (
            e.target.classList.contains('modal') &&
            !mouseDownInside
        ) {
            e.target.style.display = 'none';
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
        }
    });

    document.getElementById('add-logistics-key-btn').addEventListener('click', function () {
        const modal = document.getElementById('add-logistics-key-modal');
        const brandSelect = document.getElementById('add-logistics-brand');
        const keyInput = document.getElementById('add-logistics-key-name');

        brandSelect.innerHTML = '';
        Object.keys(logisticsData || {}).forEach(brand => {
            const opt = document.createElement('option');
            opt.value = brand;
            opt.textContent = brand;
            brandSelect.appendChild(opt);
        });

        keyInput.value = '';
        modal.style.display = 'block';
    });

    document.getElementById('add-logistics-key-form').addEventListener('submit', function (e) {
        e.preventDefault();

        const brand = document.getElementById('add-logistics-brand').value.trim();
        const newKeyRaw = document.getElementById('add-logistics-key-name').value;
        const newKey = newKeyRaw.trim();

        if (!newKey) {
            alert(translations[currentLang].key_required);
            return;
        }

        if (!logisticsData[brand]) logisticsData[brand] = {};

        const exists = Object.keys(logisticsData[brand]).some(
            k => k.trim().toLowerCase() === newKey.toLowerCase()
        );

        if (exists) {
            alert(translations[currentLang].key_already_exists);
            return;
        }

        document.getElementById('add-logistics-key-modal').style.display = 'none';
        openLogisticsEditModal(brand, newKey, null);

        if (document.getElementById('brand')) {
            document.getElementById('brand').value = brand;
            populateLogisticsKeySelect();
            const logSel = document.getElementById('logistics-key');
            if (logSel) {
                let existsInSelect = Array.from(logSel.options).some(o => o.value.trim().toLowerCase() === newKey.toLowerCase());
                if (!existsInSelect) {
                    const opt = document.createElement('option');
                    opt.value = newKey;
                    opt.textContent = newKey;
                    logSel.appendChild(opt);
                }
                logSel.value = newKey;
            }
        }
    });

    // Zavírání toho malého modalu křížkem
    document.querySelectorAll('#add-logistics-key-modal .close-modal').forEach(el => {
        el.addEventListener('click', () => {
            document.getElementById('add-logistics-key-modal').style.display = 'none';
        });
    });

    // Po změně značky v Add Product modalu -> doplnit klíče
    document.getElementById('add-brand').addEventListener('change', function () {
        const brand = this.value.trim();
        const keySelect = document.getElementById('add-logistics-key');
        const packInput = document.getElementById('add-pack');
        const layerInput = document.getElementById('add-boxes_per_layer');
        const palletInput = document.getElementById('add-boxes_per_pallet');

        keySelect.innerHTML = '<option value="">-- vyber klíč --</option>';
        packInput.value = "";
        layerInput.value = "";
        palletInput.value = "";

        if (brand && logisticsData[brand]) {
            Object.keys(logisticsData[brand]).sort(logisticsKeyCompare).forEach(key => {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = key;
                keySelect.appendChild(opt);
            });
        }
    });

    // Po výběru klíče -> doplnit logistická pole
    document.getElementById('add-logistics-key').addEventListener('change', function () {
        const brand = document.getElementById('add-brand').value.trim();
        const key = this.value.trim();
        const packInput = document.getElementById('add-pack');
        const layerInput = document.getElementById('add-boxes_per_layer');
        const palletInput = document.getElementById('add-boxes_per_pallet');

        packInput.value = "";
        layerInput.value = "";
        palletInput.value = "";

        if (brand && key && logisticsData[brand]?.[key]) {
            const data = logisticsData[brand][key];
            packInput.value = data?.CARTON?.nr_of_items ?? "";
            layerInput.value = data?.LAYER?.nr_of_cartons ?? "";
            palletInput.value = data?.PALLET?.nr_of_cartons ?? "";
        }
    });

    document.getElementById('choose-logistics-form').addEventListener('submit', function (e) {
        e.preventDefault();
        const selectedBrand = document.getElementById('choose-brand').value;
        const selectedKey = document.getElementById('choose-key').value;

        const sourceLogistics = logisticsData[selectedBrand]?.[selectedKey];

        if (sourceLogistics) {
            if (!logisticsData[selectedBrand]) logisticsData[selectedBrand] = {};

            // deep copy + odstranění případného PALLET.carton_ean
            const copy = JSON.parse(JSON.stringify(sourceLogistics));
            if (copy.PALLET && 'carton_ean' in copy.PALLET) delete copy.PALLET.carton_ean;
            logisticsData[selectedBrand][selectedKey] = copy;

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
                    if (k === 'carton_ean') return; // nepropagovat historický EAN do inputů
                    const input = document.getElementById('logistics-PALLET-' + k);
                    if (input) input.value = sourceLogistics.PALLET[k] || '';
                });
            }

            if (currentLogisticsProductIndex !== null) {
                products[currentLogisticsProductIndex].key = selectedKey || null;
            }

            updateLogisticsModalContent(selectedBrand, selectedKey);
        }
        currentLogisticsKey = selectedKey;
        currentLogisticsBrand = selectedBrand;
        document.getElementById('choose-logistics-modal').style.display = 'none';
        renderTable();
    });

    const url = LOCAL_MODE
        ? "products.json?ts=" + Date.now()
        : `${window.API_BASE}/api/products?ts=${Date.now()}`;

    updateLogisticsKeyFilter();

    document.getElementById('toggle-discontinued').addEventListener('click', () => {
        showDiscontinued = !showDiscontinued;
        updateToggleDiscontinuedText();
        renderTable();
    });
    updateToggleDiscontinuedText();
    updateUITexts();
    initAddPhotoUpload();
    initInputValidations();
}

function setLang(lang) {
    currentLang = lang;
    updateUITexts();
    updateToggleDiscontinuedText();
    renderTable();
    updateExportLogisticsModalTexts();
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

function updateToggleDiscontinuedText() {
    const btn = document.getElementById('toggle-discontinued');
    if (!btn) return;
    const key = showDiscontinued ? 'hide_discontinued' : 'show_discontinued';
    btn.setAttribute('data-i18n', key);
    btn.textContent = translations[currentLang][key];
}

document.addEventListener('DOMContentLoaded', () => {
    updateUITexts();
});

function renderTable() {
    const tbody = document.querySelector('#product-table tbody');
    tbody.innerHTML = '';

    const searchText = document.getElementById('search-input').value.toLowerCase();
    const brandFilter = document.getElementById('brand-filter').value;
    const typeFilter = document.getElementById('type-filter').value;
    const logisticsKeyFilter = document.getElementById('logistics-key-filter').value;

    populateDropdowns();
    updateLogisticsKeyFilter();

    const filteredProducts = products.filter(product => {
        const matchesSearch = (product.brand + ' ' + product.type + ' ' + product.id + ' ' + product.name + ' ' + (product.csName || ''))
            .toLowerCase()
            .includes(searchText);

        const matchesBrand = brandFilter ? product.brand === brandFilter : true;
        const matchesType = typeFilter ? product.type === typeFilter : true;

        const isDiscontinued =
            product.discontinued === true ||
            product.discontinued === 'true' ||
            product.discontinued === 1;

        const includeByDiscontinued = showDiscontinued ? true : !isDiscontinued;

        let matchesLogisticsKey = true;
        if (brandFilter && logisticsKeyFilter) {
            if (logisticsKeyFilter === 'null') {
                matchesLogisticsKey = (product.key == null || product.key === 'null');
            } else {
                matchesLogisticsKey = (product.key != null && String(product.key) === logisticsKeyFilter);
            }
        }

        return matchesSearch && matchesBrand && matchesType && matchesLogisticsKey && includeByDiscontinued;
    });

    const tableEl = document.getElementById('product-table');
    if (tableEl) {
        tableEl.classList.toggle('hide-discontinued-cols', !showDiscontinued);
    }

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
        <td>${translateType(product.type)}</td>
        <td>${product.id}</td>
        <td>${product.hs}</td>
        <td>${(currentLang === 'cs' && product.csName) ? product.csName : product.name}</td>
        <td>${product.volume ? product.volume.number + " " + product.volume.unit : ""}</td>
        <td>${product.price}</td>
        <td>${product.new ? '✅' : ''}</td>
        <td>${product.new_date || ''}</td>
        <td class="col-discontinued">${product.discontinued ? '🚫' : ''}</td>
        <td class="col-discontinued">${product.discontinued_date || ''}</td>
        <td>
            <button onclick="editProduct(${originalIndex})">${translations[currentLang].edit}</button>
            <button class="${getLogisticsClass(product)}" onclick="showLogistics(${originalIndex})">
                ${translations[currentLang].logistics}
            </button>
            <button class="delete-button" onclick="deleteProduct(${originalIndex})">${translations[currentLang].delete}</button>
        </td>
    `;
        tbody.appendChild(row);
    });
}


function showExportLogisticsModal() {

    const brandSelect = document.getElementById('export-brand-select');
    brandSelect.innerHTML = '';
    Object.keys(logisticsData).forEach(brand => {
        const opt = document.createElement('option');
        opt.value = brand;
        opt.textContent = brand;
        brandSelect.appendChild(opt);
    });
    brandSelect.selectedIndex = 0;
    fillExportLogisticsKeys();
    document.getElementById('export-logistics-success').style.display = 'none';
    document.getElementById('export-logistics-error').style.display = 'none';
    document.getElementById('export-logistics-modal').style.display = 'block';
    updateExportLogisticsModalTexts();
}

function fillExportLogisticsKeys(showAll = false) {
    const brand = document.getElementById('export-brand-select').value;
    const keysDiv = document.getElementById('export-keys-checkboxes');
    keysDiv.innerHTML = `<div style="margin-bottom:4px;font-weight:bold;" data-i18n="export_logistics_keys"></div>`;
    if (!logisticsData[brand]) return;

    let allKeys = Object.keys(logisticsData[brand]).filter(k => k);

    let keysWithData = [];
    let keysEmpty = [];
    allKeys.forEach(key => {
        let hasData = false;
        ['ITEM', 'CARTON', 'LAYER', 'PALLET'].forEach(section => {
            if (logisticsData[brand][key]?.[section]) {
                for (let attr in logisticsData[brand][key][section]) {
                    let val = logisticsData[brand][key][section][attr];
                    if (typeof val === 'string' && val.trim() !== '') {
                        let match = val.match(/^(-?\d+(\.\d+)?)/);
                        if (match) val = Number(match[1]);
                        else val = '';
                    }
                    if (typeof val === 'number') hasData = true;
                }
            }
        });
        if (hasData) keysWithData.push(key);
        else keysEmpty.push(key);
    });

    const showEmptyBtn = document.getElementById('show-empty-keys-btn');
    if (!showAll && keysEmpty.length > 0) {
        showEmptyBtn.style.display = '';
        showEmptyBtn.setAttribute('data-i18n', 'export_logistics_show_empty');
    } else if (showAll) {
        showEmptyBtn.style.display = '';
        showEmptyBtn.setAttribute('data-i18n', 'export_logistics_hide_empty');
    } else {
        showEmptyBtn.style.display = 'none';
    }

    let keysToShow = showAll
        ? keysWithData.concat(keysEmpty)
        : keysWithData;

    if (keysToShow.length === 0) {
        keysDiv.innerHTML += `<div data-i18n="export_logistics_no_keys"></div>`;
        return;
    }

    keysToShow.forEach(k => {
        const cbId = 'export-key-cb-' + k;
        keysDiv.innerHTML += `
      <div style="margin-bottom:4px;">
        <label>
          <input type="checkbox" id="${cbId}" value="${k}" checked>
          ${k}
        </label>
      </div>`;
    });

    updateExportLogisticsModalTexts();
}

function updateExportLogisticsModalTexts() {
    document.querySelectorAll('#export-logistics-modal [data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLang] && translations[currentLang][key]) {
            el.textContent = translations[currentLang][key];
        }
    });
}

document.getElementById('export-logistics-btn').addEventListener('click', showExportLogisticsModal);
document.getElementById('close-export-logistics-modal').addEventListener('click', () => {
    document.getElementById('export-logistics-modal').style.display = 'none';
});
document.getElementById('export-brand-select').addEventListener('change', function () {
    showingAllKeys = false;
    fillExportLogisticsKeys();
});

document.getElementById('export-logistics-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const brand = document.getElementById('export-brand-select').value;
    const keys = Array.from(document.querySelectorAll('#export-keys-checkboxes input[type="checkbox"]:checked')).map(cb => cb.value);
    if (!brand || !keys.length) {
        document.getElementById('export-logistics-error').style.display = 'block';
        document.getElementById('export-logistics-error').textContent = 'Vyberte značku a aspoň jeden klíč!';
        return;
    }
    downloadXLSX(brand, keys);
    document.getElementById('export-logistics-success').style.display = 'block';
    document.getElementById('export-logistics-success').textContent = translations[currentLang].export_logistics_success;
});

document.getElementById('show-empty-keys-btn').addEventListener('click', function () {
    showingAllKeys = !showingAllKeys;
    fillExportLogisticsKeys(showingAllKeys);
});

async function downloadXLSX(brand, keys) {
    const sectionOrder = ['ITEM', 'CARTON', 'LAYER', 'PALLET'];
    const attributeOrder = {
        ITEM: ['length', 'width', 'height', 'weight'],
        CARTON: ['length', 'width', 'height', 'weight', 'nr_of_items'],
        LAYER: ['nr_of_items', 'nr_of_cartons'],
        PALLET: ['length', 'width', 'height', 'weight', 'nr_of_cartons', 'nr_of_items', 'nr_of_layers']
    };
    const attributeUnits = {
        length: 'cm',
        width: 'cm',
        height: 'cm',
        weight: 'kg',
        nr_of_items: '',
        nr_of_cartons: '',
        nr_of_layers: ''
    };

    let dataByKey = {};
    keys.forEach(key => {
        dataByKey[key] = [];
        sectionOrder.forEach(section => {
            attributeOrder[section].forEach(attr => {
                let val = logisticsData[brand]?.[key]?.[section]?.[attr];
                if (typeof val === 'string' && val.trim() !== '') {
                    let match = val.match(/^(-?\d+(\.\d+)?)/);
                    if (match) val = Number(match[1]);
                    else val = '';
                }
                if (typeof val === 'number') dataByKey[key].push(val);
                else dataByKey[key].push('');
            });
        });
    });

    const totalCols = 2 + keys.length;
    const totalAttrs = sectionOrder.reduce((sum, section) => sum + attributeOrder[section].length, 0);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(brand);

    ws.mergeCells(1, 1, 1, totalCols);
    ws.getCell(1, 1).value = `LOGISTICS DATA – ${brand}`;
    ws.getCell(1, 1).alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getCell(1, 1).font = { bold: true, size: 16 };
    ws.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
    ws.getCell(1, 1).border = {
        top: { style: 'thick' },
        left: { style: 'thick' },
        bottom: { style: 'thick' },
        right: { style: 'thick' }
    };

    let headerRow = ['Section', 'Attribute'].concat(keys);
    ws.addRow(headerRow);
    for (let col = 1; col <= totalCols; ++col) {
        const cell = ws.getRow(2).getCell(col);
        cell.font = { bold: true };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB7DEE8' } };
        cell.border = {
            top: { style: 'thick' },
            left: { style: 'thick' },
            bottom: { style: 'thick' },
            right: { style: 'thick' }
        };
    }

    let attrRows = [];
    sectionOrder.forEach(section => {
        attributeOrder[section].forEach(attr => {
            const unit = attributeUnits[attr] ? ` (${attributeUnits[attr]})` : '';
            const rowLabel = attr.charAt(0).toUpperCase() + attr.slice(1) + unit;
            attrRows.push({ section, attr, row: [section, rowLabel] });
        });
    });

    attrRows.forEach((obj, rowIdx) => {
        keys.forEach(key => {
            let val = dataByKey[key][rowIdx];
            obj.row.push(typeof val === 'number' ? val : '');
        });
        ws.addRow(obj.row);
    });

    let rowPointer = 3;
    sectionOrder.forEach(section => {
        const cnt = attributeOrder[section].length;
        if (cnt > 1) {
            ws.mergeCells(rowPointer, 1, rowPointer + cnt - 1, 1);
            const cell = ws.getCell(rowPointer, 1);
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { bold: true };
        } else {
            ws.getCell(rowPointer, 1).font = { bold: true };
            ws.getCell(rowPointer, 1).alignment = { vertical: 'middle', horizontal: 'center' };
        }
        rowPointer += cnt;
    });

    const totalRows = ws.rowCount;

    for (let row = 1; row <= totalRows; ++row) {
        for (let col = 1; col <= totalCols; ++col) {
            const cell = ws.getCell(row, col);
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            if (row === 1) cell.border.top = { style: 'thick' };
            if (row === 2) cell.border.top = { style: 'thick' };
            if (row === totalRows) cell.border.bottom = { style: 'thick' };
            if (col === 1) cell.border.left = { style: 'thick' };
            if (col === totalCols) cell.border.right = { style: 'thick' };
        }
    }

    let sectionStart = 3;
    sectionOrder.forEach(section => {
        const cnt = attributeOrder[section].length;
        for (let col = 1; col <= totalCols; ++col) {
            ws.getCell(sectionStart, col).border.top = { style: 'thick' };
        }
        if (sectionStart + cnt - 1 < totalRows) {
            for (let col = 1; col <= totalCols; ++col) {
                ws.getCell(sectionStart + cnt - 1, col).border.bottom = { style: 'thick' };
            }
        }
        for (let row = sectionStart; row < sectionStart + cnt; ++row) {
            ws.getCell(row, 1).border.left = { style: 'thick' };
            ws.getCell(row, totalCols).border.right = { style: 'thick' };
        }
        sectionStart += cnt;
    });

    ws.getColumn(1).width = 12;
    ws.getColumn(2).width = 18;
    for (let c = 3; c <= totalCols; ++c) ws.getColumn(c).width = 7.5;

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logistics_${brand}.xlsx`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 100);
}

function escapeXML(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function downloadXML(xmlStr, fileName) {
    const blob = new Blob([xmlStr], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

function populateDropdowns() {
    const brandFilter = document.getElementById('brand-filter');
    const typeFilter = document.getElementById('type-filter');

    const selectedBrand = brandFilter.value;
    const selectedType = typeFilter.value;

    const brands = [...new Set(products.map(p => p.brand))];
    brandFilter.innerHTML = `<option value="">${translations[currentLang].filter_brand}</option>` +
        brands.map(b => `<option value="${b}" ${b === selectedBrand ? 'selected' : ''}>${b}</option>`).join('');

    const types = [...new Set(products.map(p => p.type))].sort((a, b) =>
        translateType(a).localeCompare(translateType(b), currentLang, { sensitivity: 'base' })
    );
    typeFilter.innerHTML = `<option value="">${translations[currentLang].filter_type}</option>` +
        types.map(t => `<option value="${t}" ${t === selectedType ? 'selected' : ''}>${translateType(t)}</option>`).join('');
}

function openAddModal() {
    const brandSelect = document.getElementById('add-brand');
    const keySelect = document.getElementById('add-logistics-key');
    const packInput = document.getElementById('add-pack');
    const layerInput = document.getElementById('add-boxes_per_layer');
    const palletInput = document.getElementById('add-boxes_per_pallet');

    // Vyčistíme select i hodnoty polí
    keySelect.innerHTML = '<option value="">-- vyber klíč --</option>';
    packInput.value = "";
    layerInput.value = "";
    palletInput.value = "";

    // Naplníme klíče jen když je vybraný brand
    const brand = brandSelect.value.trim();
    if (brand && logisticsData[brand]) {
        Object.keys(logisticsData[brand])
            .sort(logisticsKeyCompare) // pokud máš funkci na řazení
            .forEach(key => {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = key;
                keySelect.appendChild(opt);
            });
    }

    // A nakonec zobrazíme modal
    document.getElementById('add-modal').style.display = 'block';
}

function initAddPhotoUpload() {
    const dropzone = document.getElementById('add-photo-dropzone');
    const input = document.getElementById('add-photo-input');
    const img = document.getElementById('add-product-photo');
    const placeholder = document.getElementById('add-photo-placeholder-text');
    const uploadBtn = document.getElementById('add-upload-photo-btn');

    if (!dropzone || !input || !img || !placeholder || !uploadBtn) return;

    // Klik na tlačítko -> otevře file input
    uploadBtn.addEventListener('click', () => {
        input.click();
    });

    // Klik na dropzone -> taky otevře file input
    dropzone.addEventListener('click', () => {
        input.click();
    });

    // Když se vybere soubor
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                img.src = ev.target.result;
                img.style.display = 'block';
                placeholder.style.display = 'none';
            };
            reader.readAsDataURL(file);
        }
    });

    // Drag & drop
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                img.src = ev.target.result;
                img.style.display = 'block';
                placeholder.style.display = 'none';
            };
            reader.readAsDataURL(file);
        }
    });
}

let pendingProduct = null;

function saveProduct(event) {
    event.preventDefault();

    const missingFields = [];

    const brand = document.getElementById('brand').value.trim();
    const type = document.getElementById('type').value.trim();
    const id = document.getElementById('id').value.trim();
    const hs = document.getElementById('hs').value.trim();
    const nameEn = document.getElementById('name_en').value.trim();
    const nameCs = document.getElementById('name_cs').value.trim();
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
    if (!nameEn) missingFields.push('Name (EN)');
    if (!nameCs) missingFields.push('Name (CZ)');
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
        hs,
        name: nameEn,
        csName: nameCs,
        volume: {
            number: volumeNumber,
            unit: volumeUnit
        },
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

async function saveProductFinal(product) {
    if (editIndex !== null) {
        products[editIndex] = product;
    } else {
        products.push(product);
    }

    const fileInput = document.getElementById("photo-input");
    if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        await saveImageToRepo(file, product.id);
    }

    renderTable();
    closeModal();

    // auto-commit do GitHubu po uložení produktu
    try { await saveProductsToRepo(); }
    catch (e) { alert('Uložení products.json selhalo: ' + e.message); }
}

async function saveImageToRepo(file, productId) {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);

    return new Promise((resolve, reject) => {
        reader.onload = async () => {
            try {
                const arrayBuffer = reader.result;
                const bytes = new Uint8Array(arrayBuffer);

                await saveFileToRepo(
                    `Ordersheet/img/${productId}.jpg`,
                    bytes
                );
                resolve();
            } catch (e) {
                reject(e);
            }
        };
        reader.onerror = reject;
    });
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
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

document.getElementById('add-new').addEventListener('change', function () {
    if (this.checked) {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('add-new_date').value = today;
    } else {
        document.getElementById('add-new_date').value = '';
    }
});

document.getElementById('add-discontinued').addEventListener('change', function () {
    if (this.checked) {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('add-discontinued_date').value = today;
    } else {
        document.getElementById('add-discontinued_date').value = '';
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
    document.getElementById('name_en').value = product.name || '';
    document.getElementById('name_cs').value = product.csName || '';
    const vol = product.volume || { number: "", unit: "" };
    document.getElementById('volume-number').value = vol.number || '';
    document.getElementById('volume-unit').value = vol.unit || '';
    document.getElementById('price').value = product.price;
    document.getElementById('pack').value = product.pack;
    document.getElementById('boxes_per_layer').value = product.boxes_per_layer;
    document.getElementById('boxes_per_pallet').value = product.boxes_per_pallet;
    document.getElementById('new').checked = product.new;
    document.getElementById('new_date').value = product.new_date;
    document.getElementById('discontinued').checked = product.discontinued === true;
    document.getElementById('discontinued_date').value = product.discontinued_date;
    document.getElementById('modal').style.display = 'block';

    const photoEl = document.getElementById('product-photo');
    const downloadBtn = document.getElementById('download-photo-btn');
    const uploadBtn = document.getElementById('edit-upload-photo-btn');
    const editPhotoInput = document.getElementById('edit-photo-input');

    function updatePhotoButtons(hasPhoto) {
        if (downloadBtn) downloadBtn.style.display = hasPhoto ? 'inline-block' : 'none';
        if (uploadBtn) uploadBtn.style.display = hasPhoto ? 'none' : 'inline-block';
    }

    async function checkImageExists(url) {
        try {
            const res = await fetch(url + '?check=' + Date.now(), { method: 'HEAD' });
            return res.ok;
        } catch {
            return false;
        }
    }

    (async () => {
        if (!product.id) {
            photoEl.src = 'OrderSheet/img/no-image.jpg';
            updatePhotoButtons(false);
            return;
        }

        const baseJpg = `https://feela-cz.github.io/Union-Cosmetic/OrderSheet/img/${product.id}.jpg`;

        const exists = await checkImageExists(baseJpg);

        if (exists) {
            photoEl.src = baseJpg + '?ts=' + Date.now();
            updatePhotoButtons(true);
        } else {
            photoEl.src = 'https://feela-cz.github.io/Union-Cosmetic/JSON%20edit%20GUI/no-image.jpg';
            updatePhotoButtons(false);
        }
    })();
    // Kliknutí na miniaturu = otevřít plnou fotku v lightboxu
    photoEl.onclick = () => {
        if (photoEl.src && !photoEl.src.includes('no-image')) {
            const lightbox = document.getElementById('lightbox');
            const lightboxImg = document.getElementById('lightbox-img');
            lightboxImg.src = photoEl.src;
            lightbox.style.display = 'flex';
        }
    };

    // Zavření lightboxu kliknutím
    document.getElementById('lightbox').onclick = () => {
        document.getElementById('lightbox').style.display = 'none';
    };

    // Tlačítko stáhnout fotku
    if (downloadBtn) {
        downloadBtn.onclick = () => {
            if (!photoEl.src || photoEl.src.includes('no-image')) {
                alert('Fotka není k dispozici');
                return;
            }
            const a = document.createElement('a');
            a.href = photoEl.src;
            a.download = `${product.id}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };
    }

    // Tlačítko nahrát fotku + file input
    if (uploadBtn && editPhotoInput && product.id) {
        uploadBtn.onclick = () => {
            editPhotoInput.click();
        };

        editPhotoInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                await saveImageToRepo(file, product.id);
                photoEl.src = `https://feela-cz.github.io/Union-Cosmetic/OrderSheet/img/${product.id}.jpg?ts=${Date.now()}`;
            } catch (err) {
                alert('Nahrání fotky selhalo: ' + (err.message || err));
            }
        };
    }
}

let deleteIndex = null;

function deleteProduct(index) {
    deleteIndex = index;
    document.getElementById('confirm-delete-modal').style.display = 'block';
}

document.getElementById('confirm-delete-yes').addEventListener('click', async () => {
    if (deleteIndex !== null) {
        products.splice(deleteIndex, 1);
        renderTable();
        try { await saveProductsToRepo(); } // commit po smazání
        catch (e) { alert('Uložení products.json selhalo: ' + e.message); }
    }
    closeDeleteModal();
});

document.getElementById('confirm-delete-no').addEventListener('click', closeDeleteModal);

function closeDeleteModal() {
    document.getElementById('confirm-delete-modal').style.display = 'none';
    deleteIndex = null;
}

/*function downloadJSON() {
    const dataStr = JSON.stringify(products, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products.json';
    a.click();
    URL.revokeObjectURL(url);
}*/

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

    document.getElementById('logistics-title').textContent =
        translations[currentLang].logistics_data_for
            .replace('{brand}', product.brand)
            .replace('{key}', product.key);

    // Carton EAN pouze pro zobrazení – primárně z produktu, fallback z historických dat (nepíšeme do logisticsData!)
    const palletCartonEANForDisplay =
        (product.carton_ean != null && product.carton_ean !== '') ? product.carton_ean : null;

    if (!data) {
        content.innerHTML = `<p>${translations[currentLang].no_logistics_data}</p>`;
    } else {
        for (const [section, values] of Object.entries(data)) {
            // Vynecháme případný historický PALLET.carton_ean, jinak zobrazíme vše
            const entries = Object.entries(values).filter(([k]) => !(section === 'PALLET' && k === 'carton_ean'));
            if (entries.length === 0) continue;

            const sectionName = translations[currentLang]['section_' + section] || section;
            content.innerHTML += `<h4>${sectionName}:</h4><ul>`;
            for (const [key, value] of entries) {
                const label = translations[currentLang][key] || attributeLabels[key] || key.replace(/_/g, ' ');
                content.innerHTML += `<li><strong>${label}</strong>: ${value}</li>`;
            }
            content.innerHTML += `</ul>`;
        }

        if (palletCartonEANForDisplay != null && palletCartonEANForDisplay !== '') {
            const label = translations[currentLang]['carton_ean'] || attributeLabels['carton_ean'] || 'Carton EAN';
            content.innerHTML += `<div class="carton-ean-line"><strong>${label}</strong>: ${palletCartonEANForDisplay}</div>`;
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

function populateTypeSelect(selectId = 'type') {
    const typeSelect = document.getElementById(selectId);
    if (!typeSelect) return;

    const types = Object.keys(translations[currentLang].product_types).sort((a, b) =>
        translateType(a).localeCompare(translateType(b), currentLang, { sensitivity: 'base' })
    );
    typeSelect.innerHTML = '<option value="">' + translations[currentLang].select_type + '</option>' +
        types.map(t => `<option value="${t}">${translateType(t)}</option>`).join('');
}

function logisticsKeyCompare(a, b) {
    const regex = /^(\d+)(.*)$/;
    const ma = a.match(regex);
    const mb = b.match(regex);

    if (ma && mb) {
        const numA = parseInt(ma[1], 10);
        const numB = parseInt(mb[1], 10);
        if (numA !== numB) return numA - numB;
        return ma[2].localeCompare(mb[2], undefined, { sensitivity: 'base' });
    }
    if (ma) return -1;
    if (mb) return 1;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
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
        const sortedKeys = Object.keys(logisticsData[brand]).sort(logisticsKeyCompare);
        sortedKeys.forEach((key) => {
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
    const selectedKey = logisticsKeyFilter.value;

    if (brand && logisticsData[brand]) {
        const keys = Object.keys(logisticsData[brand]);
        keys.sort(logisticsKeyCompare);

        logisticsKeyFilter.innerHTML =
            `<option value="">${translations[currentLang].filter_logistics_key}</option>` +
            keys.map(key =>
                `<option value="${key}" ${key === selectedKey ? 'selected' : ''}>${key}</option>`
            ).join('');

        logisticsKeyFilter.style.display = 'inline-block';
        logisticsKeyFilter.disabled = false;
    } else {
        logisticsKeyFilter.innerHTML =
            `<option value="">${translations[currentLang].filter_logistics_key}</option>`;
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
        PALLET: {
            length: '', width: '', height: '', weight: '', nr_of_cartons: '', nr_of_items: '', nr_of_layers: '',
        }
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
                if (keyName === 'carton_ean') continue;
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

    const prod = currentLogisticsProductIndex !== null ? products[currentLogisticsProductIndex] : null;
    const productCartonEAN = prod && prod.carton_ean != null ? String(prod.carton_ean) : '';

    const eanBlock = document.createElement('div');
    eanBlock.className = 'ean-block';
    eanBlock.innerHTML = `
  <h4>${translations[currentLang]['carton_ean'] || attributeLabels['carton_ean'] || 'Carton EAN'}</h4>
  <div><input type="text" id="product-carton-ean" value="${productCartonEAN}"></div>
`;
    fieldsContainer.appendChild(eanBlock);

    modal.style.display = 'block';

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

    const oldForm = document.getElementById('logistics-edit-form');
    oldForm.onsubmit = null;

    oldForm.onsubmit = async function (e) {
        e.preventDefault();

        const newData = JSON.parse(JSON.stringify(data));

        if (newData.PALLET && 'carton_ean' in newData.PALLET) {
            delete newData.PALLET.carton_ean;
        }

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

        function logisticsChanged(orig, upd) {
            const secs = ['ITEM', 'CARTON', 'LAYER', 'PALLET'];
            for (const s of secs) {
                const go = orig[s] || {};
                const gu = upd[s] || {};
                const keys = new Set([...Object.keys(go), ...Object.keys(gu)]);
                for (const k of keys) {
                    if (s === 'PALLET' && k === 'carton_ean') continue;
                    const vo = go[k] ?? null;
                    const vu = gu[k] ?? null;
                    if (vo !== vu) return true;
                }
            }
            return false;
        }

        const inp = document.getElementById('product-carton-ean');
        let eanNew = null;
        if (inp) {
            let v = inp.value.trim();
            if (v === '') v = null;
            else if (v.toLowerCase() === 'can') v = 'can';
            else if (/^\d+$/.test(v)) v = v;
            eanNew = v;
        }

        const prodIdx = currentLogisticsProductIndex;
        const eanOld = (prodIdx !== null) ? (products[prodIdx].carton_ean ?? null) : null;

        const hasLogisticsChanges = logisticsChanged(data, newData);
        const onlyEANChanged = !hasLogisticsChanges && (prodIdx !== null) && (eanNew !== eanOld);

        if (hasLogisticsChanges) {
            let actualKey = document.getElementById('logistics-key').value
                || (prodIdx !== null ? products[prodIdx].key : key);

            document.getElementById('logistics-confirm-message').textContent =
                translations[currentLang].logistics_change_confirm
                    .replace('{brand}', brand)
                    .replace('{key}', actualKey);

            document.getElementById('logistics-confirm-modal').style.display = 'block';

            document.getElementById('logistics-confirm-yes').onclick = async function () {
                if (data.PALLET && 'carton_ean' in data.PALLET) {
                    delete data.PALLET.carton_ean;
                }
                // propsat nové hodnoty z newData do data (logisticsData)
                for (const [section, values] of Object.entries(newData)) {
                    for (const keyName of Object.keys(values)) {
                        data[section][keyName] = values[keyName];
                    }
                }

                // případně propsat změnu carton_ean do produktu
                if (prodIdx !== null && inp) {
                    products[prodIdx].carton_ean = eanNew;
                }

                // zavřít modaly
                document.getElementById('logistics-confirm-modal').style.display = 'none';
                modal.style.display = 'none';

                // ULOŽIT logistiky do repa
                try { await saveLogisticsToRepo(); }
                catch (e) { alert('Uložení logistics.json selhalo: ' + e.message); }

                // Pokud jsme změnili i carton_ean v produktu, ulož i products.json
                if (prodIdx !== null && inp) {
                    try { await saveProductsToRepo(); }
                    catch (e) { alert('Uložení products.json selhalo: ' + e.message); }
                }

                // znovu otevři náhled pro aktuální produkt
                if (prodIdx !== null) {
                    showLogistics(prodIdx);
                }
            };

            document.getElementById('logistics-confirm-no').onclick = function () {
                document.getElementById('logistics-confirm-modal').style.display = 'none';
            };
        } else {
            if (onlyEANChanged && prodIdx !== null) {
                products[prodIdx].carton_ean = eanNew;
                try { await saveProductsToRepo(); } // commit i při samotné změně EAN
                catch (e) { alert('Uložení products.json selhalo: ' + e.message); }
            }
            modal.style.display = 'none';
            if (prodIdx !== null) {
                showLogistics(prodIdx);
            }
        }
    }
}

function initInputValidations() {
    // ID/EAN – jen číslice, 13 znaků
    const eanInputs = [document.getElementById("add-id"), document.getElementById("id")];
    eanInputs.forEach(input => {
        if (!input) return;
        trimInputOnChange(input);
        input.addEventListener("input", () => {
            input.value = input.value.replace(/\D/g, ""); // jen číslice
            if (input.value.length > 13) {
                input.value = input.value.slice(0, 13);
            }
        });
    });

    // HS kód – jen číslice
    const hsInputs = [document.getElementById("add-hs"), document.getElementById("hs")];
    hsInputs.forEach(input => {
        if (!input) return;
        trimInputOnChange(input);
        input.addEventListener("input", () => {
            input.value = input.value.replace(/\D/g, "");
        });
    });

    // Pack / Boxes per layer / Boxes per pallet – jen číslice
    const numericInputs = [
        document.getElementById("add-pack"),
        document.getElementById("add-boxes_per_layer"),
        document.getElementById("add-boxes_per_pallet"),
        document.getElementById("pack"),
        document.getElementById("boxes_per_layer"),
        document.getElementById("boxes_per_pallet")
    ];
    numericInputs.forEach(input => {
        if (!input) return;
        trimInputOnChange(input);
        input.addEventListener("input", () => {
            input.value = input.value.replace(/\D/g, "");
        });
    });
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
            const sectionName = translations[currentLang]['section_' + section] || section;
            let html = `<div class="section-group"><h4>${sectionName}</h4>`;
            for (const [keyName, value] of Object.entries(group)) {
                if (keyName === 'carton_ean') continue;
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

document.getElementById('force-save-button').addEventListener('click', async () => {
    if (pendingProduct) {
        await saveProductFinal(pendingProduct); // skutečně commitne
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
