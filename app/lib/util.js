export let TRANSLATIONS;
export async function getCrmUserInfo() {
    try {
        let response = await ZOHO.CRM.CONFIG.getCurrentUser();
        return response?.users[0];
    } catch (error) {
        throw new Error(error);
    }
}

export async function initTranslations() {
    const currentUser = await getCrmUserInfo();
    
    const userLocale = currentUser.locale || 'en';
    const langCode = userLocale.startsWith('zh') ? 'zh' : 'en';
    try {
        TRANSLATIONS = await loadTranslation(langCode);
    } catch (error) {
        TRANSLATIONS = await loadTranslation('en');
    } finally {
        applyTranslations();
    }
}


export async function loadTranslation(langCode) {
    const currentURL = window.location.href;
    try {
        const response = await fetch(currentURL.replace(/\/app\/.*$/, `/app/translations/${langCode}.json`));
        const result = await response.json();
        return result;
    } catch (error) {
        const response = await fetch(currentURL.replace(/\/app\/.*$/, `/app/translations/en.json`));
        const result = await response.json();
        return result;
    }
}

function applyTranslations() {
    
    if (!TRANSLATIONS) return;
    
    for (let key in TRANSLATIONS) {
        switch (true) {
            case key.toLowerCase().includes('btn'):
                const item = document.querySelectorAll(`.${CSS.escape(key)}`).forEach(item => {
                    if (item) item.innerHTML = TRANSLATIONS[`${key}`];
                });
                break;
            case key.toLowerCase().includes('placeholder'):
                document.querySelectorAll(`.${CSS.escape(key)}`).forEach(item => {
                    if (item) item.placeholder = TRANSLATIONS[`${key}`];
                });
                break;
            case key.toLowerCase().includes('txt'):
                document.querySelectorAll(`.${CSS.escape(key)}`).forEach(item => {
                    if (item) item.innerHTML = TRANSLATIONS[`${key}`]
                });
                break;
            case key.toLowerCase().includes('dropdownoption'):
                document.querySelectorAll(`.${CSS.escape(key)}`).forEach(item => {
                    if (item) item.innerHTML = TRANSLATIONS[`${key}`]
                });
                break;
            case key.toLowerCase().includes('tblheader'):
                document.querySelectorAll(`.${CSS.escape(key)}`).forEach(item => {
                    if (item) item.innerHTML = TRANSLATIONS[`${key}`]
                });
                break;
            
        }
    }
}
